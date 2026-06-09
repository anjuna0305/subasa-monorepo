"""add_org_roles_to_user_role_enum

Revision ID: 3b3296a26e23
Revises: 31dcbdef41d7
Create Date: 2026-05-20 13:45:15.504398

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3b3296a26e23"
down_revision: Union[str, Sequence[str], None] = "31dcbdef41d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        "ALTER TABLE users MODIFY COLUMN role "
        "ENUM('admin','general_user','organization_user','organization_admin') NOT NULL"
    )
    pass


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "ALTER TABLE users MODIFY COLUMN role ENUM('admin','general_user') NOT NULL"
    )
    pass
