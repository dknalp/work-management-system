import json as _json
import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from ...deps import Actor, get_current_actor
from ...webhooks import fire_webhooks_simple

router = APIRouter(prefix="/files", tags=["v1-files"])


def _resolve_data_root() -> Path:
    # 1. Env var — always wins
    env = os.environ.get("FILE_STORAGE_PATH", "")
    if env:
        return Path(env).resolve()
    # 2. frontend/config/storage.json (custom path set via Admin UI)
    config_file = (
        Path(__file__).parent.parent.parent.parent.parent
        / "frontend" / "config" / "storage.json"
    )
    if config_file.exists():
        try:
            cfg = _json.loads(config_file.read_text())
            sp = cfg.get("storagePath", "")
            if sp:
                return Path(sp).resolve()
        except Exception:
            pass
    # 3. Default: work-management-system/data/ (same as frontend default)
    return (Path(__file__).parent.parent.parent.parent.parent / "data").resolve()


_DATA_ROOT = _resolve_data_root()


def _safe_path(rel_path: str) -> Path:
    base = _DATA_ROOT.resolve()
    target = (base / rel_path.lstrip("/")).resolve()
    if not str(target).startswith(str(base)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")
    return target


@router.get("")
def list_files(
    path: str = Query(default=""),
    actor: Actor = Depends(get_current_actor),
):
    target = _safe_path(path)
    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path not found")
    if not target.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is not a directory")

    items = []
    for entry in sorted(target.iterdir(), key=lambda e: (e.is_file(), e.name.lower())):
        stat = entry.stat()
        items.append({
            "name": entry.name,
            "path": str(entry.relative_to(_DATA_ROOT)),
            "type": "file" if entry.is_file() else "directory",
            "size": stat.st_size if entry.is_file() else None,
            "modified": stat.st_mtime,
        })
    return items


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    path: str = Query(default=""),
    actor: Actor = Depends(get_current_actor),
):
    target_dir = _safe_path(path)
    if not target_dir.exists():
        target_dir.mkdir(parents=True, exist_ok=True)
    if not target_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target must be a directory")

    dest = target_dir / (file.filename or "upload")
    content = await file.read()
    dest.write_bytes(content)

    rel_path = str(dest.relative_to(_DATA_ROOT))
    background_tasks.add_task(
        fire_webhooks_simple, "file.uploaded",
        {"path": rel_path, "size": len(content), "name": dest.name},
    )
    return {"path": rel_path, "size": len(content), "name": dest.name}


@router.get("/download")
def download_file(
    path: str = Query(...),
    actor: Actor = Depends(get_current_actor),
):
    target = _safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path=str(target), filename=target.name)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_path(
    path: str = Query(...),
    actor: Actor = Depends(get_current_actor),
):
    target = _safe_path(path)
    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path not found")
    import shutil
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
