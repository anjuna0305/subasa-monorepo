"""add google_id avatar_url and make hashed_password nullable

Revision ID: a3ed621aab5e
Revises: fd7d9a25f32a
Create Date: 2026-06-15 05:49:10.639432

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'a3ed621aab5e'
down_revision: Union[str, Sequence[str], None] = 'fd7d9a25f32a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))
    op.alter_column('users', 'hashed_password',
               existing_type=mysql.VARCHAR(length=255),
               nullable=True)
    op.create_unique_constraint('uq_users_google_id', 'users', ['google_id'])


def downgrade() -> None:
    op.drop_constraint('uq_users_google_id', 'users', type_='unique')
    op.alter_column('users', 'hashed_password',
               existing_type=mysql.VARCHAR(length=255),
               nullable=False)
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'google_id')
