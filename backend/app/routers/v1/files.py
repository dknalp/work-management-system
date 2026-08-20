"""File management API — router aggregator.

All routes live under /api/v1/files (prefix set in main.py).
Implementation is split across focused sub-modules:

  files_utils.py  — shared models, helpers, storage utilities
  files_core.py   — list, upload, download, preview, folder, rename, move, copy
  files_trash.py  — trash, restore, permanent delete, empty-trash
  files_bulk.py   — bulk-move, bulk-copy, bulk-trash
  files_misc.py   — quota, zip, search, customize, star, starred, recent
  files_share.py  — share create/list/delete, share links, public access
  files_drive.py  — Google Drive import (single file + folder SSE stream)
"""

from fastapi import APIRouter

from app.routers.v1 import files_core, files_trash, files_bulk, files_misc, files_share, files_drive

router = APIRouter(prefix="/files", tags=["files"])

router.include_router(files_core.router)
router.include_router(files_trash.router)
router.include_router(files_bulk.router)
router.include_router(files_misc.router)
router.include_router(files_share.router)
router.include_router(files_drive.router)