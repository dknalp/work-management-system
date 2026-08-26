"""Google Drive import routes for /api/v1/files.

Streams progress to the client via Server-Sent Events (SSE) when importing
a folder.  Single-file imports return a ``FileRecordResponse`` directly.

Google Drive authentication uses the OAuth access token provided by the
client (obtained client-side via the Firebase / Google auth flow).  The
backend never stores the access token.
"""

import io
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
from app.r2 import r2_upload_fileobj
from app.routers.v1.files_utils import (
    DriveImportBody,
    DriveImportFolderResult,
    DriveFolderImportBody,
    FileRecordResponse,
    _build_path,
    _doc_to_response,
    _local_path,
    _now,
    _use_r2,
)

router = APIRouter()
_log = logging.getLogger(__name__)


def _ensure_folder(path: str, parent_path: str, owner_id: str, db: firestore.Client) -> None:
    """Create a folder document in Firestore if it does not already exist."""
    docs = list(
        db.collection("file_records")
        .where("path", "==", path)
        .where("is_deleted", "==", False)
        .limit(1)
        .stream()
    )
    if docs:
        return
    fid = str(uuid.uuid4())
    now = _now()
    db.collection("file_records").document(fid).set({
        "owner_id": owner_id,
        "name": path.rsplit("/", 1)[-1] if "/" in path else path,
        "path": path,
        "parent_path": parent_path,
        "type": "folder",
        "size": None,
        "mime_type": None,
        "r2_key": None,
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "color": None,
        "icon_emoji": None,
        "created_at": now,
        "updated_at": now,
    })


async def _store_file_bytes(
    buf: io.BytesIO, r2_key: str, mime_type: str
) -> None:
    """Write file bytes to R2 or local disk."""
    if _use_r2():
        await r2_upload_fileobj(buf, r2_key, mime_type)
    else:
        local = _local_path(r2_key)
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_bytes(buf.read())


