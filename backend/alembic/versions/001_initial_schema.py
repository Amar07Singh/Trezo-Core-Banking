"""initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-18 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. accounts
    op.create_table(
        'accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('account_number', sa.String(length=32), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='GBP'),
        sa.Column('balance', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('balance >= 0', name='chk_account_balance_non_negative'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_accounts_account_number'), 'accounts', ['account_number'], unique=True)
    op.create_index(op.f('ix_accounts_user_id'), 'accounts', ['user_id'], unique=False)

    # 3. journal_entries
    op.create_table(
        'journal_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('reference', sa.String(length=64), nullable=False),
        sa.Column('narration', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(op.f('ix_journal_entries_reference'), 'journal_entries', ['reference'], unique=True)

    # 4. ledger_entries
    op.create_table(
        'ledger_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('journal_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entry_type', sa.String(length=16), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('balance_after', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('amount > 0', name='chk_ledger_entry_amount_positive'),
        sa.ForeignKeyConstraint(['journal_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='RESTRICT'),
    )
    op.create_index(op.f('ix_ledger_entries_journal_id'), 'ledger_entries', ['journal_id'], unique=False)
    op.create_index(op.f('ix_ledger_entries_account_id'), 'ledger_entries', ['account_id'], unique=False)
    op.create_index(op.f('ix_ledger_entries_created_at'), 'ledger_entries', ['created_at'], unique=False)

    # 5. transfers
    op.create_table(
        'transfers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sender_account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('receiver_account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='PENDING'),
        sa.Column('reference', sa.String(length=64), nullable=False),
        sa.Column('fraud_flags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('journal_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('amount > 0', name='chk_transfer_amount_positive'),
        sa.ForeignKeyConstraint(['sender_account_id'], ['accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['receiver_account_id'], ['accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['journal_id'], ['journal_entries.id'], ondelete='SET NULL'),
    )
    op.create_index(op.f('ix_transfers_reference'), 'transfers', ['reference'], unique=True)
    op.create_index(op.f('ix_transfers_sender_account_id'), 'transfers', ['sender_account_id'], unique=False)
    op.create_index(op.f('ix_transfers_receiver_account_id'), 'transfers', ['receiver_account_id'], unique=False)
    op.create_index(op.f('ix_transfers_status'), 'transfers', ['status'], unique=False)
    op.create_index(op.f('ix_transfers_created_at'), 'transfers', ['created_at'], unique=False)

    # 6. idempotency_keys
    op.create_table(
        'idempotency_keys',
        sa.Column('key', sa.String(length=128), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_path', sa.String(length=256), nullable=False),
        sa.Column('request_hash', sa.String(length=64), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('response_headers', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_idempotency_keys_user_id'), 'idempotency_keys', ['user_id'], unique=False)

    # 7. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('resource_type', sa.String(length=64), nullable=False),
        sa.Column('resource_id', sa.String(length=128), nullable=False),
        sa.Column('before_state', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('after_state', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_type'), 'audit_logs', ['resource_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_id'), 'audit_logs', ['resource_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)

    # 8. outbox_events
    op.create_table(
        'outbox_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_type', sa.String(length=64), nullable=False),
        sa.Column('aggregate_id', sa.String(length=128), nullable=False),
        sa.Column('payload', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='PENDING'),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_outbox_events_status'), 'outbox_events', ['status'], unique=False)
    op.create_index(op.f('ix_outbox_events_event_type'), 'outbox_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_outbox_events_created_at'), 'outbox_events', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('outbox_events')
    op.drop_table('audit_logs')
    op.drop_table('idempotency_keys')
    op.drop_table('transfers')
    op.drop_table('ledger_entries')
    op.drop_table('journal_entries')
    op.drop_table('accounts')
    op.drop_table('users')
