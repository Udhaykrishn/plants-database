"""Fix plant category caps

Revision ID: 2d446705fee3
Revises: 9860d4f38e0e
Create Date: 2026-02-22 02:30:21.188989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d446705fee3'
down_revision: Union[str, None] = '9860d4f38e0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE plants SET category = initcap(category)")


def downgrade() -> None:
    pass
