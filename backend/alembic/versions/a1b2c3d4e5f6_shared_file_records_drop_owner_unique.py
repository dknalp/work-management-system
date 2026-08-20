"""shared file records: drop owner+path unique, add path-only unique

Revision ID: a1b2c3d4e5f6
Revises: fc9f7279957d
Create Date: 2026-08-20 12:00:00.000000

Files are stored in shared R2/local storage but were previously recorded
with a per-user unique constraint (owner_id, path).  This meant the same
path could appear multiple times in the DB — once per user — making
uploads by one user invisible to others.

This migration drops the old composite constraint and replaces it with a
simple path-only unique constraint so every path has exactly one record
that is visible to all users.
"""

from typing import Sequence, Union
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "fc9f7279957d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove duplicate rows first: keep the newest record for each path,
    # delete older duplicates introduced by the old per-user constraint.
    op.execute("""
        DELETE FROM file_records
        WHERE id NOT IN (
            SELECT DISTINCT ON (path) id
            FROM file_records
            ORDER BY path, updated_at DESC NULLS LAST, id
        )
    """)

    # Drop old composite unique constraint
    op.drop_constraint("uq_file_record_owner_path", "file_records", type_="unique")

    # Add new path-only unique constraint
    op.create_unique_constraint("uq_file_record_path", "file_records", ["path"])


def downgrade() -> None:
    op.drop_constraint("uq_file_record_path", "file_records", type_="unique")
    op.create_unique_constraint(
        "uq_file_record_owner_path", "file_records", ["owner_id", "path"]
    )