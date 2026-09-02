"""Chunked file upload endpoints for /api/v1/files/upload.

Protocol (client-driven chunked upload):
  1. POST   /upload/init                  → { upload_id, chunk_size }
  2. PUT    /upload/chunk/{upload_id}     → { chunk_index, received, ... }  (repeat N times)
  3. POST   /upload/complete/{upload_id}  → FileRecordResponse
  4. DELETE /upload/abort/{upload_id}     → 204  (on cancel or unrecoverable error)

Files below MAX_SINGLE_REQUEST_BYTES can still use POST /files/upload (single request).
Files at or above the threshold MUST use this chunked protocol.

Storage backends:
  - R2: uses S3 multipart upload API (create → upload_part × N → complete).
        Each part's ETag is stored in the Firestore session doc using dot-notation
        updates to avoid overwriting previous ETags.
  - Local disk: chunks are appended to a temp file; renamed atomically on complete.

Important: always call /abort if the upload will not be completed — R2 charges for
storage used by incomplete multipart uploads until they are explicitly aborted.
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
from app.r2 import (
    r2_abort_multipart_upload,
    r2_complete_multipart_upload,
    r2_create_multipart_upload,
    r2_upload_part,
)
from app.routers.v1.files_utils import (
    CHUNK_SIZE,
    FileRecordResponse,
    ChunkUploadInitRequest,
    ChunkUploadInitResponse,
    ChunkUploadPartResponse,
    _doc_to_response,
    _local_path,
    _now,
    _build_path,
    _storage_root,
    _use_r2,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files/upload", tags=["v1-files-upload"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_session(upload_id: str, db: firestore.Client, current_user: User) -> tuple[object, dict]:
    """Fetch and validate an upload session document.

    Returns (doc_ref, data). Raises 404 if missing, 403 if wrong owner,
    400 if already completed or aborted.
    """
    doc = db.collection("upload_sessions").document(upload_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Upload session not found.")
    data = doc.to_dict() or {}
    if data.get("owner_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not your upload session.")
    if data.get("status") != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Upload session is {data.get('status')}, not in_progress.",
        )
    return db.collection("upload_sessions").document(upload_id), data


def _tmp_path(upload_id: str) -> Path:
    """Return the temp file path for a local-disk chunked upload."""
    tmp_dir = _storage_root() / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    return tmp_dir / f".chunk-{upload_id}"


# ---------------------------------------------------------------------------
# POST /upload/init
# ---------------------------------------------------------------------------

@router.post("/init", response_model=ChunkUploadInitResponse, status_code=201)
async def init_chunked_upload(
    body: ChunkUploadInitRequest,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> ChunkUploadInitResponse:
    """Initialise a chunked upload session.

    Creates a Firestore upload_sessions document and (for R2) initiates an
    S3 multipart upload.  Returns an upload_id the client must include in
    all subsequent chunk and complete/abort calls.

    The client is responsible for:
      - Splitting the file into CHUNK_SIZE (5 MiB) slices (last chunk may be smaller).
      - Sending chunks sequentially via PUT /upload/chunk/{upload_id}.
      - Calling POST /upload/complete/{upload_id} after all chunks are received.
      - Calling DELETE /upload/abort/{upload_id} on cancel or permanent failure.
    """
    upload_id = str(uuid.uuid4())
    now = _now()

    # Build virtual and storage paths
    parent = body.path.strip("/") if body.path else ""
    filename = Path(body.filename).name or f"upload-{upload_id}"
    virtual_path = _build_path(parent, filename)
    r2_key = f"{current_user.id}/{upload_id}/{filename}"

    session_data: dict = {
        "upload_id": upload_id,
        "filename": filename,
        "virtual_path": virtual_path,
        "path": body.path,
        "total_size": body.total_size,
        "total_chunks": body.total_chunks,
        "chunks_received": [],
        "etags": {},           # chunk_index (str) → ETag, R2 only
        "owner_id": current_user.id,
        "r2_key": r2_key if _use_r2() else None,
        "r2_upload_id": None,  # filled below for R2
        "local_tmp_path": None,
        "mime_type": body.mime_type,
        "status": "in_progress",
        "created_at": now,
        "updated_at": now,
    }

    if _use_r2():
        r2_upload_id = await r2_create_multipart_upload(r2_key, body.mime_type)
        session_data["r2_upload_id"] = r2_upload_id
        logger.info(
            "init_chunked_upload: user=%s upload_id=%s r2_upload_id=%s size=%d chunks=%d",
            current_user.id, upload_id, r2_upload_id, body.total_size, body.total_chunks,
        )
    else:
        tmp = _tmp_path(upload_id)
        session_data["local_tmp_path"] = str(tmp)
        # Pre-create the temp file so chunk appends don't fail on a missing file
        tmp.touch()
        logger.info(
            "init_chunked_upload: user=%s upload_id=%s local_tmp=%s size=%d chunks=%d",
            current_user.id, upload_id, tmp, body.total_size, body.total_chunks,
        )

    db.collection("upload_sessions").document(upload_id).set(session_data)

    return ChunkUploadInitResponse(upload_id=upload_id, chunk_size=CHUNK_SIZE)


# ---------------------------------------------------------------------------
# PUT /upload/chunk/{upload_id}
# ---------------------------------------------------------------------------

@router.put("/chunk/{upload_id}", response_model=ChunkUploadPartResponse)
async def upload_chunk(
    upload_id: str,
    chunk_index: int = Form(...),
    chunk_data: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> ChunkUploadPartResponse:
    """Receive one chunk of a multipart upload.

    The client must send chunks sequentially (0, 1, 2, …).  For R2, each
    chunk is uploaded as an S3 part and the returned ETag is stored in the
    session doc using Firestore dot-notation to avoid overwriting previous
    ETags.  For local disk, the chunk is appended to the temp file.

    Duplicate chunk_index values are ignored (idempotent — safe to retry).
    """
    doc_ref, data = _get_session(upload_id, db, current_user)

    chunks_received: list[int] = data.get("chunks_received", [])

    # Idempotent: duplicate chunk — acknowledge without re-processing
    if chunk_index in chunks_received:
        logger.debug(
            "upload_chunk: duplicate chunk upload_id=%s chunk=%d — ignored",
            upload_id, chunk_index,
        )
        return ChunkUploadPartResponse(
            chunk_index=chunk_index,
            received=True,
            chunks_received=len(chunks_received),
            total_chunks=data["total_chunks"],
        )

    raw = await chunk_data.read()

    if _use_r2():
        r2_upload_id = data["r2_upload_id"]
        r2_key = data["r2_key"]
        # S3 part numbers are 1-based
        part_number = chunk_index + 1
        etag = await r2_upload_part(r2_key, r2_upload_id, part_number, raw)

        # CRITICAL: use dot-notation so we update only this key, not the whole map
        doc_ref.update({
            f"etags.{chunk_index}": etag,
            "chunks_received": firestore.ArrayUnion([chunk_index]),
            "updated_at": _now(),
        })
        logger.debug(
            "upload_chunk: upload_id=%s chunk=%d/%d etag=%s",
            upload_id, chunk_index + 1, data["total_chunks"], etag,
        )
    else:
        tmp = Path(data["local_tmp_path"])
        # Append — safe because client sends chunks sequentially
        with open(tmp, "ab") as f:
            f.write(raw)
        doc_ref.update({
            "chunks_received": firestore.ArrayUnion([chunk_index]),
            "updated_at": _now(),
        })
        logger.debug(
            "upload_chunk: local upload_id=%s chunk=%d/%d bytes=%d",
            upload_id, chunk_index + 1, data["total_chunks"], len(raw),
        )

    new_count = len(chunks_received) + 1
    return ChunkUploadPartResponse(
        chunk_index=chunk_index,
        received=True,
        chunks_received=new_count,
        total_chunks=data["total_chunks"],
    )


# ---------------------------------------------------------------------------
# POST /upload/complete/{upload_id}
# ---------------------------------------------------------------------------

@router.post("/complete/{upload_id}", response_model=FileRecordResponse, status_code=201)
async def complete_chunked_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Finalise a chunked upload after all chunks have been received.

    For R2: assembles all parts via CompleteMultipartUpload.
    For local disk: atomically renames the temp file to the final path.

    Creates the file_records Firestore document and deletes the upload_sessions doc.
    Returns a FileRecordResponse identical to what the simple upload endpoint returns.
    """
    doc_ref, data = _get_session(upload_id, db, current_user)

    total_chunks = data["total_chunks"]
    chunks_received: list[int] = data.get("chunks_received", [])

    # Verify all chunks are present before assembling
    missing = set(range(total_chunks)) - set(chunks_received)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing chunks: {sorted(missing)[:10]}{'…' if len(missing) > 10 else ''}",
        )

    file_id = str(uuid.uuid4())
    now = _now()
    virtual_path = data["virtual_path"]
    r2_key_final: str | None = None

    if _use_r2():
        r2_upload_id = data["r2_upload_id"]
        r2_key = data["r2_key"]
        etags: dict = data.get("etags", {})

        # Build sorted parts list for CompleteMultipartUpload
        parts = [
            {"PartNumber": i + 1, "ETag": etags[str(i)]}
            for i in range(total_chunks)
        ]
        await r2_complete_multipart_upload(r2_key, r2_upload_id, parts)
        r2_key_final = r2_key
        logger.info(
            "complete_chunked_upload: R2 upload_id=%s file_id=%s path=%s size=%d",
            upload_id, file_id, virtual_path, data["total_size"],
        )
    else:
        tmp = Path(data["local_tmp_path"])
        storage_key = f"{current_user.id}/{file_id}/{data['filename']}"
        final = _local_path(storage_key)
        final.parent.mkdir(parents=True, exist_ok=True)
        # Atomic rename — safe even if process crashes after this point
        os.replace(tmp, final)
        logger.info(
            "complete_chunked_upload: local upload_id=%s file_id=%s path=%s",
            upload_id, file_id, virtual_path,
        )

    # Write permanent file_records document
    file_data = {
        "id": file_id,
        "name": data["filename"],
        "path": virtual_path,
        "parent_path": virtual_path.rsplit("/", 1)[0] if "/" in virtual_path else "",
        "type": "file",
        "size": data["total_size"],
        "mime_type": data.get("mime_type", "application/octet-stream"),
        "owner_id": current_user.id,
        "r2_key": r2_key_final,
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("file_records").document(file_id).set(file_data)

    # Remove the upload session — no longer needed
    doc_ref.delete()

    return _doc_to_response(file_id, file_data)


# ---------------------------------------------------------------------------
# DELETE /upload/abort/{upload_id}
# ---------------------------------------------------------------------------

@router.delete("/abort/{upload_id}", status_code=204)
async def abort_chunked_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> None:
    """Abort a chunked upload and free all associated storage.

    For R2: calls AbortMultipartUpload to release all uploaded parts.
    For local disk: deletes the temp file.

    Always call this when a chunked upload is cancelled or permanently fails.
    R2 charges for storage used by incomplete multipart uploads until aborted.
    """
    doc_ref, data = _get_session(upload_id, db, current_user)

    if _use_r2():
        r2_key = data.get("r2_key")
        r2_upload_id = data.get("r2_upload_id")
        if r2_key and r2_upload_id:
            try:
                await r2_abort_multipart_upload(r2_key, r2_upload_id)
            except Exception as exc:
                logger.warning(
                    "abort_chunked_upload: R2 abort failed upload_id=%s: %s",
                    upload_id, exc,
                )
    else:
        tmp_path = data.get("local_tmp_path")
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception as exc:
                logger.warning(
                    "abort_chunked_upload: temp file deletion failed upload_id=%s: %s",
                    upload_id, exc,
                )

    doc_ref.update({"status": "aborted", "updated_at": _now()})
    logger.info(
        "abort_chunked_upload: user=%s upload_id=%s",
        current_user.id, upload_id,
    )
