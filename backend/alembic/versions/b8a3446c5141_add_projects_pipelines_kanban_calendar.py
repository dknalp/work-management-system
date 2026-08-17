"""add projects pipelines kanban calendar

Revision ID: b8a3446c5141
Revises:
Create Date: 2026-07-02 20:25:09.162849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b8a3446c5141'
down_revision: Union[str, Sequence[str], None] = None
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
    if _table_exists('role_permissions'):
        op.alter_column('role_permissions', 'role',
                   existing_type=sa.VARCHAR(length=20),
                   type_=sqlmodel.sql.sqltypes.AutoString(length=50),
                   existing_nullable=False)

    if _table_exists('tasks'):
        op.alter_column('tasks', 'completed_at',
                   existing_type=postgresql.TIMESTAMP(timezone=True),
                   type_=sa.DateTime(),
                   existing_nullable=True)
        if _column_exists('tasks', 'assignee'):
            op.drop_column('tasks', 'assignee')

    if _table_exists('users'):
        op.alter_column('users', 'role',
                   existing_type=sa.VARCHAR(length=20),
                   type_=sqlmodel.sql.sqltypes.AutoString(length=50),
                   existing_nullable=False,
                   existing_server_default=sa.text("'member'::character varying"))


def downgrade() -> None:
    """Downgrade schema."""
    if _table_exists('users'):
        op.alter_column('users', 'role',
                   existing_type=sqlmodel.sql.sqltypes.AutoString(length=50),
                   type_=sa.VARCHAR(length=20),
                   existing_nullable=False,
                   existing_server_default=sa.text("'member'::character varying"))

    if _table_exists('tasks'):
        if not _column_exists('tasks', 'assignee'):
            op.add_column('tasks', sa.Column('assignee', sa.VARCHAR(length=200), autoincrement=False, nullable=False))
        op.alter_column('tasks', 'completed_at',
                   existing_type=sa.DateTime(),
                   type_=postgresql.TIMESTAMP(timezone=True),
                   existing_nullable=True)

    if _table_exists('role_permissions'):
        op.alter_column('role_permissions', 'role',
                   existing_type=sqlmodel.sql.sqltypes.AutoString(length=50),
                   type_=sa.VARCHAR(length=20),
                   existing_nullable=False)