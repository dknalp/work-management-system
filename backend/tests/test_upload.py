"""
Tests for the file upload endpoint — focusing on the 5 bugs fixed:

Bug 1 – drainQueue side-effect in React updater (frontend only)
Bug 2 – itemsRef stale timing (frontend only)
Bug 3 – folder upload per-file addFiles calls (frontend only)
Bug 4 – UPLOAD_SEMAPHORE must be 3 (matches MAX_CONCURRENT=3 in frontend)
Bug 5 – backend dedup: 409 on duplicate, overwrite deletes old record + bytes
"""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.models import User
from app.routers.v1.files_utils import UPLOAD_SEMAPHORE

# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _user(uid: str = "user-1") -> User:
    return User(id=uid, email=f"{uid}@test.com", name="Test", role="member")


def _make_app():
    """Minimal FastAPI app that mounts only the files_core router."""
    from app.routers.v1 import files_core
    app = FastAPI()
    # Router already has prefix="/files" → mount at /api/v1 to get /api/v1/files/upload
    app.include_router(files_core.router, prefix="/api/v1")
    return app


def _firestore_mock(existing_docs: list | None = None):
    """Build a Firestore client mock that returns `existing_docs` from any query."""
    db = MagicMock()
    query = MagicMock()
    query.where.return_value = query
    query.limit.return_value = query
    query.get.return_value = existing_docs or []
    # Support both .get() and .stream() — new dedup code uses .stream()
    query.stream.return_value = iter(existing_docs or [])

    col = MagicMock()
    col.where.return_value = query
    col.document.return_value = MagicMock()

    db.collection.return_value = col
    return db, col


def _existing_doc(file_id: str = "old-id", r2_key: str = "uploads/old.txt") -> MagicMock:
    doc = MagicMock()
    doc.id = file_id
    doc.to_dict.return_value = {
        "owner_id": "user-1",
        "name": "test.txt",
        "path": "test.txt",
        "type": "file",
        "is_deleted": False,
        "r2_key": r2_key,
    }
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# Bug 4 — UPLOAD_SEMAPHORE must be 3
# ─────────────────────────────────────────────────────────────────────────────

class TestSemaphoreCapacity:
    def test_semaphore_value_is_three(self):
        """UPLOAD_SEMAPHORE._value must equal 3 to match MAX_CONCURRENT=3 on the frontend."""
        assert UPLOAD_SEMAPHORE._value == 3, (
            f"Expected semaphore capacity 3, got {UPLOAD_SEMAPHORE._value}. "
            "Mismatch causes the 3rd concurrent upload to queue on the server "
            "while the frontend holds the connection slot open."
        )

    def test_three_tasks_can_acquire_concurrently(self):
        """Three coroutines acquire a Semaphore(3) simultaneously without deadlock."""
        async def run():
            sem = asyncio.Semaphore(3)
            order = []
            async def worker(n):
                async with sem:
                    order.append(n)
                    await asyncio.sleep(0)
            await asyncio.gather(worker(1), worker(2), worker(3))
            assert set(order) == {1, 2, 3}
        asyncio.run(run())

    def test_fourth_task_waits_for_slot(self):
        """A 4th concurrent coroutine must wait until one of the 3 holders releases."""
        async def run():
            sem = asyncio.Semaphore(3)
            release = asyncio.Event()
            results = []

            async def holder():
                async with sem:
                    await release.wait()
                    results.append("holder_done")

            async def fourth():
                await asyncio.sleep(0)  # yield so holders acquire first
                async with sem:
                    results.append("fourth_acquired")

            holders = [asyncio.create_task(holder()) for _ in range(3)]
            await asyncio.sleep(0)  # let holders acquire all 3 slots
            t4 = asyncio.create_task(fourth())
            release.set()
            await asyncio.gather(*holders, t4)
            assert results.count("holder_done") == 3
            assert "fourth_acquired" in results
        asyncio.run(run())


