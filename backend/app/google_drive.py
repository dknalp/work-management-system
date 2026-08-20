"""Google Drive API helpers — import-only integration.

Uses httpx (already in requirements) for all HTTP calls instead of the
google-api-python-client SDK. This avoids a 15 MB dependency that downloads
every Google API's discovery document.

Only the Drive v3 endpoints we need are called directly:
  - files.get (metadata)
  - files.get?alt=media (binary download)
  - files.export (Google Workspace doc export)

Authentication: we accept a short-lived OAuth access token supplied by the
frontend (via Google Identity Services + Picker). The token has
drive.readonly scope and is used only during the import request — never stored.
"""

import asyncio
import io
import logging

import httpx

logger = logging.getLogger(__name__)

DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_DOWNLOAD = "https://www.googleapis.com/download/drive/v3"

# ---------------------------------------------------------------------------
# Google Workspace MIME → (export MIME, extension suffix)
# ---------------------------------------------------------------------------
_GWORKSPACE_EXPORT: dict[str, tuple[str, str]] = {
    "application/vnd.google-apps.document": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".docx",
    ),
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx",
    ),
    "application/vnd.google-apps.presentation": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".pptx",
    ),
    "application/vnd.google-apps.drawing": ("image/png", ".png"),
    "application/vnd.google-apps.script": ("application/zip", ".zip"),
    "application/vnd.google-apps.form": ("application/zip", ".zip"),
}


class DriveFileInfo:
    """Resolved metadata about a Drive file ready for import."""

    __slots__ = ("file_id", "name", "mime_type", "original_mime", "size")

    def __init__(
        self,
        file_id: str,
        name: str,
        mime_type: str,
        original_mime: str,
        size: int,
    ) -> None:
        self.file_id = file_id
        self.name = name
        self.mime_type = mime_type          # resolved (export format if Workspace)
        self.original_mime = original_mime  # raw Drive mimeType
        self.size = size                    # 0 for Workspace docs (unknown until exported)


async def get_drive_file_info(access_token: str, file_id: str) -> DriveFileInfo:
    """Fetch Drive file metadata asynchronously via httpx."""
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {
        "fields": "id,name,mimeType,size",
        "supportsAllDrives": "true",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{DRIVE_API}/files/{file_id}",
            headers=headers,
            params=params,
        )
        resp.raise_for_status()

    meta = resp.json()
    original_mime: str = meta.get("mimeType", "application/octet-stream")
    name: str = meta.get("name", "untitled")

    if original_mime in _GWORKSPACE_EXPORT:
        resolved_mime, suffix = _GWORKSPACE_EXPORT[original_mime]
        if not name.endswith(suffix):
            name = name + suffix
        size = 0  # unknown until exported
    else:
        resolved_mime = original_mime
        try:
            size = int(meta.get("size", 0))
        except (TypeError, ValueError):
            size = 0

    logger.info(
        "Drive file resolved: id=%s name=%r mime=%s size=%d",
        file_id, name, resolved_mime, size,
    )
    return DriveFileInfo(
        file_id=file_id,
        name=name,
        mime_type=resolved_mime,
        original_mime=original_mime,
        size=size,
    )


async def list_drive_folder(
    access_token: str,
    folder_id: str,
    relative_prefix: str = "",
) -> list[tuple["DriveFileInfo", str]]:
    """Recursively list all non-folder files inside a Drive folder.

    Returns a list of (DriveFileInfo, relative_path) tuples where
    relative_path is the path relative to the top-level folder root
    (e.g. "subdir/file.txt").  Folders themselves are not included —
    only leaf files that need to be downloaded.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    results: list[tuple[DriveFileInfo, str]] = []
    page_token: str | None = None

    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            params: dict[str, str] = {
                "q": f"'{folder_id}' in parents and trashed = false",
                "fields": "nextPageToken,files(id,name,mimeType,size)",
                "supportsAllDrives": "true",
                "includeItemsFromAllDrives": "true",
                "pageSize": "200",
            }
            if page_token:
                params["pageToken"] = page_token

            resp = await client.get(
                f"{DRIVE_API}/files",
                headers=headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("files", []):
                mime: str = item.get("mimeType", "application/octet-stream")
                name: str = item.get("name", "untitled")
                item_id: str = item["id"]
                rel_path = f"{relative_prefix}/{name}" if relative_prefix else name

                if mime == "application/vnd.google-apps.folder":
                    # Recurse into sub-folder
                    sub = await list_drive_folder(access_token, item_id, rel_path)
                    results.extend(sub)
                else:
                    # Resolve export name/mime for Workspace docs
                    if mime in _GWORKSPACE_EXPORT:
                        resolved_mime, suffix = _GWORKSPACE_EXPORT[mime]
                        if not name.endswith(suffix):
                            rel_path = rel_path + suffix
                            name = name + suffix
                        size = 0
                    else:
                        resolved_mime = mime
                        try:
                            size = int(item.get("size", 0))
                        except (TypeError, ValueError):
                            size = 0

                    info = DriveFileInfo(
                        file_id=item_id,
                        name=name,
                        mime_type=resolved_mime,
                        original_mime=mime,
                        size=size,
                    )
                    results.append((info, rel_path))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    logger.info(
        "Drive folder listed: folder_id=%s files=%d",
        folder_id, len(results),
    )
    return results


async def download_drive_file(
    access_token: str,
    file_id: str,
    original_mime: str,
) -> tuple[io.BytesIO, int]:
    """Download a Drive file and return (BytesIO, actual_size_bytes).

    Google Workspace documents are exported to their Office equivalent.
    Binary files are downloaded directly.
    The buffer is positioned at byte 0 and ready for upload.
    """
    headers = {"Authorization": f"Bearer {access_token}"}

    if original_mime in _GWORKSPACE_EXPORT:
        export_mime, _ = _GWORKSPACE_EXPORT[original_mime]
        url = f"{DRIVE_API}/files/{file_id}/export"
        params: dict[str, str] = {"mimeType": export_mime}
    else:
        url = f"{DRIVE_DOWNLOAD}/files/{file_id}"
        params = {"alt": "media", "supportsAllDrives": "true"}

    async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
        async with client.stream("GET", url, headers=headers, params=params) as resp:
            resp.raise_for_status()
            buf = io.BytesIO()
            async for chunk in resp.aiter_bytes(chunk_size=8 * 1024 * 1024):
                buf.write(chunk)

    size = buf.tell()
    buf.seek(0)
    logger.info("Drive download complete: id=%s size=%d bytes", file_id, size)
    return buf, size