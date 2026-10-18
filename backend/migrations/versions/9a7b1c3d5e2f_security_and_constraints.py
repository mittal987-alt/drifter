"""security_and_constraints

Revision ID: 9a7b1c3d5e2f
Revises: 8807fa3c18e4
Create Date: 2026-10-17 19:50:00.000000

Phase 2 Security & Data Integrity:
  1. Add is_active column to users table (default True).
  2. Add unique constraint 'uq_user_provider' on connections(user_id, provider).
  3. Enforce foreign-key constraints with ON DELETE CASCADE to users.id:
     - connections.user_id -> users.id
     - history_events.user_id -> users.id
     - analysis_results.user_id -> users.id
     - portability_export_jobs.user_id -> users.id
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a7b1c3d5e2f'
down_revision: Union[str, None] = '8807fa3c18e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users: add is_active
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true())
        )

    # 2. connections: foreign key and unique constraint
    with op.batch_alter_table('connections', schema=None) as batch_op:
        batch_op.create_foreign_key(
            'fk_connections_user_id_users',
            'users',
            ['user_id'],
            ['id'],
            ondelete='CASCADE',
        )
        batch_op.create_unique_constraint(
            'uq_user_provider',
            ['user_id', 'provider'],
        )

    # 3. history_events: foreign key
    with op.batch_alter_table('history_events', schema=None) as batch_op:
        batch_op.create_foreign_key(
            'fk_history_events_user_id_users',
            'users',
            ['user_id'],
            ['id'],
            ondelete='CASCADE',
        )

    # 4. analysis_results: foreign key
    with op.batch_alter_table('analysis_results', schema=None) as batch_op:
        batch_op.create_foreign_key(
            'fk_analysis_results_user_id_users',
            'users',
            ['user_id'],
            ['id'],
            ondelete='CASCADE',
        )

    # 5. portability_export_jobs: foreign key
    with op.batch_alter_table('portability_export_jobs', schema=None) as batch_op:
        batch_op.create_foreign_key(
            'fk_portability_export_jobs_user_id_users',
            'users',
            ['user_id'],
            ['id'],
            ondelete='CASCADE',
        )


def downgrade() -> None:
    with op.batch_alter_table('portability_export_jobs', schema=None) as batch_op:
        batch_op.drop_constraint('fk_portability_export_jobs_user_id_users', type_='foreignkey')

    with op.batch_alter_table('analysis_results', schema=None) as batch_op:
        batch_op.drop_constraint('fk_analysis_results_user_id_users', type_='foreignkey')

    with op.batch_alter_table('history_events', schema=None) as batch_op:
        batch_op.drop_constraint('fk_history_events_user_id_users', type_='foreignkey')

    with op.batch_alter_table('connections', schema=None) as batch_op:
        batch_op.drop_constraint('uq_user_provider', type_='unique')
        batch_op.drop_constraint('fk_connections_user_id_users', type_='foreignkey')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('is_active')
