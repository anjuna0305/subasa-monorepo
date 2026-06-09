"""modify_role

Revision ID: 856ffcac8299
Revises: 3b3296a26e23
Create Date: 2026-05-20 13:54:31.128212

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "856ffcac8299"
down_revision: Union[str, Sequence[str], None] = "3b3296a26e23"
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