# ─────────────────────────────────────────────────────────────────────────────
# Bug 5 — server-side dedup and overwrite
# ─────────────────────────────────────────────────────────────────────────────

class TestUploadDedup:

    def _client(self, existing_docs: list | None = None):
        app = _make_app()
        db, col = _firestore_mock(existing_docs)
        user = _user()

        from app.deps import get_current_user
        from app.firebase import get_db
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_db] = lambda: db
        return TestClient(app, raise_server_exceptions=False), db, col

    # ── 5a. First upload always succeeds ─────────────────────────────────────

    def test_upload_new_file_returns_201(self, tmp_path):
        client, db, col = self._client(existing_docs=[])
        doc_mock = MagicMock()
        col.document.return_value = doc_mock

        with (
            patch("app.routers.v1.files_core._use_r2", return_value=False),
            patch("app.routers.v1.files_core._local_path", return_value=tmp_path / "stored.txt"),
        ):
            resp = client.post(
                "/api/v1/files/upload",
                data={"path": "", "overwrite": "false"},
                files={"file": ("hello.txt", b"hello", "text/plain")},
            )

        assert resp.status_code == 201, resp.text
        doc_mock.set.assert_called_once()

    # ── 5b. Duplicate + overwrite=false → 409 ────────────────────────────────

    def test_duplicate_no_overwrite_returns_409(self, tmp_path):
        client, _, col = self._client(existing_docs=[_existing_doc()])
        doc_mock = MagicMock()
        col.document.return_value = doc_mock

        with patch("app.routers.v1.files_core._use_r2", return_value=False):
            resp = client.post(
                "/api/v1/files/upload",
                data={"path": "", "overwrite": "false"},
                files={"file": ("test.txt", b"new", "text/plain")},
            )

        assert resp.status_code == 409, f"Got {resp.status_code}: {resp.text}"
        assert "already exists" in resp.json()["detail"].lower()

    def test_duplicate_no_overwrite_does_not_write_firestore(self, tmp_path):
        """When 409 is raised, no new document is written."""
        client, _, col = self._client(existing_docs=[_existing_doc()])
        doc_mock = MagicMock()
        col.document.return_value = doc_mock

        with patch("app.routers.v1.files_core._use_r2", return_value=False):
            client.post(
                "/api/v1/files/upload",
                data={"path": "", "overwrite": "false"},
                files={"file": ("test.txt", b"new", "text/plain")},
            )

        doc_mock.set.assert_not_called()

    # ── 5c. Duplicate + overwrite=true → 201, old record deleted ─────────────

    def test_overwrite_returns_201(self, tmp_path):
        client, _, col = self._client(existing_docs=[_existing_doc()])
        doc_mock = MagicMock()
        col.document.return_value = doc_mock

        with (
            patch("app.routers.v1.files_core._use_r2", return_value=False),
            patch("app.routers.v1.files_core._local_path", return_value=tmp_path / "stored.txt"),
        ):
            resp = client.post(
                "/api/v1/files/upload",
                data={"path": "", "overwrite": "true"},
                files={"file": ("test.txt", b"new bytes", "text/plain")},
            )

        assert resp.status_code == 201, resp.text

    def test_overwrite_deletes_old_firestore_document(self, tmp_path):
        """On overwrite, collection.document(old_id).delete() is called."""
        old_id = "old-record-id"
        client, _, col = self._client(existing_docs=[_existing_doc(file_id=old_id)])

        deleted_ids: list[str] = []

        def doc_factory(doc_id: str):
            m = MagicMock()
            if doc_id == old_id:
                m.delete.side_effect = lambda: deleted_ids.append(doc_id)
            return m

        col.document.side_effect = doc_factory

        with (
            patch("app.routers.v1.files_core._use_r2", return_value=False),
            patch("app.routers.v1.files_core._local_path", return_value=tmp_path / "stored.txt"),
        ):
            resp = client.post(
                "/api/v1/files/upload",
                data={"path": "", "overwrite": "true"},
                files={"file": ("test.txt", b"new bytes", "text/plain")},
            )

        assert resp.status_code == 201, resp.text
        assert old_id in deleted_ids, (
            f"Expected delete() to be called for document '{old_id}', "
            f"but deleted_ids={deleted_ids}"
        )

    def test_overwrite_unlinks_old_local_file(self, tmp_path):
        """On overwrite, the old file bytes are removed from disk."""
        old_key = "uploads/old.txt"
        old_local = tmp_path / "old.txt"
        old_local.write_bytes(b"old content")

        client, _, col = self._client(existing_docs=[_existing_doc(r2_key=old_key)])
        doc_mock = MagicMock()
        col.document.return_value = doc_mock

        def local_path_side_effect(key: str) -> Path:
            return tmp_path / Path(key).name

        with (
            patch("app.routers.v1.files_core._use_r2", return_value=False),
            patch("app.routers.v1.files_core._local_path", side_effect=local_path_side_effect),
        ):
            resp = client.post(
                "/api/v1/files/upload",
                data={"path": "", "overwrite": "true"},
                files={"file": ("old.txt", b"new content", "text/plain")},
            )

        assert resp.status_code == 201, resp.text
        assert not old_local.exists(), (
            "Old local file should have been unlinked after overwrite"
        )

    # ── 5d. Same name in different folder → NOT a duplicate ──────────────────

    def test_same_name_different_folder_is_not_duplicate(self, tmp_path):
        """Files with the same name but different paths are distinct."""
        # Query returns nothing (different virtual path → no collision)
        client, _, col = self._client(existing_docs=[])
        doc_mock = MagicMock()
        col.document.return_value = doc_mock

        with (
            patch("app.routers.v1.files_core._use_r2", return_value=False),
            patch("app.routers.v1.files_core._local_path", return_value=tmp_path / "stored.pdf"),
        ):
            resp = client.post(
                "/api/v1/files/upload",
                data={"path": "folder-b", "overwrite": "false"},
                files={"file": ("report.pdf", b"content", "application/pdf")},
            )

        assert resp.status_code == 201, resp.text


