"""add project_share_links table

Revision ID: b3f1c9d2e5a7
Revises: 2feca7804718
Create Date: 2026-03-09 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f1c9d2e5a7'
down_revision: Union[str, None] = '2feca7804718'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_share_links',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index(op.f('ix_project_share_links_token'), 'project_share_links', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_project_share_links_token'), table_name='project_share_links')
    op.drop_table('project_share_links')
