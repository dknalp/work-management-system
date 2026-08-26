"""Miscellaneous file routes for /api/v1/files.

Handles: zip download of multiple files, raw preview, and patch (metadata
partial update).  These routes did not fit cleanly into the core, trash,
share, or bulk modules.
"""

import io
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
from app.routers.v1.files_utils import (
    FileRecordResponse,
    ZipBody,
    _assert_owner,
    _doc_to_response,
    _get_record_or_404,
    _local_path,
    _now,
    _use_r2,
)

router = APIRouter()


@router.post("/zip-download")
async def zip_download(
    body: ZipBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Stream a ZIP archive containing the requested files.

    R2 mode: downloads each file from R2 and streams the zip.
    Local mode: reads from disk directly.
    """
    if _use_r2():
        from app.r2 import r2_download_fileobj

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for fid in body.ids:
                try:
                    _, data = _get_record_or_404(fid, db)
                    if data.get("owner_id") != current_user.id:
                        continue
                    r2_key = data.get("r2_key")
                    if not r2_key or data.get("type") != "file":
                        continue
                    file_bytes = await r2_download_fileobj(r2_key)
                    zf.writestr(data["name"], file_bytes)
                except Exception:
                    continue

        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=download.zip"},
        )

    # Local disk mode
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fid in body.ids:
            try:
                _, data = _get_record_or_404(fid, db)
                if data.get("owner_id") != current_user.id:
                    continue
                r2_key = data.get("r2_key")
                if not r2_key or data.get("type") != "file":
                    continue
                local = _local_path(r2_key)
                if local.exists():
                    zf.write(local, arcname=data["name"])
            except Exception:
                continue

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=download.zip"},
    )


@router.get("/raw/{file_id}")
async def raw_preview(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Serve the raw file bytes with the correct Content-Type for browser preview."""
    _, data = _get_record_or_404(file_id, db)
    _assert_owner(data, current_user.id)
    r2_key = data.get("r2_key")
    if not r2_key or data.get("type") != "file":
        raise HTTPException(status_code=400, detail="Cannot preview a folder.")

    mime = data.get("mime_type") or "application/octet-stream"

    if _use_r2():
        from app.r2 import r2_download_fileobj
        content = await r2_download_fileobj(r2_key)
        return StreamingResponse(io.BytesIO(content), media_type=mime)

    local = _local_path(r2_key)
    if not local.exists():
        raise HTTPException(status_code=404, detail="File not found on disk.")

    return StreamingResponse(
        open(local, "rb"),
        media_type=mime,
    )


@router.patch("/{file_id}", response_model=FileRecordResponse)
def patch_metadata(
    file_id: str,
    body: dict = Body(default={}),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Partially update allowed metadata fields: color, icon_emoji, is_starred."""
    _, data = _get_record_or_404(file_id, db)
    allowed = {"is_starred", "color", "icon_emoji"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return _doc_to_response(file_id, data)
    updates["updated_at"] = _now()
    db.collection("file_records").document(file_id).update(updates)
    return _doc_to_response(file_id, {**data, **updates})