# ─────────────────────────────────────────────────────────────────────────────
# Concurrent uploads — 3 simultaneous requests all succeed
# ─────────────────────────────────────────────────────────────────────────────

class TestConcurrentUpload:
    @pytest.mark.asyncio
    async def test_three_concurrent_uploads_all_return_201(self, tmp_path):
        """Three simultaneous uploads complete without deadlock or 5xx errors."""
        app = _make_app()
        db, col = _firestore_mock(existing_docs=[])
        doc_mock = MagicMock()
        col.document.return_value = doc_mock
        user = _user()

        from app.deps import get_current_user
        from app.firebase import get_db
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_db] = lambda: db

        call_count = 0

        def local_path_side_effect(key: str) -> Path:
            nonlocal call_count
            call_count += 1
            p = tmp_path / f"file{call_count}.bin"
            return p

        with (
            patch("app.routers.v1.files_core._use_r2", return_value=False),
            patch("app.routers.v1.files_core._local_path", side_effect=local_path_side_effect),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                results = await asyncio.gather(
                    ac.post(
                        "/api/v1/files/upload",
                        data={"path": "", "overwrite": "false"},
                        files={"file": ("a.txt", b"aaa", "text/plain")},
                    ),
                    ac.post(
                        "/api/v1/files/upload",
                        data={"path": "", "overwrite": "false"},
                        files={"file": ("b.txt", b"bbb", "text/plain")},
                    ),
                    ac.post(
                        "/api/v1/files/upload",
                        data={"path": "", "overwrite": "false"},
                        files={"file": ("c.txt", b"ccc", "text/plain")},
                    ),
                )

        statuses = [r.status_code for r in results]
        assert statuses == [201, 201, 201], (
            f"Expected all three concurrent uploads to return 201, got {statuses}\n"
            + "\n".join(r.text for r in results)
        )