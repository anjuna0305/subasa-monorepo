"""new models added

Revision ID: c7a82ab91a84
Revises: d7e806040a44
Create Date: 2026-05-18 19:37:02.375493

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from safe_ops import (
    safe_add_column,
    safe_drop_column,
    safe_create_foreign_key,
    safe_drop_foreign_keys_on_columns,
    column_exists,
)

# revision identifiers, used by Alembic.
revision: str = 'c7a82ab91a84'
down_revision: Union[str, Sequence[str], None] = 'd7e806040a44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    safe_add_column('custom_chatbots', sa.Column('organization_id', sa.Integer(), nullable=True))
    safe_add_column('custom_chatbots', sa.Column('is_public', sa.Boolean(), nullable=True))

    safe_create_foreign_key(None, 'custom_chatbots', 'organizations', ['organization_id'], ['id'])

    safe_add_column('users', sa.Column('organization_id', sa.Integer(), nullable=True))
    safe_create_foreign_key(None, 'users', 'organizations', ['organization_id'], ['id'])


def downgrade() -> None:
    safe_drop_foreign_keys_on_columns('users', ['organization_id'])
    safe_drop_column('users', 'organization_id')
    safe_drop_foreign_keys_on_columns('custom_chatbots', ['organization_id'])
    safe_drop_column('custom_chatbots', 'is_public')
    safe_drop_column('custom_chatbots', 'organization_id')
