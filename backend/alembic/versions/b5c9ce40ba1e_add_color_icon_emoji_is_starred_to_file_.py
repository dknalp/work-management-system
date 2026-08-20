"""add color icon_emoji is_starred to file_records

Revision ID: b5c9ce40ba1e
Revises: fc9f7279957d
Create Date: 2026-08-17 16:36:32.569401

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'b5c9ce40ba1e'
down_revision: Union[str, Sequence[str], None] = 'fc9f7279957d'
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
    # file_records is created by SQLModel create_db_and_tables() at runtime,
    # not by a migration. If it doesn't exist yet (fresh deploy, migrations run
    # before uvicorn), skip everything — uvicorn will create the table and
    # migrate_db() will add any missing columns.
    if not _table_exists('file_records'):
        return

    if not _table_exists('file_access_logs'):
        op.create_table(
            'file_access_logs',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('file_id', sa.Uuid(), nullable=False),
            sa.Column('user_id', sa.Uuid(), nullable=False),
            sa.Column('action', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
            sa.Column('accessed_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['file_id'], ['file_records.id']),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        conn = op.get_bind()
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_file_access_logs_file_id ON file_access_logs (file_id)"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_file_access_logs_user_id ON file_access_logs (user_id)"
        ))

    if not _table_exists('file_shares'):
        op.create_table(
            'file_shares',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('file_id', sa.Uuid(), nullable=False),
            sa.Column('owner_id', sa.Uuid(), nullable=False),
            sa.Column('shared_with_user_id', sa.Uuid(), nullable=True),
            sa.Column('share_token', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True),
            sa.Column('permission_level', sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['file_id'], ['file_records.id']),
            sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
            sa.ForeignKeyConstraint(['shared_with_user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        conn = op.get_bind()
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_file_shares_file_id ON file_shares (file_id)"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_file_shares_share_token ON file_shares (share_token)"
        ))

    if not _column_exists('file_records', 'is_starred'):
        op.add_column('file_records', sa.Column('is_starred', sa.Boolean(), nullable=False, server_default=sa.false()))
        conn = op.get_bind()
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_file_records_is_starred ON file_records (is_starred)"
        ))


def downgrade() -> None:
    """Downgrade schema."""
    if not _table_exists('file_records'):
        return

    if _table_exists('file_access_logs'):
        conn = op.get_bind()
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_file_access_logs_user_id"))
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_file_access_logs_file_id"))
        op.drop_table('file_access_logs')

    if _table_exists('file_shares'):
        conn = op.get_bind()
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_file_shares_share_token"))
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_file_shares_file_id"))
        op.drop_table('file_shares')

    if _column_exists('file_records', 'is_starred'):
        conn = op.get_bind()
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_file_records_is_starred"))
        op.drop_column('file_records', 'is_starred')
