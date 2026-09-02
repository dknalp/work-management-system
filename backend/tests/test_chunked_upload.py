"""Tests for the chunked upload endpoints:
  POST   /api/v1/files/upload/init
  PUT    /api/v1/files/upload/chunk/{upload_id}
  POST   /api/v1/files/upload/complete/{upload_id}
  DELETE /api/v1/files/upload/abort/{upload_id}
"""

import io
import uuid
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import User

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

OWNER = User(id="user-chunked-test", email="chunked@test.com", name="Test Owner", role="member")
OTHER = User(id="user-other", email="other@test.com", name="Test Other", role="member")

CHUNK_SIZE = 5 * 1024 * 1024  # 5 MiB


def _make_db(session_data: dict | None = None):
    """Return a mock Firestore client with an optional upload_session doc."""
    db = MagicMock()

    session_doc = MagicMock()
    if session_data is not None:
        session_doc.exists = True
        session_doc.to_dict.return_value = session_data
    else:
        session_doc.exists = False
        session_doc.to_dict.return_value = {}

    db.collection.return_value.document.return_value.get.return_value = session_doc

    # set / update / delete are fire-and-forget — just mock them
    db.collection.return_value.document.return_value.set.return_value = None
    db.collection.return_value.document.return_value.update.return_value = None
    db.collection.return_value.document.return_value.delete.return_value = None

    return db


@pytest.fixture()
def client():
    return TestClient(app)


def _auth(user: User = OWNER):
    """Override get_current_user and get_db for a request."""
    from app.deps import get_current_user
    from app.firebase import get_db

    def override_user():
        return user

    app.dependency_overrides[get_current_user] = override_user
    return override_user


def _reset():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# POST /api/v1/files/upload/init
# ---------------------------------------------------------------------------

class TestInitChunkedUpload:
    def test_returns_upload_id_and_chunk_size(self, client):
        _auth(OWNER)
        db = _make_db()
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=False), \
             patch("app.routers.v1.files_upload._storage_root") as mock_root:
            mock_root.return_value = MagicMock()
            mock_root.return_value.__truediv__ = lambda self, x: MagicMock(
                **{"mkdir": MagicMock(), "touch": MagicMock(), "__truediv__": lambda s, y: MagicMock(touch=MagicMock())}
            )

            resp = client.post("/api/v1/files/upload/init", json={
                "filename": "bigfile.zip",
                "path": "",
                "total_size": 50 * 1024 * 1024,
                "total_chunks": 10,
            })

        _reset()
        assert resp.status_code == 201
        body = resp.json()
        assert "upload_id" in body
        assert body["chunk_size"] == CHUNK_SIZE


# ---------------------------------------------------------------------------
# PUT /api/v1/files/upload/chunk/{upload_id}
# ---------------------------------------------------------------------------

class TestUploadChunk:
    def _session(self, owner_id=OWNER.id, status="in_progress", chunks_received=None):
        return {
            "upload_id": "sess-1",
            "owner_id": owner_id,
            "status": status,
            "total_chunks": 3,
            "chunks_received": chunks_received or [],
            "etags": {},
            "r2_key": None,
            "r2_upload_id": None,
            "local_tmp_path": "/tmp/.chunk-sess-1",
        }

    def test_chunk_accepted(self, client):
        _auth(OWNER)
        db = _make_db(self._session())
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        chunk_data = b"x" * 1024

        with patch("app.routers.v1.files_upload._use_r2", return_value=False), \
             patch("builtins.open", MagicMock()):
            resp = client.put(
                "/api/v1/files/upload/chunk/sess-1",
                data={"chunk_index": "0"},
                files={"chunk_data": ("chunk-0", io.BytesIO(chunk_data), "application/octet-stream")},
            )

        _reset()
        assert resp.status_code == 200
        body = resp.json()
        assert body["chunk_index"] == 0
        assert body["received"] is True

    def test_duplicate_chunk_is_idempotent(self, client):
        """Resending a chunk that was already received returns 200 without re-processing."""
        _auth(OWNER)
        db = _make_db(self._session(chunks_received=[0]))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=False):
            resp = client.put(
                "/api/v1/files/upload/chunk/sess-1",
                data={"chunk_index": "0"},
                files={"chunk_data": ("chunk-0", io.BytesIO(b"x"), "application/octet-stream")},
            )

        _reset()
        assert resp.status_code == 200
        # Should NOT call open/write again — chunk was already received
        assert resp.json()["received"] is True
        assert resp.json()["chunks_received"] == 1  # still 1, not 2

    def test_wrong_owner_returns_403(self, client):
        _auth(OTHER)
        db = _make_db(self._session(owner_id=OWNER.id))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=False):
            resp = client.put(
                "/api/v1/files/upload/chunk/sess-1",
                data={"chunk_index": "0"},
                files={"chunk_data": ("chunk-0", io.BytesIO(b"x"), "application/octet-stream")},
            )

        _reset()
        assert resp.status_code == 403

    def test_nonexistent_session_returns_404(self, client):
        _auth(OWNER)
        db = _make_db(None)  # session does not exist
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        resp = client.put(
            "/api/v1/files/upload/chunk/nonexistent",
            data={"chunk_index": "0"},
            files={"chunk_data": ("chunk-0", io.BytesIO(b"x"), "application/octet-stream")},
        )
        _reset()
        assert resp.status_code == 404

    def test_completed_session_returns_400(self, client):
        _auth(OWNER)
        db = _make_db(self._session(status="completed"))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        resp = client.put(
            "/api/v1/files/upload/chunk/sess-1",
            data={"chunk_index": "0"},
            files={"chunk_data": ("chunk-0", io.BytesIO(b"x"), "application/octet-stream")},
        )
        _reset()
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/v1/files/upload/complete/{upload_id}
# ---------------------------------------------------------------------------

