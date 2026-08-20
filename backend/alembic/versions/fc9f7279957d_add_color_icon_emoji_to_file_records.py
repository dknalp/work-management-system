"""add color icon_emoji to file_records

Revision ID: fc9f7279957d
Revises: b8a3446c5141
Create Date: 2026-08-17 16:01:52.947999

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc9f7279957d'
down_revision: Union[str, Sequence[str], None] = 'b8a3446c5141'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:t)"
        ),
        {"t": table_name},
    )
    return result.scalar()


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=:t AND column_name=:c)"
        ),
        {"t": table_name, "c": column_name},
    )
    return result.scalar()


def upgrade() -> None:
    """Upgrade schema."""
    if not _table_exists('file_records'):
        return
    if not _column_exists('file_records', 'color'):
        op.add_column('file_records', sa.Column('color', sa.String(length=32), nullable=True))
    if not _column_exists('file_records', 'icon_emoji'):
        op.add_column('file_records', sa.Column('icon_emoji', sa.String(length=8), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    if not _table_exists('file_records'):
        return
    if _column_exists('file_records', 'icon_emoji'):
        op.drop_column('file_records', 'icon_emoji')
    if _column_exists('file_records', 'color'):
        op.drop_column('file_records', 'color')