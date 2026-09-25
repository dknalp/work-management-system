"""
Structured logging configuration for work-management-system backend.

Sets up two handlers:
  - console: INFO+ in human-readable format (always active)
  - rotating file: WARNING+ in JSON format at /data/logs/app.log (10 MB × 5 rotations)
  - error file: ERROR+ in JSON format at /data/logs/errors.log (5 MB × 3 rotations)

Call configure_logging() once at startup before any other imports use logging.
"""

import json
import logging
import logging.handlers
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path


LOG_DIR = Path(os.getenv("LOG_DIR", "/data/logs"))
LOG_LEVEL_CONSOLE = os.getenv("LOG_LEVEL", "INFO").upper()
_ENV = os.getenv("APP_ENV", "production")


class _JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        elif record.exc_text:
            payload["exc"] = record.exc_text
        # Extra fields attached via logger.xxx(..., extra={...})
        for key, val in record.__dict__.items():
            if key not in logging.LogRecord.__dict__ and key not in (
                "message", "asctime", "msg", "args", "exc_info", "exc_text",
                "stack_info", "lineno", "funcName", "created", "msecs",
                "relativeCreated", "thread", "threadName", "processName",
                "process", "taskName",
            ):
                try:
                    json.dumps(val)  # ensure serializable
                    payload[key] = val
                except (TypeError, ValueError):
                    payload[key] = str(val)
        return json.dumps(payload, ensure_ascii=False)


class _ConsoleFormatter(logging.Formatter):
    _COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    _RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self._COLORS.get(record.levelname, "")
        ts = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime("%H:%M:%S")
        msg = record.getMessage()
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)
        return f"{color}{ts} [{record.levelname[0]}] {record.name}: {msg}{self._RESET}"


def configure_logging() -> None:
    """Configure root logger. Safe to call multiple times (idempotent)."""
    root = logging.getLogger()
    if getattr(root, "_wms_configured", False):
        return
    root._wms_configured = True  # type: ignore[attr-defined]

    root.setLevel(logging.DEBUG)

    # ── Console handler ────────────────────────────────────────────────────
    console = logging.StreamHandler()
    console.setLevel(getattr(logging, LOG_LEVEL_CONSOLE, logging.INFO))
    console.setFormatter(_ConsoleFormatter())
    root.addHandler(console)

    # ── File handlers (skip in test env or if LOG_DIR is not writable) ─────
    if _ENV == "test":
        return

    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)

        # app.log — WARNING and above, rotating
        app_handler = logging.handlers.RotatingFileHandler(
            LOG_DIR / "app.log",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        app_handler.setLevel(logging.WARNING)
        app_handler.setFormatter(_JsonFormatter())
        root.addHandler(app_handler)

        # errors.log — ERROR and above, rotating
        err_handler = logging.handlers.RotatingFileHandler(
            LOG_DIR / "errors.log",
            maxBytes=5 * 1024 * 1024,  # 5 MB
            backupCount=3,
            encoding="utf-8",
        )
        err_handler.setLevel(logging.ERROR)
        err_handler.setFormatter(_JsonFormatter())
        root.addHandler(err_handler)

    except OSError as exc:
        # Non-fatal: log files unavailable (e.g. read-only FS)
        logging.getLogger(__name__).warning(
            "Could not create log directory %s: %s — file logging disabled", LOG_DIR, exc
        )

    # Quiet noisy third-party loggers
    for noisy in ("httpx", "httpcore", "urllib3", "google.auth", "google.api_core"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
