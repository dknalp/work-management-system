"""Tests for the presigned-URL upload flow (files_presign.py).

All Firestore and R2 calls are mocked — these tests verify routing logic,
ownership checks, conflict detection, and response shapes.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.models import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_app():
    from app.main import app
    return app


def _user(uid: str = "user-1") -> User:
    return User(id=uid, email="test@example.com", name="Test User", role="member")


def _active_doc(file_id: str, path: str, owner_id: str = "user-1"):
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {
        "id": file_id,
        "name": path.split("/")[-1],
        "path": path,
        "parent_path": "/".join(path.split("/")[:-1]),
        "type": "file",
        "size": 1024,
        "mime_type": "text/plain",
        "r2_key": f"files/{owner_id}/{file_id}",
        "owner_id": owner_id,
        "status": "active",
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "color": None,
        "icon_emoji": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return doc


def _pending_doc(file_id: str, path: str, owner_id: str = "user-1"):
    doc = _active_doc(file_id, path, owner_id)
    doc.to_dict.return_value = {**doc.to_dict(), "status": "pending"}
    return doc


def _missing_doc():
    doc = MagicMock()
    doc.exists = False
    doc.to_dict.return_value = {}
    return doc


def _setup_client(get_doc_side_effect=None, use_r2: bool = True):
    app = _make_app()
    db = MagicMock()

    col = MagicMock()
    col.where.return_value = col
    col.stream.return_value = iter([])
    if get_doc_side_effect:
        col.document.return_value.get.side_effect = get_doc_side_effect
    else:
        col.document.return_value.get.return_value = _missing_doc()
    db.collection.return_value = col

    from app.deps import get_current_user
    from app.firebase import get_db
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: _user()

    client = TestClient(app, raise_server_exceptions=False)
    return client, db, col


# ---------------------------------------------------------------------------
# POST /api/v1/files/presign/batch
# ---------------------------------------------------------------------------

class TestPresignBatch:
    PAYLOAD = [
        {"filename": "a.txt", "path": "", "size": 100, "mime_type": "text/plain"},
        {"filename": "b.txt", "path": "folder", "size": 200, "mime_type": "text/plain"},
    ]

    def test_returns_upload_urls(self):
        client, db, col = _setup_client()
        with (
            patch("app.routers.v1.files_presign._use_r2", return_value=True),
            patch("app.routers.v1.files_presign.r2_presign_put", return_value="https://r2.example.com/signed"),
        ):
            r = client.post("/api/v1/files/presign/batch", json=self.PAYLOAD)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["upload_url"] == "https://r2.example.com/signed"
        assert data[0]["conflict"] is False
        assert data[1]["upload_url"] == "https://r2.example.com/signed"

    def test_deterministic_file_id(self):
        """Same owner + path always produces same file_id."""
        client, db, col = _setup_client()
        payload = [{"filename": "same.txt", "path": "", "size": 10, "mime_type": "text/plain"}]
        with (
            patch("app.routers.v1.files_presign._use_r2", return_value=True),
            patch("app.routers.v1.files_presign.r2_presign_put", return_value="https://r2.example.com/x"),
        ):
            r1 = client.post("/api/v1/files/presign/batch", json=payload)
            r2 = client.post("/api/v1/files/presign/batch", json=payload)
        assert r1.json()[0]["file_id"] == r2.json()[0]["file_id"]

    def test_conflict_when_active_exists_no_overwrite(self):
        """Existing active record + overwrite=false → conflict=True, no upload_url."""
        file_id = "existing-file-id"

        def get_side(fid):
            # The col.document(fid).get() call
            m = MagicMock()
            m.exists = True
            m.to_dict.return_value = {"status": "active", "owner_id": "user-1"}
            return m

        client, db, col = _setup_client()
        col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=lambda: {"status": "active", "owner_id": "user-1"},
        )
        with (
            patch("app.routers.v1.files_presign._use_r2", return_value=True),
            patch("app.routers.v1.files_presign.r2_presign_put", return_value="https://r2.example.com/x"),
        ):
            r = client.post("/api/v1/files/presign/batch", json=[
                {"filename": "existing.txt", "path": "", "size": 10, "mime_type": "text/plain", "overwrite": False}
            ])
        data = r.json()
        assert data[0]["conflict"] is True
        assert data[0]["upload_url"] == ""

    def test_overwrite_true_bypasses_conflict(self):
        """overwrite=True on existing active file → fresh presigned URL, no conflict."""
        client, db, col = _setup_client()
        col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=lambda: {"status": "active", "owner_id": "user-1"},
        )
        with (
            patch("app.routers.v1.files_presign._use_r2", return_value=True),
            patch("app.routers.v1.files_presign.r2_presign_put", return_value="https://r2.example.com/x"),
        ):
            r = client.post("/api/v1/files/presign/batch", json=[
                {"filename": "existing.txt", "path": "", "size": 10, "mime_type": "text/plain", "overwrite": True}
            ])
        data = r.json()
        assert data[0]["conflict"] is False
        assert data[0]["upload_url"] != ""

    def test_r2_not_configured_returns_501(self):
        client, db, col = _setup_client()
        with patch("app.routers.v1.files_presign._use_r2", return_value=False):
            r = client.post("/api/v1/files/presign/batch", json=self.PAYLOAD)
        assert r.status_code == 501

    def test_batch_too_large_returns_400(self):
        client, db, col = _setup_client()
        payload = [
            {"filename": f"f{i}.txt", "path": "", "size": 1, "mime_type": "text/plain"}
            for i in range(51)
        ]
        with patch("app.routers.v1.files_presign._use_r2", return_value=True):
            r = client.post("/api/v1/files/presign/batch", json=payload)
        assert r.status_code == 400

    def test_firestore_set_called_for_each_file(self):
        """Each file in the batch writes a pending Firestore record."""
        client, db, col = _setup_client()
        with (
            patch("app.routers.v1.files_presign._use_r2", return_value=True),
            patch("app.routers.v1.files_presign.r2_presign_put", return_value="https://r2.example.com/x"),
        ):
            client.post("/api/v1/files/presign/batch", json=self.PAYLOAD)
        # set() called twice (once per file)
        assert col.document.return_value.set.call_count == 2


# ---------------------------------------------------------------------------
# POST /api/v1/files/confirm/{file_id}
# ---------------------------------------------------------------------------

class TestConfirmUpload:
    def _client_with_doc(self, doc_data: dict, owner: str = "user-1"):
        client, db, col = _setup_client()
        col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=lambda: doc_data,
        )
        return client, col

    def test_confirm_flips_status_to_active(self):
        doc = {
            "id": "fid", "name": "f.txt", "path": "f.txt", "parent_path": "",
            "type": "file", "size": 100, "mime_type": "text/plain",
            "r2_key": "files/user-1/fid", "owner_id": "user-1",
            "status": "pending", "is_deleted": False, "deleted_at": None,
            "is_starred": False, "color": None, "icon_emoji": None,
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        }
        client, col = self._client_with_doc(doc)
        r = client.post("/api/v1/files/confirm/fid", json={"size": 100})
        assert r.status_code == 200
        assert col.document.return_value.update.called
        call_args = col.document.return_value.update.call_args[0][0]
        assert call_args["status"] == "active"

    def test_confirm_wrong_owner_returns_403(self):
        doc = {
            "id": "fid", "owner_id": "other-user", "status": "pending",
            "name": "f.txt", "path": "f.txt", "parent_path": "", "type": "file",
            "size": 100, "mime_type": "text/plain", "r2_key": "files/other/fid",
            "is_deleted": False, "deleted_at": None, "is_starred": False,
            "color": None, "icon_emoji": None,
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        }
        client, col = self._client_with_doc(doc)
        r = client.post("/api/v1/files/confirm/fid", json={})
        assert r.status_code == 403

    def test_confirm_missing_file_returns_404(self):
        client, db, col = _setup_client()
        col.document.return_value.get.return_value = _missing_doc()
        r = client.post("/api/v1/files/confirm/no-such-id", json={})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/v1/files/presign/multipart/init
# ---------------------------------------------------------------------------

class TestMultipartInit:
    PAYLOAD = {
        "filename": "big.zip",
        "path": "",
        "size": 500 * 1024 * 1024,
        "mime_type": "application/zip",
        "total_parts": 100,
    }

    def test_returns_correct_number_of_part_urls(self):
        client, db, col = _setup_client()
        with (
            patch("app.routers.v1.files_presign._use_r2", return_value=True),
            patch("app.routers.v1.files_presign.r2_create_multipart_upload", return_value="upload-id-123"),
            patch("app.routers.v1.files_presign.r2_presign_multipart_part", return_value="https://r2.example.com/part"),
        ):
            r = client.post("/api/v1/files/presign/multipart/init", json=self.PAYLOAD)
        assert r.status_code == 201
        data = r.json()
        assert len(data["part_urls"]) == 100
        assert data["upload_id"] == "upload-id-123"

    def test_writes_pending_firestore_record(self):
        client, db, col = _setup_client()
        with (
            patch("app.routers.v1.files_presign._use_r2", return_value=True),
            patch("app.routers.v1.files_presign.r2_create_multipart_upload", return_value="upload-id-123"),
            patch("app.routers.v1.files_presign.r2_presign_multipart_part", return_value="https://r2.example.com/part"),
        ):
            client.post("/api/v1/files/presign/multipart/init", json=self.PAYLOAD)
        assert col.document.return_value.set.called

    def test_r2_not_configured_returns_501(self):
        client, db, col = _setup_client()
        with patch("app.routers.v1.files_presign._use_r2", return_value=False):
            r = client.post("/api/v1/files/presign/multipart/init", json=self.PAYLOAD)
        assert r.status_code == 501


# ---------------------------------------------------------------------------
# POST /api/v1/files/presign/multipart/complete
# ---------------------------------------------------------------------------

class TestMultipartComplete:
    PAYLOAD = {
        "file_id": "fid",
        "upload_id": "uid",
        "parts": [
            {"part_number": 1, "etag": "etag1"},
            {"part_number": 2, "etag": "etag2"},
        ],
    }

    def _client_with_r2_doc(self):
        client, db, col = _setup_client()
        col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=lambda: {
                "id": "fid", "name": "big.zip", "path": "big.zip", "parent_path": "",
                "type": "file", "size": 500000000, "mime_type": "application/zip",
                "r2_key": "files/user-1/fid", "owner_id": "user-1",
                "status": "pending", "multipart_upload_id": "uid",
                "is_deleted": False, "deleted_at": None, "is_starred": False,
                "color": None, "icon_emoji": None,
                "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
            },
        )
        return client, col

    def test_complete_marks_status_active(self):
        client, col = self._client_with_r2_doc()
        with patch("app.routers.v1.files_presign.r2_complete_multipart_upload", return_value=None):
            r = client.post("/api/v1/files/presign/multipart/complete", json=self.PAYLOAD)
        assert r.status_code == 200
        call_args = col.document.return_value.update.call_args[0][0]
        assert call_args["status"] == "active"

    def test_complete_wrong_owner_returns_403(self):
        client, db, col = _setup_client()
        col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=lambda: {"owner_id": "other-user", "r2_key": "files/other/fid", "status": "pending"},
        )
        with patch("app.routers.v1.files_presign.r2_complete_multipart_upload", return_value=None):
            r = client.post("/api/v1/files/presign/multipart/complete", json=self.PAYLOAD)
        assert r.status_code == 403

    def test_complete_missing_file_returns_404(self):
        client, db, col = _setup_client()
        col.document.return_value.get.return_value = _missing_doc()
        with patch("app.routers.v1.files_presign.r2_complete_multipart_upload", return_value=None):
            r = client.post("/api/v1/files/presign/multipart/complete", json=self.PAYLOAD)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# list_files excludes pending records
# ---------------------------------------------------------------------------

class TestListFilesExcludesPending:
    def test_pending_records_not_shown(self):
        app = _make_app()
        db = MagicMock()

        pending_doc = MagicMock()
        pending_doc.id = "pending-fid"
        pending_doc.to_dict.return_value = {
            "id": "pending-fid", "name": "uploading.txt", "path": "uploading.txt",
            "parent_path": "", "type": "file", "size": 100,
            "mime_type": "text/plain", "r2_key": "files/user-1/pending-fid",
            "owner_id": "user-1", "status": "pending",
            "is_deleted": False, "deleted_at": None, "is_starred": False,
            "color": None, "icon_emoji": None,
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        }
        col = MagicMock()
        col.where.return_value = col
        col.stream.return_value = iter([pending_doc])
        db.collection.return_value = col

        from app.deps import get_current_user
        from app.firebase import get_db
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: _user()

        client = TestClient(app)
        r = client.get("/api/v1/files?path=")
        assert r.status_code == 200
        assert r.json() == []