class TestCompleteChunkedUpload:
    def _session(self, chunks_received=None, total_chunks=3, owner_id=OWNER.id):
        return {
            "upload_id": "sess-complete",
            "owner_id": owner_id,
            "status": "in_progress",
            "filename": "video.mp4",
            "virtual_path": "video.mp4",
            "total_size": total_chunks * CHUNK_SIZE,
            "total_chunks": total_chunks,
            "chunks_received": chunks_received if chunks_received is not None else list(range(total_chunks)),
            "etags": {},
            "mime_type": "video/mp4",
            "r2_key": None,
            "r2_upload_id": None,
            "local_tmp_path": "/tmp/.chunk-sess-complete",
        }

    def test_complete_with_all_chunks_creates_file_record(self, client):
        _auth(OWNER)
        db = _make_db(self._session())
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=False), \
             patch("app.routers.v1.files_upload.os.replace", MagicMock()), \
             patch("pathlib.Path.exists", return_value=True):

            resp = client.post("/api/v1/files/upload/complete/sess-complete")

        _reset()
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "video.mp4"
        assert body["is_deleted"] is False

    def test_missing_chunks_returns_400(self, client):
        _auth(OWNER)
        # Only chunks 0 and 1 received, total_chunks=3 — chunk 2 is missing
        db = _make_db(self._session(chunks_received=[0, 1], total_chunks=3))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=False):
            resp = client.post("/api/v1/files/upload/complete/sess-complete")

        _reset()
        assert resp.status_code == 400
        assert "Missing chunks" in resp.json()["detail"]

    def test_wrong_owner_returns_403(self, client):
        _auth(OTHER)
        db = _make_db(self._session(owner_id=OWNER.id))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        resp = client.post("/api/v1/files/upload/complete/sess-complete")
        _reset()
        assert resp.status_code == 403

    def test_nonexistent_session_returns_404(self, client):
        _auth(OWNER)
        db = _make_db(None)
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        resp = client.post("/api/v1/files/upload/complete/nonexistent")
        _reset()
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/v1/files/upload/abort/{upload_id}
# ---------------------------------------------------------------------------

class TestAbortChunkedUpload:
    def _session(self, owner_id=OWNER.id, r2=False):
        return {
            "upload_id": "sess-abort",
            "owner_id": owner_id,
            "status": "in_progress",
            "r2_key": "user/sess-abort/file.bin" if r2 else None,
            "r2_upload_id": "r2-mpu-id" if r2 else None,
            "local_tmp_path": "/tmp/.chunk-sess-abort" if not r2 else None,
        }

    def test_abort_local_returns_204(self, client):
        _auth(OWNER)
        db = _make_db(self._session())
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=False), \
             patch("pathlib.Path.unlink", MagicMock()):
            resp = client.delete("/api/v1/files/upload/abort/sess-abort")

        _reset()
        assert resp.status_code == 204

    def test_abort_r2_calls_abort_multipart(self, client):
        _auth(OWNER)
        db = _make_db(self._session(r2=True))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=True), \
             patch("app.routers.v1.files_upload.r2_abort_multipart_upload", new_callable=AsyncMock) as mock_abort:
            resp = client.delete("/api/v1/files/upload/abort/sess-abort")
            mock_abort.assert_awaited_once_with("user/sess-abort/file.bin", "r2-mpu-id")

        _reset()
        assert resp.status_code == 204

    def test_wrong_owner_returns_403(self, client):
        _auth(OTHER)
        db = _make_db(self._session(owner_id=OWNER.id))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=False):
            resp = client.delete("/api/v1/files/upload/abort/sess-abort")

        _reset()
        assert resp.status_code == 403

    def test_nonexistent_session_returns_404(self, client):
        _auth(OWNER)
        db = _make_db(None)
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        resp = client.delete("/api/v1/files/upload/abort/nonexistent")
        _reset()
        assert resp.status_code == 404

    def test_r2_abort_failure_does_not_crash(self, client):
        """R2 abort failure must be logged as warning, not propagate as 500."""
        _auth(OWNER)
        db = _make_db(self._session(r2=True))
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routers.v1.files_upload._use_r2", return_value=True), \
             patch("app.routers.v1.files_upload.r2_abort_multipart_upload",
                   new_callable=AsyncMock, side_effect=Exception("R2 down")):
            resp = client.delete("/api/v1/files/upload/abort/sess-abort")

        _reset()
        assert resp.status_code == 204
