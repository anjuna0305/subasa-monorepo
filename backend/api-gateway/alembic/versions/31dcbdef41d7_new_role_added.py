"""new role added

Revision ID: 31dcbdef41d7
Revises: c7a82ab91a84
Create Date: 2026-05-20 13:39:02.385815

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '31dcbdef41d7'
down_revision: Union[str, Sequence[str], None] = 'c7a82ab91a84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
