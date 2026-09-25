"""
Tests for the logging system:
  - logging_config: configure_logging() is idempotent, creates handlers
  - logs router: GET /logs and GET /logs/summary
"""

import json
import logging
import logging.handlers
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.logging_config import _JsonFormatter, _ConsoleFormatter
from app.models import User
from app.routers.v1.logs import _tail_json_lines


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _admin_user() -> User:
    return User(id="admin-1", email="admin@test.com", name="Admin", role="admin", is_admin=True)

def _member_user() -> User:
    return User(id="member-1", email="user@test.com", name="User", role="member", is_admin=False)

def _make_client(current_user: User, log_dir: Path) -> TestClient:
    from app.routers.v1 import logs as logs_mod
    from app.deps import get_current_user
    from app.routers.v1.logs import router as logs_router

    app = FastAPI()
    app.dependency_overrides[get_current_user] = lambda: current_user

    # Patch LOG_DIR inside the module before mounting
    with patch.object(logs_mod, "LOG_DIR", log_dir):
        app.include_router(logs_router)
        return TestClient(app), logs_mod


# ─────────────────────────────────────────────────────────────────────────────
# logging_config tests
# ─────────────────────────────────────────────────────────────────────────────

class TestConfigureLogging:
    def _fresh_configure(self, env: dict) -> None:
        """Reset configured flag and call configure_logging with given env."""
        import app.logging_config as lc
        root = logging.getLogger()
        root._wms_configured = False
        with patch.dict(os.environ, env), patch.object(lc, "_ENV", env.get("APP_ENV", "production")):
            lc.configure_logging()

    def test_idempotent(self):
        """configure_logging() called twice must not add duplicate handlers."""
        import app.logging_config as lc
        root = logging.getLogger()
        root._wms_configured = False
        with patch.dict(os.environ, {"APP_ENV": "test"}), patch.object(lc, "_ENV", "test"):
            lc.configure_logging()
            count_after_first = len(root.handlers)
            lc.configure_logging()
            count_after_second = len(root.handlers)
        assert count_after_first == count_after_second

    def test_console_handler_added(self):
        import app.logging_config as lc
        root = logging.getLogger()
        root._wms_configured = False
        with patch.dict(os.environ, {"APP_ENV": "test"}), patch.object(lc, "_ENV", "test"):
            lc.configure_logging()
        handler_types = [type(h).__name__ for h in root.handlers]
        assert "StreamHandler" in handler_types

    def test_file_handlers_in_production(self):
        import app.logging_config as lc
        root = logging.getLogger()
        root._wms_configured = False
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict(os.environ, {"APP_ENV": "production", "LOG_DIR": tmpdir}), \
                 patch.object(lc, "_ENV", "production"), \
                 patch.object(lc, "LOG_DIR", Path(tmpdir)):
                lc.configure_logging()
        handler_types = [type(h).__name__ for h in root.handlers]
        assert "RotatingFileHandler" in handler_types

    def test_log_files_created_in_production(self):
        import app.logging_config as lc
        root = logging.getLogger()
        root._wms_configured = False
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with patch.dict(os.environ, {"APP_ENV": "production", "LOG_DIR": tmpdir}), \
                 patch.object(lc, "_ENV", "production"), \
                 patch.object(lc, "LOG_DIR", tmp_path):
                lc.configure_logging()
            # Emit a warning to trigger file creation
            logging.getLogger("test.prod").warning("test warning")
            assert (tmp_path / "app.log").exists()


class TestJsonFormatter:
    def test_basic_record(self):
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test.logger", level=logging.WARNING,
            pathname="", lineno=0, msg="hello %s", args=("world",),
            exc_info=None,
        )
        output = formatter.format(record)
        data = json.loads(output)
        assert data["msg"] == "hello world"
        assert data["level"] == "WARNING"
        assert data["logger"] == "test.logger"
        assert "ts" in data

    def test_extra_fields_included(self):
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test", level=logging.ERROR,
            pathname="", lineno=0, msg="err", args=(),
            exc_info=None,
        )
        record.status = 500
        record.path = "/api/v1/foo"
        output = formatter.format(record)
        data = json.loads(output)
        assert data["status"] == 500
        assert data["path"] == "/api/v1/foo"

    def test_exception_included(self):
        formatter = _JsonFormatter()
        try:
            raise ValueError("test error")
        except ValueError:
            import sys
            exc_info = sys.exc_info()
        record = logging.LogRecord(
            name="test", level=logging.ERROR,
            pathname="", lineno=0, msg="boom", args=(),
            exc_info=exc_info,
        )
        output = formatter.format(record)
        data = json.loads(output)
        assert "exc" in data
        assert "ValueError" in data["exc"]

    def test_non_serializable_extra_coerced_to_str(self):
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test", level=logging.WARNING,
            pathname="", lineno=0, msg="msg", args=(),
            exc_info=None,
        )
        record.weird = object()  # not JSON serializable
        output = formatter.format(record)
        data = json.loads(output)
        assert isinstance(data["weird"], str)


# ─────────────────────────────────────────────────────────────────────────────
# _tail_json_lines tests
# ─────────────────────────────────────────────────────────────────────────────

