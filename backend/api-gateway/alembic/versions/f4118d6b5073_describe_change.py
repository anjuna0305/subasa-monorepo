"""describe change

Revision ID: f4118d6b5073
Revises: 13b619a2249a
Create Date: 2026-05-06 00:26:32.813317

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql
from safe_ops import (
    safe_add_column,
    safe_drop_column,
    safe_drop_foreign_key,
    column_exists,
    foreign_key_exists,
)

# revision identifiers, used by Alembic.
revision: str = 'f4118d6b5073'
down_revision: Union[str, Sequence[str], None] = '13b619a2249a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    safe_add_column('custom_chatbots', sa.Column('retrieval_key', sa.String(length=40), nullable=True))
    safe_add_column('custom_chatbots', sa.Column('is_publish', sa.Boolean(), nullable=True))

    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fk_names = {fk['name'] for fk in inspector.get_foreign_keys('custom_chatbots')}

    if 'custom_chatbots_ibfk_2' in fk_names:
        op.drop_constraint('custom_chatbots_ibfk_2', 'custom_chatbots', type_='foreignkey')
    if 'custom_chatbots_ibfk_1' in fk_names:
        op.drop_constraint('custom_chatbots_ibfk_1', 'custom_chatbots', type_='foreignkey')

    cols_to_drop = [
        'completed_at', 'status', 'request_path', 'response_content_type',
        'request_query', 'retrie', 'error_message', 'response_status_code',
        'tokens_used', 'service_id', 'request_method', 'request_body',
        'api_key_id', 'response_body',
    ]
    for col in cols_to_drop:
        safe_drop_column('custom_chatbots', col)


def downgrade() -> None:
    safe_add_column('custom_chatbots', sa.Column('response_body', sa.BLOB(), nullable=True))
    safe_add_column('custom_chatbots', sa.Column('api_key_id', mysql.INTEGER(), autoincrement=False, nullable=False))
    safe_add_column('custom_chatbots', sa.Column('request_body', sa.BLOB(), nullable=True))
    safe_add_column('custom_chatbots', sa.Column('request_method', mysql.VARCHAR(length=10), nullable=False))
    safe_add_column('custom_chatbots', sa.Column('service_id', mysql.INTEGER(), autoincrement=False, nullable=False))
    safe_add_column('custom_chatbots', sa.Column('tokens_used', mysql.INTEGER(), autoincrement=False, nullable=False))
    safe_add_column('custom_chatbots', sa.Column('response_status_code', mysql.INTEGER(), autoincrement=False, nullable=True))
    safe_add_column('custom_chatbots', sa.Column('error_message', mysql.VARCHAR(length=1000), nullable=True))
    safe_add_column('custom_chatbots', sa.Column('retrie', mysql.VARCHAR(length=200), nullable=False))
    safe_add_column('custom_chatbots', sa.Column('request_query', mysql.VARCHAR(length=2000), nullable=True))
    safe_add_column('custom_chatbots', sa.Column('response_content_type', mysql.VARCHAR(length=200), nullable=True))
    safe_add_column('custom_chatbots', sa.Column('request_path', mysql.VARCHAR(length=500), nullable=False))
    safe_add_column('custom_chatbots', sa.Column('status', mysql.ENUM('pending', 'processing', 'completed', 'failed'), nullable=False))
    safe_add_column('custom_chatbots', sa.Column('completed_at', mysql.DATETIME(), nullable=True))
    from safe_ops import safe_create_foreign_key
    safe_create_foreign_key(op.f('custom_chatbots_ibfk_1'), 'custom_chatbots', 'api_keys', ['api_key_id'], ['id'])
    safe_create_foreign_key(op.f('custom_chatbots_ibfk_2'), 'custom_chatbots', 'services', ['service_id'], ['id'])
    safe_drop_column('custom_chatbots', 'is_publish')
    safe_drop_column('custom_chatbots', 'retrieval_key')
