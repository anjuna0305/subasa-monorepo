"""modify_role

Revision ID: 856ffcac8299
Revises: 3b3296a26e23
Create Date: 2026-05-20 13:54:31.128212

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from safe_ops import safe_alter_enum

# revision identifiers, used by Alembic.
revision: str = "856ffcac8299"
down_revision: Union[str, Sequence[str], None] = "3b3296a26e23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    safe_alter_enum(
        'users', 'role',
        new_values=['organization_user', 'organization_admin'],
        existing_values=['admin', 'general_user'],
    )


def downgrade() -> None:
    safe_alter_enum(
        'users', 'role',
        new_values=['admin', 'general_user'],
        existing_values=['admin', 'general_user', 'organization_user', 'organization_admin'],
    )
