"""Presigned-URL upload endpoints for direct browser-to-R2 uploads.

The backend never touches file bytes — it only:
  1. Verifies auth
  2. Writes/updates Firestore metadata (status="pending")
  3. Returns presigned R2 PUT URLs
  4. On confirm: flips status to "active"

Router prefix: /files  (registered before files_core in main.py)
Full paths:
  POST /api/v1/files/presign/batch
  POST /api/v1/files/confirm/{file_id}
  POST /api/v1/files/presign/multipart/init
  POST /api/v1/files/presign/multipart/complete
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
from app.r2 import (
    r2_presign_put,
    r2_presign_multipart_part,
    r2_create_multipart_upload,
    r2_complete_multipart_upload,
)
from app.routers.v1.files_utils import (
    FileRecordResponse,
    PresignBatchItem,
    PresignBatchResult,
    ConfirmUploadRequest,
    MultipartInitRequest,
    MultipartInitResponse,
    MultipartCompleteRequest,
    _doc_to_response,
    make_file_id,
    _use_r2,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/files", tags=["v1-files-presign"])

PRESIGN_TTL_SECONDS = 3600       # presigned URLs valid for 1 hour
MAX_BATCH_SIZE = 50              # max files per batch presign request
MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024  # 5 MiB per part


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_r2_key(owner_id: str, file_id: str) -> str:
    return f"files/{owner_id}/{file_id}"


# ---------------------------------------------------------------------------
# POST /files/presign/batch
# ---------------------------------------------------------------------------

@router.post("/presign/batch", response_model=list[PresignBatchResult], status_code=200)
async def presign_batch(
    items: list[PresignBatchItem],
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> list[PresignBatchResult]:
    """Return presigned PUT URLs for up to 50 files in one request.

    For each file:
    - Computes a deterministic file_id from (owner_id, virtual_path)
    - Checks for existing active record — returns conflict=True if overwrite=False
    - Writes a pending Firestore record (idempotent set with merge)
    - Returns a presigned R2 PUT URL valid for 1 hour

    This endpoint never touches file bytes.
    """
    if not _use_r2():
        raise HTTPException(
            status_code=501,
            detail="Direct R2 upload not available — R2 is not configured.",
        )

    if len(items) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size exceeds maximum of {MAX_BATCH_SIZE}.",
        )

    now = _now()
    expires_at = now + timedelta(seconds=PRESIGN_TTL_SECONDS)
    results: list[PresignBatchResult] = []

    for item in items:
        # Build virtual path (parent_path/filename)
        virtual_path = f"{item.path}/{item.filename}".lstrip("/") if item.path else item.filename
        file_id = make_file_id(current_user.id, virtual_path)
        r2_key = _make_r2_key(current_user.id, file_id)

        # Check for existing active record
        existing = db.collection("file_records").document(file_id).get()
        if existing.exists:
            existing_data = existing.to_dict() or {}
            if existing_data.get("status") == "active" and not item.overwrite:
                results.append(PresignBatchResult(
                    file_id=file_id,
                    upload_url="",
                    r2_key=r2_key,
                    expires_at=expires_at.isoformat(),
                    conflict=True,
                ))
                continue

        # Write pending Firestore record (idempotent — set with merge)
        parent_path = item.path.strip("/") if item.path else ""
        record = {
            "id": file_id,
            "name": item.filename,
            "path": virtual_path,
            "parent_path": parent_path,
            "type": "file",
            "size": item.size,
            "mime_type": item.mime_type,
            "r2_key": r2_key,
            "owner_id": current_user.id,
            "status": "pending",
            "is_deleted": False,
            "deleted_at": None,
            "is_starred": False,
            "color": None,
            "icon_emoji": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        db.collection("file_records").document(file_id).set(record, merge=True)

        # Generate presigned PUT URL (sync — boto3 doesn't need async for signing)
        upload_url = r2_presign_put(r2_key, item.mime_type, PRESIGN_TTL_SECONDS)

        logger.info(
            "presign_batch: user=%s file_id=%s path=%s size=%d",
            current_user.id, file_id, virtual_path, item.size,
        )

        results.append(PresignBatchResult(
            file_id=file_id,
            upload_url=upload_url,
            r2_key=r2_key,
            expires_at=expires_at.isoformat(),
            conflict=False,
        ))

    return results


# ---------------------------------------------------------------------------
# POST /files/confirm/{file_id}
# ---------------------------------------------------------------------------

@router.post("/confirm/{file_id}", response_model=FileRecordResponse)
def confirm_upload(
    file_id: str,
    body: ConfirmUploadRequest = None,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Mark a presigned upload as complete.

    Called by the browser after a successful PUT to R2.
    Flips status from "pending" to "active" in Firestore.
    """
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File record not found.")

    data = doc.to_dict() or {}
    if data.get("owner_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    now = _now()
    updates: dict = {"status": "active", "updated_at": now.isoformat()}
    if body and body.size is not None:
        updates["size"] = body.size

    db.collection("file_records").document(file_id).update(updates)

    logger.info("confirm_upload: user=%s file_id=%s", current_user.id, file_id)
    return _doc_to_response(file_id, {**data, **updates})


# ---------------------------------------------------------------------------
# POST /files/presign/multipart/init
# ---------------------------------------------------------------------------

@router.post("/presign/multipart/init", response_model=MultipartInitResponse, status_code=201)
async def presign_multipart_init(
    body: MultipartInitRequest,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> MultipartInitResponse:
    """Initialise a multipart upload for files larger than 100 MB.

    Creates the R2 multipart upload, presigns all part URLs at once, and
    writes a pending Firestore record. The browser then PUTs each part
    directly to its presigned URL and calls /presign/multipart/complete.
    """
    if not _use_r2():
        raise HTTPException(status_code=501, detail="R2 not configured.")

    virtual_path = f"{body.path}/{body.filename}".lstrip("/") if body.path else body.filename
    file_id = make_file_id(current_user.id, virtual_path)
    r2_key = _make_r2_key(current_user.id, file_id)

    # Create R2 multipart upload
    upload_id = await r2_create_multipart_upload(r2_key, body.mime_type)

    # Presign all part URLs (1-indexed, as required by R2/S3)
    part_urls = [
        r2_presign_multipart_part(r2_key, upload_id, i + 1, PRESIGN_TTL_SECONDS)
        for i in range(body.total_parts)
    ]

    # Write pending Firestore record
    now = _now()
    parent_path = body.path.strip("/") if body.path else ""
    record = {
        "id": file_id,
        "name": body.filename,
        "path": virtual_path,
        "parent_path": parent_path,
        "type": "file",
        "size": body.size,
        "mime_type": body.mime_type,
        "r2_key": r2_key,
        "owner_id": current_user.id,
        "status": "pending",
        "multipart_upload_id": upload_id,
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "color": None,
        "icon_emoji": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    db.collection("file_records").document(file_id).set(record, merge=True)

    logger.info(
        "presign_multipart_init: user=%s file_id=%s parts=%d size=%d",
        current_user.id, file_id, body.total_parts, body.size,
    )

    return MultipartInitResponse(
        file_id=file_id,
        upload_id=upload_id,
        r2_key=r2_key,
        part_urls=part_urls,
    )


# ---------------------------------------------------------------------------
# POST /files/presign/multipart/complete
# ---------------------------------------------------------------------------

@router.post("/presign/multipart/complete", response_model=FileRecordResponse)
async def presign_multipart_complete(
    body: MultipartCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Finalise a multipart upload after all parts have been PUT to R2.

    Tells R2 to assemble the parts and flips Firestore status to "active".
    """
    doc = db.collection("file_records").document(body.file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File record not found.")

    data = doc.to_dict() or {}
    if data.get("owner_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    r2_key = data.get("r2_key")
    if not r2_key:
        raise HTTPException(status_code=400, detail="No R2 key on record.")

    # Tell R2 to assemble the parts
    parts = [
        {"PartNumber": p["part_number"], "ETag": p["etag"]}
        for p in body.parts
    ]
    await r2_complete_multipart_upload(r2_key, body.upload_id, parts)

    # Flip status to active
    now = _now()
    updates = {
        "status": "active",
        "updated_at": now.isoformat(),
        "multipart_upload_id": None,
    }
    db.collection("file_records").document(body.file_id).update(updates)

    logger.info(
        "presign_multipart_complete: user=%s file_id=%s parts=%d",
        current_user.id, body.file_id, len(body.parts),
    )
    return _doc_to_response(body.file_id, {**data, **updates})
