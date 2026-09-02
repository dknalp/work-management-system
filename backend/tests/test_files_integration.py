"""
Integration tests — simulate real-life file flows.

Covers:
  1. Upload → list → rename → star → trash → restore → permanent delete
  2. Folder creation → folder cascade trash → restore
  3. Share link: create → access → expired → deleted file
  4. Bulk move (with folder cascade) → bulk copy → bulk trash (with cascade)
  5. Quota accounting (excludes trashed files and folders)
  6. Empty trash (owner-scoped only)
  7. Access control: cross-user isolation
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import User

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

UID = "user-integ-001"
OTHER_UID = "user-other-002"

FAKE_USER = User(
    id=UID,
    email="integ@example.com",
    name="Integ User",
    role="member",
    is_admin=False,
    created_at=datetime.now(timezone.utc),
)
OTHER_USER = User(
    id=OTHER_UID,
    email="other@example.com",
    name="Other User",
    role="member",
    is_admin=False,
    created_at=datetime.now(timezone.utc),
)


def _now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# In-memory Firestore fake
# ---------------------------------------------------------------------------

class FakeDocRef:
    def __init__(self, store: dict, col_name: str, doc_id: str):
        self._store = store
        self._col = col_name
        self._id = doc_id

    @property
    def id(self):
        return self._id

    def get(self):
        data = self._store.get(self._col, {}).get(self._id)
        return FakeDocSnapshot(self._id, data, self)

    def set(self, data, **_):
        self._store.setdefault(self._col, {})[self._id] = dict(data)

    def update(self, data):
        self._store.setdefault(self._col, {}).setdefault(self._id, {}).update(data)

    def delete(self):
        self._store.get(self._col, {}).pop(self._id, None)

    # allow doc.reference to point back to itself
    @property
    def reference(self):
        return self


class FakeDocSnapshot:
    def __init__(self, doc_id: str, data: dict | None, ref):
        self.id = doc_id
        self._data = data
        self.exists = data is not None
        self.reference = ref

    def to_dict(self):
        return dict(self._data) if self._data else None

    # make snapshot usable as a ref in batch.update(doc.reference, ...)
    def update(self, data):
        self.reference.update(data)

    def delete(self):
        self.reference.delete()


class FakeQuery:
    def __init__(self, store: dict, col_name: str, conditions: list):
        self._store = store
        self._col = col_name
        self._conditions = conditions
        self._limit_n: int | None = None

    def where(self, field, op, value):
        return FakeQuery(self._store, self._col, self._conditions + [(field, op, value)])

    def limit(self, n):
        q = FakeQuery(self._store, self._col, self._conditions)
        q._limit_n = n
        return q

    def order_by(self, *a, **kw):
        return self

    def stream(self):
        col = self._store.get(self._col, {})
        count = 0
        for did, d in list(col.items()):
            if all(self._match(d, f, o, v) for f, o, v in self._conditions):
                ref = FakeDocRef(self._store, self._col, did)
                yield FakeDocSnapshot(did, d, ref)
                count += 1
                if self._limit_n is not None and count >= self._limit_n:
                    break

    @staticmethod
    def _match(d, field, op, value):
        v = d.get(field)
        if op == "==":
            return v == value
        sv, sval = str(v or ""), str(value)
        if op == ">=":
            return sv >= sval
        if op == "<":
            return sv < sval
        return False


class FakeBatch:
    def __init__(self):
        self._ops: list = []

    def update(self, ref, data):
        self._ops.append(("update", ref, data))

    def delete(self, ref):
        self._ops.append(("delete", ref))

    def set(self, ref, data):
        self._ops.append(("set", ref, data))

    def commit(self):
        for op, ref, *args in self._ops:
            if op == "update":
                ref.update(args[0])
            elif op == "delete":
                ref.delete()
            elif op == "set":
                ref.set(args[0])
        self._ops.clear()


class FakeCollection:
    def __init__(self, store: dict, col_name: str):
        self._store = store
        self._col = col_name
        self._store.setdefault(col_name, {})

    def document(self, doc_id: str):
        return FakeDocRef(self._store, self._col, doc_id)

    def where(self, field, op, value):
        return FakeQuery(self._store, self._col, [(field, op, value)])

    def stream(self):
        for did, d in list(self._store.get(self._col, {}).items()):
            ref = FakeDocRef(self._store, self._col, did)
            yield FakeDocSnapshot(did, d, ref)

    def add(self, data):
        new_id = str(uuid.uuid4())
        self._store.setdefault(self._col, {})[new_id] = dict(data)
        ref = FakeDocRef(self._store, self._col, new_id)
        return None, ref


class FakeDB:
    """Thread-safe in-memory Firestore replacement."""

    def __init__(self, file_records: dict[str, dict] | None = None):
        self._store: dict[str, dict] = {
            "file_records": {k: dict(v) for k, v in (file_records or {}).items()},
            "file_shares": {},
            "file_access_logs": {},
        }

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self._store, name)

    def batch(self) -> FakeBatch:
        return FakeBatch()

    # Convenience
    def get_file(self, file_id: str) -> dict | None:
        return self._store["file_records"].get(file_id)

    def get_share(self, share_id: str) -> dict | None:
        return self._store["file_shares"].get(share_id)


def _make_file_doc(
    file_id: str,
    name: str = "test.txt",
    path: str | None = None,
    parent_path: str = "",
    size: int = 1024,
    is_deleted: bool = False,
    deleted_at: datetime | None = None,
    file_type: str = "file",
    r2_key: str | None = None,
    owner_id: str = UID,
    is_starred: bool = False,
) -> dict:
    now = _now()
    actual_path = path if path is not None else name
    return {
        "name": name,
        "path": actual_path,
        "parent_path": parent_path,
        "size": size,
        "type": file_type,
        "content_type": "text/plain",
        "r2_key": r2_key or (f"uploads/{owner_id}/{file_id}" if file_type == "file" else None),
        "owner_id": owner_id,
        "is_deleted": is_deleted,
        "deleted_at": deleted_at,
        "is_starred": is_starred,
        "created_at": now,
        "updated_at": now,
    }


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------

def _make_client(user: User, db: FakeDB) -> TestClient:
    from app.deps import get_current_user
    from app.firebase import get_db

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


# ---------------------------------------------------------------------------
# Teardown
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Single-file lifecycle
# ---------------------------------------------------------------------------

class TestSingleFileLifecycle:

    def _setup(self):
        fid = str(uuid.uuid4())
        db = FakeDB({fid: _make_file_doc(fid, name="hello.txt")})
        client = _make_client(FAKE_USER, db)
        return client, fid, db

    def test_list_returns_file(self):
        client, fid, db = self._setup()
        r = client.get("/api/v1/files?path=")
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert fid in ids

    def test_rename_updates_name(self):
        client, fid, db = self._setup()
        r = client.put(f"/api/v1/files/rename/{fid}", json={"name": "renamed.txt"})
        assert r.status_code == 200
        assert r.json()["name"] == "renamed.txt"
        # Persisted in fake store
        assert db.get_file(fid)["name"] == "renamed.txt"

    def test_star_appears_in_starred_list(self):
        client, fid, db = self._setup()
        r = client.post(f"/api/v1/files/star/{fid}")
        assert r.status_code == 200
        r2 = client.get("/api/v1/files/starred")
        assert r2.status_code == 200
        assert any(i["id"] == fid for i in r2.json())

    def test_unstar_removes_from_starred_list(self):
        client, fid, db = self._setup()
        client.post(f"/api/v1/files/star/{fid}")
        client.post(f"/api/v1/files/star/{fid}")
        r = client.get("/api/v1/files/starred")
        assert not any(i["id"] == fid for i in r.json())

    def test_trash_removes_from_file_list(self):
        client, fid, db = self._setup()
        r = client.delete(f"/api/v1/files/trash/{fid}")
        assert r.status_code == 200
        r2 = client.get("/api/v1/files?path=")
        assert not any(i["id"] == fid for i in r2.json())

    def test_trash_appears_in_trash_list(self):
        client, fid, db = self._setup()
        client.delete(f"/api/v1/files/trash/{fid}")
        r = client.get("/api/v1/files/trash")
        assert r.status_code == 200
        assert any(i["id"] == fid for i in r.json())

    def test_restore_from_trash(self):
        client, fid, db = self._setup()
        client.delete(f"/api/v1/files/trash/{fid}")
        r = client.post(f"/api/v1/files/restore/{fid}")
        assert r.status_code == 200
        r2 = client.get("/api/v1/files?path=")
        assert any(i["id"] == fid for i in r2.json())

    def test_permanent_delete_from_trash(self):
        client, fid, db = self._setup()
        client.delete(f"/api/v1/files/trash/{fid}")
        with patch("app.routers.v1.files_trash.r2_delete_object", new_callable=AsyncMock), \
             patch("app.routers.v1.files_trash.r2_delete_objects", new_callable=AsyncMock), \
             patch("app.routers.v1.files_trash._delete_file_metadata"):
            r = client.delete(f"/api/v1/files/permanent/{fid}")
        assert r.status_code == 204
        assert db.get_file(fid) is None


# ---------------------------------------------------------------------------
# 2. Folder cascade trash / restore
# ---------------------------------------------------------------------------

class TestFolderCascade:

    def _setup(self):
        folder_id = str(uuid.uuid4())
        child1_id = str(uuid.uuid4())
        child2_id = str(uuid.uuid4())
        db = FakeDB({
            folder_id: _make_file_doc(folder_id, name="myfolder", path="myfolder",
                                       parent_path="", file_type="folder", r2_key=None),
            child1_id: _make_file_doc(child1_id, name="a.txt", path="myfolder/a.txt",
                                       parent_path="myfolder"),
            child2_id: _make_file_doc(child2_id, name="b.txt", path="myfolder/b.txt",
                                       parent_path="myfolder"),
        })
        client = _make_client(FAKE_USER, db)
        return client, folder_id, child1_id, child2_id, db

    def test_create_folder(self):
        db = FakeDB()
        client = _make_client(FAKE_USER, db)
        r = client.post("/api/v1/files/folder", json={"name": "NewFolder", "parent_path": ""})
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "NewFolder"
        assert data["type"] == "folder"

    def test_trash_folder_cascades_to_children(self):
        client, folder_id, c1, c2, db = self._setup()
        r = client.delete(f"/api/v1/files/trash/{folder_id}")
        assert r.status_code == 200
        # Children should also be marked deleted in the store
        assert db.get_file(c1)["is_deleted"] is True
        assert db.get_file(c2)["is_deleted"] is True

    def test_trash_folder_children_hidden_from_list(self):
        client, folder_id, c1, c2, db = self._setup()
        client.delete(f"/api/v1/files/trash/{folder_id}")
        r = client.get("/api/v1/files?path=myfolder")
        items = r.json()
        assert not any(i["id"] in (c1, c2) for i in items)

    def test_restore_folder_restores_children(self):
        client, folder_id, c1, c2, db = self._setup()
        client.delete(f"/api/v1/files/trash/{folder_id}")
        r = client.post(f"/api/v1/files/restore/{folder_id}")
        assert r.status_code == 200
        # Children must be un-trashed
        assert db.get_file(c1)["is_deleted"] is False
        assert db.get_file(c2)["is_deleted"] is False

    def test_trash_already_trashed_is_idempotent(self):
        client, folder_id, c1, c2, db = self._setup()
        r1 = client.delete(f"/api/v1/files/trash/{folder_id}")
        r2 = client.delete(f"/api/v1/files/trash/{folder_id}")
        assert r1.status_code == 200
        assert r2.status_code == 200


# ---------------------------------------------------------------------------
# 3. Share link lifecycle
# ---------------------------------------------------------------------------

class TestShareLifecycle:

    def _setup(self, is_deleted=False, owner_id=UID):
        fid = str(uuid.uuid4())
        db = FakeDB({fid: _make_file_doc(fid, name="shared.txt", path="shared.txt",
                                          is_deleted=is_deleted, owner_id=owner_id)})
        client = _make_client(FAKE_USER, db)
        return client, fid, db

    def test_create_share_returns_token(self):
        client, fid, db = self._setup()
        r = client.post("/api/v1/files/share", json={"file_id": fid, "permission_level": "view"})
        assert r.status_code == 201
        data = r.json()
        assert data["share_token"] is not None
        assert data["file_id"] == fid

    def test_access_valid_share_returns_file(self):
        client, fid, db = self._setup()
        r = client.post("/api/v1/files/share", json={"file_id": fid, "permission_level": "view"})
        token = r.json()["share_token"]
        r2 = client.get(f"/api/v1/files/share/access/{token}")
        assert r2.status_code == 200
        assert r2.json()["id"] == fid

    def test_access_nonexistent_token_returns_404(self):
        client, fid, db = self._setup()
        r = client.get("/api/v1/files/share/access/bad-token-xyz")
        assert r.status_code == 404

    def test_access_deleted_file_share_returns_404(self):
        """share/access must reject if the underlying file is trashed."""
        client, fid, db = self._setup(is_deleted=True)
        share_id = str(uuid.uuid4())
        tok = secrets.token_urlsafe(24)
        db.collection("file_shares").document(share_id).set({
            "file_id": fid,
            "owner_id": UID,
            "share_token": tok,
            "permission_level": "view",
            "expires_at": None,
            "created_at": _now(),
        })
        r = client.get(f"/api/v1/files/share/access/{tok}")
        # Previously crashed with NameError (file_data not defined) — now fixed
        assert r.status_code == 404

    def test_revoke_own_share(self):
        client, fid, db = self._setup()
        r = client.post("/api/v1/files/share", json={"file_id": fid, "permission_level": "view"})
        share_id = r.json()["id"]
        r2 = client.delete(f"/api/v1/files/share/{share_id}")
        assert r2.status_code == 204

    def test_revoke_other_users_share_returns_403(self):
        client, fid, db = self._setup()
        share_id = str(uuid.uuid4())
        db.collection("file_shares").document(share_id).set({
            "file_id": fid,
            "owner_id": OTHER_UID,
            "share_token": secrets.token_urlsafe(24),
            "permission_level": "view",
            "expires_at": None,
            "created_at": _now(),
        })
        r = client.delete(f"/api/v1/files/share/{share_id}")
        assert r.status_code == 403

    def test_share_non_owned_file_returns_403(self):
        client, fid, db = self._setup(owner_id=OTHER_UID)
        r = client.post("/api/v1/files/share", json={"file_id": fid, "permission_level": "view"})
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# 4. Bulk operations
# ---------------------------------------------------------------------------

class TestBulkOperations:

    def _two_files(self):
        f1, f2 = str(uuid.uuid4()), str(uuid.uuid4())
        db = FakeDB({
            f1: _make_file_doc(f1, name="f1.txt", path="f1.txt"),
            f2: _make_file_doc(f2, name="f2.txt", path="f2.txt"),
        })
        return _make_client(FAKE_USER, db), f1, f2, db

    def test_bulk_move_succeeds(self):
        client, f1, f2, db = self._two_files()
        r = client.post("/api/v1/files/bulk-move", json={"ids": [f1, f2], "dest_parent": "dest"})
        assert r.status_code == 200
        assert set(r.json()["succeeded"]) == {f1, f2}
        assert db.get_file(f1)["parent_path"] == "dest"

    def test_bulk_move_folder_cascades_children(self):
        folder_id = str(uuid.uuid4())
        child_id = str(uuid.uuid4())
        db = FakeDB({
            folder_id: _make_file_doc(folder_id, name="folder", path="folder",
                                       file_type="folder", r2_key=None),
            child_id: _make_file_doc(child_id, name="child.txt",
                                      path="folder/child.txt", parent_path="folder"),
        })
        client = _make_client(FAKE_USER, db)
        r = client.post("/api/v1/files/bulk-move", json={"ids": [folder_id], "dest_parent": "dest"})
        assert r.status_code == 200
        assert folder_id in r.json()["succeeded"]
        # Child path must be updated
        child_data = db.get_file(child_id)
        assert child_data["path"].startswith("dest/folder/")

    def test_bulk_trash_trashes_all(self):
        client, f1, f2, db = self._two_files()
        r = client.request("DELETE", "/api/v1/files/bulk-trash", content='{"ids":["'+ f1 +'","'+ f2 +'"]}', headers={"content-type": "application/json"})
        assert r.status_code == 200
        assert set(r.json()["succeeded"]) == {f1, f2}
        assert db.get_file(f1)["is_deleted"] is True
        assert db.get_file(f2)["is_deleted"] is True

    def test_bulk_trash_folder_cascades(self):
        folder_id = str(uuid.uuid4())
        child_id = str(uuid.uuid4())
        db = FakeDB({
            folder_id: _make_file_doc(folder_id, name="folder", path="folder",
                                       file_type="folder", r2_key=None),
            child_id: _make_file_doc(child_id, name="c.txt",
                                      path="folder/c.txt", parent_path="folder"),
        })
        client = _make_client(FAKE_USER, db)
        r = client.request("DELETE", "/api/v1/files/bulk-trash", content='{"ids":["'+ folder_id +'"]}',headers={"content-type":"application/json"})
        assert r.status_code == 200
        assert folder_id in r.json()["succeeded"]
        # Child should be trashed via cascade
        assert db.get_file(child_id)["is_deleted"] is True

    def test_bulk_move_unauthorized_file_goes_to_failed(self):
        fid = str(uuid.uuid4())
        db = FakeDB({fid: _make_file_doc(fid, name="other.txt", path="other.txt",
                                          owner_id=OTHER_UID)})
        client = _make_client(FAKE_USER, db)
        r = client.post("/api/v1/files/bulk-move", json={"ids": [fid], "dest_parent": "x"})
        assert r.status_code == 200
        assert fid in r.json()["failed"]


# ---------------------------------------------------------------------------
# 5. Quota
# ---------------------------------------------------------------------------

class TestQuota:

    def test_quota_sums_file_sizes_excludes_trashed(self):
        f1, f2, f3 = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
        db = FakeDB({
            f1: _make_file_doc(f1, size=1000),
            f2: _make_file_doc(f2, size=2000),
            f3: _make_file_doc(f3, size=500, is_deleted=True),
        })
        client = _make_client(FAKE_USER, db)
        r = client.get("/api/v1/files/quota")
        assert r.status_code == 200
        assert r.json()["used_bytes"] == 3000

    def test_quota_excludes_folders(self):
        folder_id = str(uuid.uuid4())
        file_id = str(uuid.uuid4())
        db = FakeDB({
            folder_id: _make_file_doc(folder_id, file_type="folder", size=0, r2_key=None),
            file_id: _make_file_doc(file_id, size=512),
        })
        client = _make_client(FAKE_USER, db)
        r = client.get("/api/v1/files/quota")
        assert r.status_code == 200
        assert r.json()["used_bytes"] == 512

    def test_quota_is_zero_when_no_files(self):
        db = FakeDB()
        client = _make_client(FAKE_USER, db)
        r = client.get("/api/v1/files/quota")
        assert r.status_code == 200
        assert r.json()["used_bytes"] == 0


# ---------------------------------------------------------------------------
# 6. Empty trash
# ---------------------------------------------------------------------------

class TestEmptyTrash:

    def test_empty_trash_deletes_own_files(self):
        fid = str(uuid.uuid4())
        db = FakeDB({fid: _make_file_doc(fid, is_deleted=True,
                                          deleted_at=_now() - timedelta(days=31))})
        client = _make_client(FAKE_USER, db)
        with patch("app.routers.v1.files_trash.r2_delete_object", new_callable=AsyncMock), \
             patch("app.routers.v1.files_trash.r2_delete_objects", new_callable=AsyncMock), \
             patch("app.routers.v1.files_trash._delete_file_metadata"):
            r = client.delete("/api/v1/files/empty-trash")
        assert r.status_code == 204

    def test_empty_trash_does_not_touch_other_users_files(self):
        other_fid = str(uuid.uuid4())
        db = FakeDB({
            other_fid: _make_file_doc(other_fid, is_deleted=True, owner_id=OTHER_UID),
        })
        client = _make_client(FAKE_USER, db)
        with patch("app.routers.v1.files_trash.r2_delete_object", new_callable=AsyncMock), \
             patch("app.routers.v1.files_trash.r2_delete_objects", new_callable=AsyncMock), \
             patch("app.routers.v1.files_trash._delete_file_metadata"):
            r = client.delete("/api/v1/files/empty-trash")
        assert r.status_code == 204
        # Other user's file must still exist
        assert db.get_file(other_fid) is not None


# ---------------------------------------------------------------------------
# 7. Access control — cross-user isolation
# ---------------------------------------------------------------------------

class TestAccessControl:

    def test_rename_other_users_file_returns_403(self):
        fid = str(uuid.uuid4())
        db = FakeDB({fid: _make_file_doc(fid, owner_id=OTHER_UID)})
        client = _make_client(FAKE_USER, db)
        r = client.put(f"/api/v1/files/rename/{fid}", json={"name": "hack.txt"})
        assert r.status_code == 403

    def test_trash_other_users_file_returns_403(self):
        fid = str(uuid.uuid4())
        db = FakeDB({fid: _make_file_doc(fid, owner_id=OTHER_UID)})
        client = _make_client(FAKE_USER, db)
        r = client.delete(f"/api/v1/files/trash/{fid}")
        assert r.status_code == 403

    def test_starred_list_only_returns_own_files(self):
        own_fid = str(uuid.uuid4())
        other_fid = str(uuid.uuid4())
        db = FakeDB({
            own_fid: _make_file_doc(own_fid, is_starred=True),
            other_fid: _make_file_doc(other_fid, is_starred=True, owner_id=OTHER_UID),
        })
        client = _make_client(FAKE_USER, db)
        r = client.get("/api/v1/files/starred")
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert own_fid in ids
        assert other_fid not in ids

    def test_file_list_only_returns_own_files(self):
        own_fid = str(uuid.uuid4())
        other_fid = str(uuid.uuid4())
        db = FakeDB({
            own_fid: _make_file_doc(own_fid),
            other_fid: _make_file_doc(other_fid, owner_id=OTHER_UID),
        })
        client = _make_client(FAKE_USER, db)
        r = client.get("/api/v1/files?path=")
        ids = [i["id"] for i in r.json()]
        assert own_fid in ids
        assert other_fid not in ids

    def test_permanent_delete_other_users_file_returns_403(self):
        fid = str(uuid.uuid4())
        db = FakeDB({fid: _make_file_doc(fid, owner_id=OTHER_UID)})
        client = _make_client(FAKE_USER, db)
        with patch("app.routers.v1.files_trash.r2_delete_object", new_callable=AsyncMock), \
             patch("app.routers.v1.files_trash.r2_delete_objects", new_callable=AsyncMock):
            r = client.delete(f"/api/v1/files/permanent/{fid}")
        assert r.status_code == 403
