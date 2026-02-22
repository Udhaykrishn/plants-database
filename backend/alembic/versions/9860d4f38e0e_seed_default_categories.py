"""Seed default categories

Revision ID: 9860d4f38e0e
Revises: 00784fae9404
Create Date: 2026-02-22 01:49:16.989594

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9860d4f38e0e'
down_revision: Union[str, None] = '00784fae9404'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


import uuid

def upgrade() -> None:
    op.execute(
        """
        INSERT INTO categories (id, name, description) VALUES
        ('{}', 'Tree', 'Woody perennial plant'),
        ('{}', 'Shrub', 'Woody plant, typically less than 8 meters'),
        ('{}', 'Palm', 'Tropical palm trees'),
        ('{}', 'Creeper', 'Creeping plants'),
        ('{}', 'Groundcover', 'Low-lying plants'),
        ('{}', 'Climber', 'Climbing plants'),
        ('{}', 'Fern', 'Ferns and similar non-flowering vascular plants'),
        ('{}', 'Grass', 'Monocotyledonous plants with narrow leaves'),
        ('{}', 'Succulent', 'Plants with thick fleshy tissues to store water'),
        ('{}', 'Aquatic', 'Plants adapted to living in aquatic environments'),
        ('{}', 'Other', 'Other miscellaneous category')
        ON CONFLICT (name) DO NOTHING;
        """.format(
            uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4(),
            uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4(),
            uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        )
    )


def downgrade() -> None:
    pass
