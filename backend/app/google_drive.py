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

# How many times to retry a single Drive API call on transient errors.
_MAX_RETRIES = 2
# Seconds to wait between retries.
_RETRY_SLEEP = 1.0
# HTTP status codes that indicate a transient server-side problem worth retrying.
_RETRYABLE_STATUSES = {429, 503}

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


async def _list_folder_page(
    client: httpx.AsyncClient,
    access_token: str,
    folder_id: str,
    page_token: str | None,
) -> dict:
    """Fetch a single page of Drive folder contents with retry on transient errors.

    Args:
        client: Shared httpx async client for the current request.
        access_token: Short-lived Google OAuth token with drive.readonly scope.
        folder_id: Drive folder ID to query.
        page_token: Continuation token for pagination, or None for the first page.

    Returns:
        Parsed JSON response dict containing "files" and optional "nextPageToken".

    Raises:
        httpx.HTTPStatusError: If all retries are exhausted or a non-retryable
            error status is returned.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    params: dict[str, str] = {
        "q": f"'{folder_id}' in parents and trashed = false",
        "fields": "nextPageToken,files(id,name,mimeType,size)",
        "supportsAllDrives": "true",
        "includeItemsFromAllDrives": "true",
        "pageSize": "200",
    }
    if page_token:
        params["pageToken"] = page_token

    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = await client.get(f"{DRIVE_API}/files", headers=headers, params=params)
            if resp.status_code in _RETRYABLE_STATUSES and attempt < _MAX_RETRIES:
                logger.warning(
                    "Drive API transient error %d for folder %s — retry %d/%d",
                    resp.status_code, folder_id, attempt + 1, _MAX_RETRIES,
                )
                await asyncio.sleep(_RETRY_SLEEP)
                continue
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            if exc.response.status_code in _RETRYABLE_STATUSES and attempt < _MAX_RETRIES:
                logger.warning(
                    "Drive API transient error %d for folder %s — retry %d/%d",
                    exc.response.status_code, folder_id, attempt + 1, _MAX_RETRIES,
                )
                await asyncio.sleep(_RETRY_SLEEP)
            else:
                raise

    # Should only be reached if all retries were consumed without re-raising.
    raise last_exc  # type: ignore[misc]


async def list_drive_folder(
    access_token: str,
    folder_id: str,
    relative_prefix: str = "",
) -> list[tuple["DriveFileInfo", str]]:
    """Recursively list all non-folder files inside a Drive folder.

    Sub-folders are enumerated concurrently using asyncio.gather so that
    deeply nested or wide directory trees are not serialised.

    Returns a list of (DriveFileInfo, relative_path) tuples where
    relative_path is the path relative to the top-level folder root
    (e.g. "subdir/file.txt").  Folders themselves are not included —
    only leaf files that need to be downloaded.
    """
    leaf_files: list[tuple[DriveFileInfo, str]] = []
    sub_folder_tasks: list[tuple[str, str]] = []  # (sub_folder_id, rel_path)
    page_token: str | None = None

    async with httpx.AsyncClient(timeout=60) as client:
        # Paginate through all items in this folder level.
        while True:
            data = await _list_folder_page(client, access_token, folder_id, page_token)

            for item in data.get("files", []):
                mime: str = item.get("mimeType", "application/octet-stream")
                name: str = item.get("name", "untitled")
                item_id: str = item["id"]
                rel_path = f"{relative_prefix}/{name}" if relative_prefix else name

                if mime == "application/vnd.google-apps.folder":
                    # Collect for concurrent recursion below.
                    sub_folder_tasks.append((item_id, rel_path))
                else:
                    # Resolve export name/mime for Workspace docs.
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
                    leaf_files.append((info, rel_path))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    # Fan out sub-folder listing concurrently instead of awaiting one-by-one.
    # Each coroutine opens its own httpx client, keeping connections isolated.
    if sub_folder_tasks:
        sub_results: list[list[tuple[DriveFileInfo, str]]] = await asyncio.gather(
            *(list_drive_folder(access_token, sfid, sfpath) for sfid, sfpath in sub_folder_tasks)
        )
        for sub in sub_results:
            leaf_files.extend(sub)

    logger.info(
        "Drive folder listed: folder_id=%s files=%d",
        folder_id, len(leaf_files),
    )
    return leaf_files


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