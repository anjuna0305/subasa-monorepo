"""uuid introduced

Revision ID: fd7d9a25f32a
Revises: d9c8b26e437e
Create Date: 2026-06-09 06:16:45.440010

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid as uuid_lib
from safe_ops import (
    safe_add_column,
    safe_drop_column,
    safe_alter_column_nullable,
    safe_create_unique_constraint,
    safe_drop_unique_constraint,
    column_exists,
    column_is_nullable,
    unique_constraint_exists,
)

# revision identifiers, used by Alembic.
revision: str = 'fd7d9a25f32a'
down_revision: Union[str, Sequence[str], None] = 'd9c8b26e437e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        'api_keys', 'custom_chatbots', 'organizations',
        'service_usages', 'services', 'tasks', 'usage_logs', 'users'
    ]

    conn = op.get_bind()

    for table in tables:
        safe_add_column(table, sa.Column('uuid', sa.String(length=36), nullable=True))

        if column_exists(table, 'uuid'):
            rows = conn.execute(sa.text(
                f"SELECT id FROM {table} WHERE uuid IS NULL OR uuid = ''"
            ))
            for row in rows:
                conn.execute(
                    sa.text(f"UPDATE {table} SET uuid = :uuid WHERE id = :id"),
                    {"uuid": str(uuid_lib.uuid4()), "id": row[0]}
                )

        safe_alter_column_nullable(
            table, 'uuid',
            nullable=False,
            existing_type=sa.String(length=36),
        )

        safe_create_unique_constraint(None, table, ['uuid'])


def downgrade() -> None:
    tables = [
        'users', 'usage_logs', 'tasks', 'services',
        'service_usages', 'organizations', 'custom_chatbots', 'api_keys'
    ]

    for table in tables:
        safe_drop_unique_constraint(table, ['uuid'])
        safe_drop_column(table, 'uuid')
