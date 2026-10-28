"""extension_auth_sessions

Revision ID: c1d2e3f4a5b6
Revises: 9a7b1c3d5e2f
Create Date: 2026-10-28 20:00:00.000000

Phase 2 Extension Auth & PKCE Sessions:
  1. Create extension_tokens table if not existing.
  2. Create extension_auth_sessions table with PKCE support and constraints.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = '9a7b1c3d5e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Create extension_tokens if missing
    if "extension_tokens" not in tables:
        op.create_table(
            "extension_tokens",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("token_prefix", sa.String(length=16), nullable=False),
            sa.Column("client_name", sa.String(length=100), nullable=False, server_default="Chrome Extension"),
            sa.Column("permissions", sa.Text(), nullable=False, server_default='["youtube", "spotify", "web"]'),
            sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("last_used_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_extension_tokens_user_id_users", ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("extension_tokens", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_extension_tokens_id"), ["id"], unique=False)
            batch_op.create_index(batch_op.f("ix_extension_tokens_user_id"), ["user_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_extension_tokens_token_hash"), ["token_hash"], unique=True)

    # 2. Create extension_auth_sessions if missing
    if "extension_auth_sessions" not in tables:
        op.create_table(
            "extension_auth_sessions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("session_id", sa.String(length=64), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("code_challenge", sa.String(length=128), nullable=False),
            sa.Column("code_challenge_method", sa.String(length=10), nullable=False, server_default="S256"),
            sa.Column("state", sa.String(length=128), nullable=False),
            sa.Column("client_name", sa.String(length=100), nullable=False, server_default="Chrome Extension"),
            sa.Column("permissions", sa.Text(), nullable=False, server_default='["youtube", "spotify", "web"]'),
            sa.Column("auth_code_hash", sa.String(length=64), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
            sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_extension_auth_sessions_user_id_users", ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("extension_auth_sessions", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_extension_auth_sessions_id"), ["id"], unique=False)
            batch_op.create_index(batch_op.f("ix_extension_auth_sessions_session_id"), ["session_id"], unique=True)
            batch_op.create_index(batch_op.f("ix_extension_auth_sessions_user_id"), ["user_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_extension_auth_sessions_state"), ["state"], unique=False)
            batch_op.create_index(batch_op.f("ix_extension_auth_sessions_auth_code_hash"), ["auth_code_hash"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("extension_auth_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_extension_auth_sessions_auth_code_hash"))
        batch_op.drop_index(batch_op.f("ix_extension_auth_sessions_state"))
        batch_op.drop_index(batch_op.f("ix_extension_auth_sessions_user_id"))
        batch_op.drop_index(batch_op.f("ix_extension_auth_sessions_session_id"))
        batch_op.drop_index(batch_op.f("ix_extension_auth_sessions_id"))

    op.drop_table("extension_auth_sessions")
