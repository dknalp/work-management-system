"""Google Drive import routes for /api/v1/files."""

import io
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_current_user
from app.models import FileRecord, User
from app.r2 import r2_upload_fileobj
from app.routers.v1.files_utils import (
    DriveImportBody,
    DriveImportFolderResult,
    DriveFolderImportBody,
    FileRecordResponse,
    _build_path,
    _get_record_or_404,
    _local_path,
    _now,
    _to_response,
    _use_r2,
)

router = APIRouter()
_log = logging.getLogger(__name__)

# MIME resolution for Google Workspace documents is handled entirely by
# app.google_drive._GWORKSPACE_EXPORT — there is no local copy here.


@router.post("/import-from-drive")
async def import_from_drive(
    body: DriveImportBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse | DriveImportFolderResult:
    """Import a single file or folder from Google Drive."""
    from app.google_drive import download_drive_file, get_drive_file_info, list_drive_folder

    if body.is_folder:
        # Folder branch
        try:
            folder_info = await get_drive_file_info(body.access_token, body.file_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Failed to fetch folder metadata")

        parent = body.parent_path.strip("/")
        folder_dest = _build_path(parent, folder_info.name)

        existing_folder = session.exec(
            select(FileRecord).where(FileRecord.path == folder_dest, FileRecord.is_deleted == False)  # noqa: E712
        ).first()
        if not existing_folder:
            session.add(FileRecord(
                id=uuid.uuid4(), owner_id=current_user.id,
                name=folder_info.name, path=folder_dest,
                parent_path=parent, type="folder", size=0,
            ))
            session.commit()

        try:
            drive_files = await list_drive_folder(body.access_token, body.file_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Failed to list Drive folder")

        imported, skipped, errors = 0, 0, []
        for file_info, rel_path in drive_files:
            dest_path = _build_path(folder_dest, rel_path)
            parts = rel_path.split("/")
            dest_parent = _build_path(folder_dest, "/".join(parts[:-1])) if len(parts) > 1 else folder_dest

            # Ensure intermediate folders
            if len(parts) > 1:
                cumulative = folder_dest
                for part in parts[:-1]:
                    cumulative = _build_path(cumulative, part)
                    if not session.exec(select(FileRecord).where(FileRecord.path == cumulative, FileRecord.is_deleted == False)).first():  # noqa: E712
                        session.add(FileRecord(
                            id=uuid.uuid4(), owner_id=current_user.id,
                            name=part, path=cumulative,
                            parent_path=str(Path(cumulative).parent) if "/" in cumulative else folder_dest,
                            type="folder", size=0,
                        ))
                        session.commit()

            existing_file = session.exec(
                select(FileRecord).where(FileRecord.path == dest_path, FileRecord.is_deleted == False)  # noqa: E712
            ).first()
            if existing_file and not body.overwrite:
                skipped += 1
                continue

            try:
                buf, actual_size = await download_drive_file(body.access_token, file_info.file_id, file_info.original_mime)
            except Exception:
                errors.append(file_info.name)
                continue

            new_id = uuid.uuid4()
            r2_key = f"shared/{new_id}"
            try:
                if _use_r2():
                    await r2_upload_fileobj(buf, r2_key, file_info.mime_type)
                else:
                    disk_path = _local_path(r2_key)
                    disk_path.parent.mkdir(parents=True, exist_ok=True)
                    disk_path.write_bytes(buf.read())
            except Exception:
                errors.append(file_info.name)
                continue

            if existing_file and body.overwrite:
                existing_file.r2_key = r2_key
                existing_file.mime_type = file_info.mime_type
                existing_file.size = actual_size
                existing_file.updated_at = _now()
                session.add(existing_file)
            else:
                session.add(FileRecord(
                    id=new_id, owner_id=current_user.id,
                    name=parts[-1], path=dest_path,
                    parent_path=dest_parent, type="file",
                    size=actual_size, mime_type=file_info.mime_type, r2_key=r2_key,
                ))
            session.commit()
            imported += 1

        return DriveImportFolderResult(
            folder_name=folder_info.name, imported=imported, skipped=skipped, errors=errors,
        )

    # Single file branch
    try:
        from app.google_drive import download_drive_file, get_drive_file_info
        info = await get_drive_file_info(body.access_token, body.file_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Drive file metadata: {exc}")

    original_mime = info.original_mime
    resolved_mime = info.mime_type
    name = info.name
    parent = body.parent_path.strip("/")
    dest_path = _build_path(parent, name)

    existing = session.exec(
        select(FileRecord).where(FileRecord.path == dest_path, FileRecord.is_deleted == False)  # noqa: E712
    ).first()
    if existing and not body.overwrite:
        raise HTTPException(status_code=409, detail="File already exists")

    try:
        from app.google_drive import download_drive_file
        buf, actual_size = await download_drive_file(body.access_token, body.file_id, original_mime)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download from Drive: {exc}")

    new_id = uuid.uuid4()
    r2_key = f"shared/{new_id}"
    if _use_r2():
        await r2_upload_fileobj(buf, r2_key, resolved_mime)
    else:
        disk_path = _local_path(r2_key)
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        disk_path.write_bytes(buf.read())

    if existing and body.overwrite:
        existing.r2_key = r2_key
        existing.mime_type = resolved_mime
        existing.size = actual_size
        existing.updated_at = _now()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _to_response(existing)

    record = FileRecord(
        id=new_id, owner_id=current_user.id,
        name=name, path=dest_path, parent_path=parent,
        type="file", size=actual_size, mime_type=resolved_mime, r2_key=r2_key,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.post("/import-folder-stream")
async def import_folder_stream(
    body: DriveFolderImportBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """SSE stream that imports a Drive folder and reports progress."""
    import json as _json
    from app.google_drive import download_drive_file, get_drive_file_info, list_drive_folder

    async def event_stream():
        try:
            folder_info = await get_drive_file_info(body.access_token, body.folder_id)
        except Exception as exc:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return

        parent = body.parent_path.strip("/")
        folder_dest = _build_path(parent, folder_info.name)

        if not session.exec(select(FileRecord).where(FileRecord.path == folder_dest, FileRecord.is_deleted == False)).first():  # noqa: E712
            session.add(FileRecord(
                id=uuid.uuid4(), owner_id=current_user.id,
                name=folder_info.name, path=folder_dest,
                parent_path=parent, type="folder", size=0,
            ))
            session.commit()

        try:
            drive_files = await list_drive_folder(body.access_token, body.folder_id)
        except Exception as exc:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return

        total = len(drive_files)
        yield f"data: {_json.dumps({'type': 'start', 'total': total, 'folder': folder_info.name})}\n\n"

        imported, skipped, errors = 0, 0, []

        for idx, (file_info, rel_path) in enumerate(drive_files):
            dest_path = _build_path(folder_dest, rel_path)
            parts = rel_path.split("/")
            dest_parent = _build_path(folder_dest, "/".join(parts[:-1])) if len(parts) > 1 else folder_dest

            if len(parts) > 1:
                cumulative = folder_dest
                for part in parts[:-1]:
                    cumulative = _build_path(cumulative, part)
                    if not session.exec(select(FileRecord).where(FileRecord.path == cumulative, FileRecord.is_deleted == False)).first():  # noqa: E712
                        session.add(FileRecord(
                            id=uuid.uuid4(), owner_id=current_user.id, name=part,
                            path=cumulative,
                            parent_path=str(Path(cumulative).parent) if "/" in cumulative else folder_dest,
                            type="folder", size=0,
                        ))
                        session.commit()

            existing_file = session.exec(
                select(FileRecord).where(FileRecord.path == dest_path, FileRecord.is_deleted == False)  # noqa: E712
            ).first()
            if existing_file and not body.overwrite:
                skipped += 1
                yield f"data: {_json.dumps({'type': 'progress', 'done': idx+1, 'total': total, 'name': file_info.name, 'skipped': True})}\n\n"
                continue

            try:
                buf, actual_size = await download_drive_file(body.access_token, file_info.file_id, file_info.original_mime)
            except Exception:
                errors.append(file_info.name)
                yield f"data: {_json.dumps({'type': 'progress', 'done': idx+1, 'total': total, 'name': file_info.name, 'error': True})}\n\n"
                continue

            new_id = uuid.uuid4()
            r2_key = f"shared/{new_id}"
            try:
                if _use_r2():
                    await r2_upload_fileobj(buf, r2_key, file_info.mime_type)
                else:
                    disk_path = _local_path(r2_key)
                    disk_path.parent.mkdir(parents=True, exist_ok=True)
                    disk_path.write_bytes(buf.read())
            except Exception:
                errors.append(file_info.name)
                yield f"data: {_json.dumps({'type': 'progress', 'done': idx+1, 'total': total, 'name': file_info.name, 'error': True})}\n\n"
                continue

            if existing_file and body.overwrite:
                existing_file.r2_key = r2_key
                existing_file.mime_type = file_info.mime_type
                existing_file.size = actual_size
                existing_file.updated_at = _now()
                session.add(existing_file)
            else:
                session.add(FileRecord(
                    id=new_id, owner_id=current_user.id, name=parts[-1],
                    path=dest_path, parent_path=dest_parent,
                    type="file", size=actual_size,
                    mime_type=file_info.mime_type, r2_key=r2_key,
                ))
            session.commit()
            imported += 1
            yield f"data: {_json.dumps({'type': 'progress', 'done': idx+1, 'total': total, 'name': file_info.name})}\n\n"

        yield f"data: {_json.dumps({'type': 'done', 'imported': imported, 'skipped': skipped, 'errors': errors})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            # Allow EventSource connections from any origin (the CORS middleware
            # on the FastAPI app covers standard requests, but StreamingResponse
            # bypasses it for SSE — so we set the header explicitly here).
            "Access-Control-Allow-Origin": "*",
        },
    )