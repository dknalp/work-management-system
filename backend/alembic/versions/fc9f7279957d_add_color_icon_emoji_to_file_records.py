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


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('file_records', sa.Column('color', sa.String(length=32), nullable=True))
    op.add_column('file_records', sa.Column('icon_emoji', sa.String(length=8), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('file_records', 'icon_emoji')
    op.drop_column('file_records', 'color')