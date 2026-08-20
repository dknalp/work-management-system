"""merge_heads

Revision ID: d410446feb9b
Revises: a1b2c3d4e5f6, b5c9ce40ba1e
Create Date: 2026-08-20 20:01:36.093596

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd410446feb9b'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'b5c9ce40ba1e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