@router.post("/import-from-drive")
async def import_from_drive(
    body: DriveImportBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse | DriveImportFolderResult:
    """Import a single file or folder from Google Drive.

    Folder imports are recursive; progress is streamed via SSE from a
    separate ``/drive/import`` endpoint when the client prefers streaming.
    This endpoint returns a summary response directly.
    """
    from app.google_drive import download_drive_file, get_drive_file_info, list_drive_folder

    if body.is_folder:
        try:
            folder_info = await get_drive_file_info(body.access_token, body.file_id)
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to fetch folder metadata from Drive.")

        parent = body.parent_path.strip("/")
        folder_dest = _build_path(parent, folder_info.name)
        _ensure_folder(folder_dest, parent, current_user.id, db)

        try:
            drive_files = await list_drive_folder(body.access_token, body.file_id)
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to list Drive folder.")

        imported, skipped, errors = 0, 0, []

        for file_info, rel_path in drive_files:
            dest_path = _build_path(folder_dest, rel_path)
            parts = rel_path.split("/")
            dest_parent = _build_path(folder_dest, "/".join(parts[:-1])) if len(parts) > 1 else folder_dest

            # Ensure all intermediate folder documents exist
            if len(parts) > 1:
                cumulative = folder_dest
                for part in parts[:-1]:
                    cumulative = _build_path(cumulative, part)
                    upper = cumulative.rsplit("/", 1)[0] if "/" in cumulative else ""
                    _ensure_folder(cumulative, upper, current_user.id, db)

            # Check for existing file at this path
            existing_docs = list(
                db.collection("file_records")
                .where("path", "==", dest_path)
                .where("is_deleted", "==", False)
                .limit(1)
                .stream()
            )
            existing_doc = existing_docs[0] if existing_docs else None

            if existing_doc and not body.overwrite:
                skipped += 1
                continue

            try:
                buf, actual_size = await download_drive_file(
                    body.access_token, file_info.file_id, file_info.original_mime
                )
            except Exception:
                errors.append(file_info.name)
                continue

            new_id = str(uuid.uuid4())
            r2_key = f"shared/{new_id}"
            try:
                await _store_file_bytes(buf, r2_key, file_info.mime_type)
            except Exception:
                errors.append(file_info.name)
                continue

            now = _now()
            if existing_doc and body.overwrite:
                existing_doc.reference.update({
                    "r2_key": r2_key,
                    "mime_type": file_info.mime_type,
                    "size": actual_size,
                    "updated_at": now,
                })
            else:
                db.collection("file_records").document(new_id).set({
                    "owner_id": current_user.id,
                    "name": parts[-1],
                    "path": dest_path,
                    "parent_path": dest_parent,
                    "type": "file",
                    "size": actual_size,
                    "mime_type": file_info.mime_type,
                    "r2_key": r2_key,
                    "is_deleted": False,
                    "deleted_at": None,
                    "is_starred": False,
                    "color": None,
                    "icon_emoji": None,
                    "created_at": now,
                    "updated_at": now,
                })
            imported += 1

        return DriveImportFolderResult(
            folder_name=folder_info.name,
            imported=imported,
            skipped=skipped,
            errors=errors,
        )

    # Single file import
    try:
        from app.google_drive import download_drive_file, get_drive_file_info
        info = await get_drive_file_info(body.access_token, body.file_id)
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to fetch file info from Drive.")

    parent = body.parent_path.strip("/")
    dest_path = _build_path(parent, info.name)

    existing_docs = list(
        db.collection("file_records")
        .where("path", "==", dest_path)
        .where("is_deleted", "==", False)
        .limit(1)
        .stream()
    )
    existing_doc = existing_docs[0] if existing_docs else None

    if existing_doc and not body.overwrite:
        return _doc_to_response(existing_doc.id, existing_doc.to_dict() or {})

    try:
        buf, actual_size = await download_drive_file(body.access_token, body.file_id, info.original_mime)
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to download file from Drive.")

    file_id = str(uuid.uuid4())
    r2_key = f"shared/{file_id}"
    await _store_file_bytes(buf, r2_key, info.mime_type)

    now = _now()
    data = {
        "owner_id": current_user.id,
        "name": info.name,
        "path": dest_path,
        "parent_path": parent,
        "type": "file",
        "size": actual_size,
        "mime_type": info.mime_type,
        "r2_key": r2_key,
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "color": None,
        "icon_emoji": None,
        "created_at": now,
        "updated_at": now,
    }

    if existing_doc and body.overwrite:
        existing_doc.reference.update({**data})
        return _doc_to_response(existing_doc.id, {**(existing_doc.to_dict() or {}), **data})

    db.collection("file_records").document(file_id).set(data)
    return _doc_to_response(file_id, data)


@router.post("/drive/import")
async def drive_folder_import_sse(
    body: DriveFolderImportBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> StreamingResponse:
    """Import a Google Drive folder with progress streamed via SSE."""
    from app.google_drive import download_drive_file, get_drive_file_info, list_drive_folder

    async def event_stream():
        try:
            folder_info = await get_drive_file_info(body.access_token, body.folder_id)
        except Exception:
            yield "data: {\"type\": \"error\", \"detail\": \"Failed to fetch folder info\"}\n\n"
            return

        parent = body.parent_path.strip("/")
        folder_dest = _build_path(parent, folder_info.name)
        _ensure_folder(folder_dest, parent, current_user.id, db)
        yield f"data: {{\"type\": \"folder\", \"name\": \"{folder_info.name}\"}}\n\n"

        try:
            drive_files = await list_drive_folder(body.access_token, body.folder_id)
        except Exception:
            yield "data: {\"type\": \"error\", \"detail\": \"Failed to list folder\"}\n\n"
            return

        total = len(drive_files)
        imported = 0

        for file_info, rel_path in drive_files:
            dest_path = _build_path(folder_dest, rel_path)
            parts = rel_path.split("/")
            dest_parent = _build_path(folder_dest, "/".join(parts[:-1])) if len(parts) > 1 else folder_dest

            if len(parts) > 1:
                cumulative = folder_dest
                for part in parts[:-1]:
                    cumulative = _build_path(cumulative, part)
                    upper = cumulative.rsplit("/", 1)[0] if "/" in cumulative else ""
                    _ensure_folder(cumulative, upper, current_user.id, db)

            existing_docs = list(
                db.collection("file_records")
                .where("path", "==", dest_path)
                .where("is_deleted", "==", False)
                .limit(1)
                .stream()
            )
            existing_doc = existing_docs[0] if existing_docs else None
            if existing_doc and not body.overwrite:
                yield f"data: {{\"type\": \"skip\", \"name\": \"{file_info.name}\"}}\n\n"
                continue

            try:
                buf, actual_size = await download_drive_file(
                    body.access_token, file_info.file_id, file_info.original_mime
                )
            except Exception:
                yield f"data: {{\"type\": \"error\", \"detail\": \"Failed to download {file_info.name}\"}}\n\n"
                continue

            new_id = str(uuid.uuid4())
            r2_key = f"shared/{new_id}"
            try:
                await _store_file_bytes(buf, r2_key, file_info.mime_type)
            except Exception:
                yield f"data: {{\"type\": \"error\", \"detail\": \"Failed to store {file_info.name}\"}}\n\n"
                continue

            now = _now()
            if existing_doc and body.overwrite:
                existing_doc.reference.update({
                    "r2_key": r2_key,
                    "mime_type": file_info.mime_type,
                    "size": actual_size,
                    "updated_at": now,
                })
            else:
                db.collection("file_records").document(new_id).set({
                    "owner_id": current_user.id,
                    "name": parts[-1],
                    "path": dest_path,
                    "parent_path": dest_parent,
                    "type": "file",
                    "size": actual_size,
                    "mime_type": file_info.mime_type,
                    "r2_key": r2_key,
                    "is_deleted": False,
                    "deleted_at": None,
                    "is_starred": False,
                    "color": None,
                    "icon_emoji": None,
                    "created_at": now,
                    "updated_at": now,
                })

            imported += 1
            yield f"data: {{\"type\": \"progress\", \"name\": \"{file_info.name}\", \"imported\": {imported}, \"total\": {total}}}\n\n"

        yield f"data: {{\"type\": \"done\", \"imported\": {imported}, \"total\": {total}}}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")