class TestTailJsonLines:
    def test_returns_empty_for_missing_file(self, tmp_path):
        result = _tail_json_lines(tmp_path / "nonexistent.log", 100)
        assert result == []

    def test_returns_newest_first(self, tmp_path):
        log_file = tmp_path / "app.log"
        entries = [
            json.dumps({"ts": f"2026-01-01T00:00:0{i}Z", "level": "WARNING", "logger": "x", "msg": f"line{i}"})
            for i in range(5)
        ]
        log_file.write_text("\n".join(entries) + "\n")
        result = _tail_json_lines(log_file, 10)
        assert result[0]["msg"] == "line4"
        assert result[-1]["msg"] == "line0"

    def test_respects_n_limit(self, tmp_path):
        log_file = tmp_path / "app.log"
        entries = [
            json.dumps({"ts": "t", "level": "WARNING", "logger": "x", "msg": f"line{i}"})
            for i in range(20)
        ]
        log_file.write_text("\n".join(entries) + "\n")
        result = _tail_json_lines(log_file, 5)
        assert len(result) == 5

    def test_handles_malformed_line(self, tmp_path):
        log_file = tmp_path / "app.log"
        log_file.write_text('{"ts":"t","level":"ERROR","logger":"x","msg":"ok"}\nnot-json\n')
        result = _tail_json_lines(log_file, 10)
        # Both lines returned, malformed one gets UNKNOWN level
        assert len(result) == 2
        levels = {e["level"] for e in result}
        assert "UNKNOWN" in levels


# ─────────────────────────────────────────────────────────────────────────────
# Logs router tests
# ─────────────────────────────────────────────────────────────────────────────

class TestLogsRouter:
    def _make_app_with_dir(self, user: User, log_dir: Path) -> TestClient:
        import app.routers.v1.logs as logs_mod
        from app.deps import get_current_user
        from app.routers.v1.logs import router as logs_router

        app = FastAPI()
        app.dependency_overrides[get_current_user] = lambda: user

        # Patch LOG_DIR at module level so route handlers see the right value
        logs_mod.LOG_DIR = log_dir
        app.include_router(logs_router)
        return TestClient(app)

    def test_get_logs_admin_required(self, tmp_path):
        client = self._make_app_with_dir(_member_user(), tmp_path)
        resp = client.get("/logs")
        assert resp.status_code == 403

    def test_get_logs_empty_when_no_file(self, tmp_path):
        client = self._make_app_with_dir(_admin_user(), tmp_path)
        resp = client.get("/logs")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_logs_returns_entries(self, tmp_path):
        entries = [
            {"ts": "2026-01-01T00:00:01Z", "level": "WARNING", "logger": "app.main", "msg": "test warn"},
            {"ts": "2026-01-01T00:00:02Z", "level": "ERROR",   "logger": "app.main", "msg": "test error"},
        ]
        (tmp_path / "app.log").write_text("\n".join(json.dumps(e) for e in entries) + "\n")
        client = self._make_app_with_dir(_admin_user(), tmp_path)
        resp = client.get("/logs?level=WARNING&lines=100")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_logs_filters_by_level(self, tmp_path):
        entries = [
            {"ts": "t", "level": "WARNING", "logger": "x", "msg": "warn msg"},
            {"ts": "t", "level": "ERROR",   "logger": "x", "msg": "error msg"},
            {"ts": "t", "level": "INFO",    "logger": "x", "msg": "info msg"},
        ]
        (tmp_path / "app.log").write_text("\n".join(json.dumps(e) for e in entries) + "\n")
        client = self._make_app_with_dir(_admin_user(), tmp_path)
        resp = client.get("/logs?level=ERROR")
        data = resp.json()
        assert all(e["level"] in ("ERROR", "CRITICAL") for e in data)

    def test_get_logs_search_filter(self, tmp_path):
        entries = [
            {"ts": "t", "level": "WARNING", "logger": "x", "msg": "database connection failed"},
            {"ts": "t", "level": "WARNING", "logger": "x", "msg": "something else"},
        ]
        (tmp_path / "app.log").write_text("\n".join(json.dumps(e) for e in entries) + "\n")
        client = self._make_app_with_dir(_admin_user(), tmp_path)
        resp = client.get("/logs?level=WARNING&q=database")
        data = resp.json()
        assert len(data) == 1
        assert "database" in data[0]["msg"]

    def test_get_logs_errors_file(self, tmp_path):
        entry = {"ts": "t", "level": "ERROR", "logger": "x", "msg": "critical error"}
        (tmp_path / "errors.log").write_text(json.dumps(entry) + "\n")
        client = self._make_app_with_dir(_admin_user(), tmp_path)
        resp = client.get("/logs?file=errors&level=ERROR")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_summary_returns_counts(self, tmp_path):
        entries = [
            {"ts": "t", "level": "WARNING",  "logger": "x", "msg": "w1"},
            {"ts": "t", "level": "WARNING",  "logger": "x", "msg": "w2"},
            {"ts": "t", "level": "ERROR",    "logger": "x", "msg": "e1"},
            {"ts": "t", "level": "CRITICAL", "logger": "x", "msg": "c1"},
        ]
        (tmp_path / "app.log").write_text("\n".join(json.dumps(e) for e in entries) + "\n")
        client = self._make_app_with_dir(_admin_user(), tmp_path)
        resp = client.get("/logs/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["counts"]["WARNING"] == 2
        assert data["counts"]["ERROR"] == 1
        assert data["counts"]["CRITICAL"] == 1

    def test_summary_admin_required(self, tmp_path):
        client = self._make_app_with_dir(_member_user(), tmp_path)
        resp = client.get("/logs/summary")
        assert resp.status_code == 403
