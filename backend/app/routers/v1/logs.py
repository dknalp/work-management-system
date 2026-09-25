"""
Admin-only log viewer API.

GET /api/v1/logs
    Query params:
      level   - filter by level: DEBUG|INFO|WARNING|ERROR|CRITICAL (default: WARNING)
      lines   - how many tail lines to return (default: 200, max: 2000)
      file    - which log file: app|errors (default: app)
      q       - optional substring search in "msg" field

Returns a JSON list of log entries (newest first).
"""

import json
import logging
import os
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ...deps import get_current_user
from ...models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/logs", tags=["logs"])

LOG_DIR = Path(os.getenv("LOG_DIR", "/data/logs"))
_LEVEL_ORDER = {"DEBUG": 0, "INFO": 1, "WARNING": 2, "ERROR": 3, "CRITICAL": 4}


class LogEntry(BaseModel):
    ts: str
    level: str
    logger: str
    msg: str
    exc: str | None = None


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin and getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _tail_json_lines(path: Path, n: int) -> list[dict]:
    """Read last n lines from a JSON-lines log file, newest first."""
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        results = []
        for line in reversed(lines[-n:]):
            line = line.strip()
            if not line:
                continue
            try:
                results.append(json.loads(line))
            except json.JSONDecodeError:
                results.append({"ts": "", "level": "UNKNOWN", "logger": "raw", "msg": line})
        return results
    except OSError as exc:
        logger.warning("Could not read log file %s: %s", path, exc)
        return []


@router.get("", response_model=list[dict])
async def get_logs(
    _admin: Annotated[User, Depends(_require_admin)],
    level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "WARNING",
    lines: int = Query(default=200, ge=1, le=2000),
    file: Literal["app", "errors"] = "app",
    q: str | None = None,
) -> list[dict]:
    """Return recent log entries from the specified log file."""
    log_path = LOG_DIR / f"{file}.log"
    entries = _tail_json_lines(log_path, lines * 3)  # over-fetch then filter

    min_order = _LEVEL_ORDER.get(level, 2)
    filtered = [
        e for e in entries
        if _LEVEL_ORDER.get(e.get("level", ""), 0) >= min_order
    ]

    if q:
        q_lower = q.lower()
        filtered = [
            e for e in filtered
            if q_lower in e.get("msg", "").lower()
            or q_lower in e.get("exc", "").lower()
            or q_lower in e.get("logger", "").lower()
        ]

    return filtered[:lines]


@router.get("/summary")
async def get_log_summary(
    _admin: Annotated[User, Depends(_require_admin)],
) -> dict:
    """Return counts of WARNING/ERROR/CRITICAL entries in the last 1000 lines."""
    entries = _tail_json_lines(LOG_DIR / "app.log", 1000)
    counts: dict[str, int] = {"WARNING": 0, "ERROR": 0, "CRITICAL": 0}
    for e in entries:
        lvl = e.get("level", "")
        if lvl in counts:
            counts[lvl] += 1
    return {
        "counts": counts,
        "log_dir": str(LOG_DIR),
        "files": {
            "app.log": (LOG_DIR / "app.log").exists(),
            "errors.log": (LOG_DIR / "errors.log").exists(),
        },
    }
