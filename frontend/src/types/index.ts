export type UserRole = 'CUSTOMER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TransferStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'FLAGGED';
export type EntryType = 'DEBIT' | 'CREDIT';
export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  account_number: string;
  user_id: string;
  currency: string;
  balance: number;
  status: AccountStatus;
  created_at: string;
}

export interface AccountBalance {
  account_number: string;
  currency: string;
  balance: number;
  status: AccountStatus;
  formatted_balance: string;
}

export interface TransferRequest {
  sender_account_number: string;
  receiver_account_number: string;
  amount: number;
  currency: string;
  reference?: string;
  narration?: string;
}

export interface TransferResponse {
  id: string;
  sender_account_id: string;
  receiver_account_id: string;
  sender_account_number?: string;
  receiver_account_number?: string;
  amount: number;
  currency: string;
  status: TransferStatus;
  reference: string;
  fraud_flags?: string[];
  journal_id?: string;
  created_at: string;
}

export interface StatementEntry {
  id: string;
  entry_type: EntryType;
  amount: number;
  balance_after: number;
  reference: string;
  narration: string;
  timestamp: string;
}

export interface StatementResponse {
  account_number: string;
  currency: string;
  current_balance: number;
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  entries: StatementEntry[];
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface OutboxEvent {
  id: string;
  event_type: string;
  aggregate_id: string;
  payload: Record<string, any>;
  status: OutboxStatus;
  retry_count: number;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export interface SystemStats {
  total_users: number;
  total_accounts: number;
  total_transfers: number;
  total_volume_pence: number;
  pending_outbox_events: number;
  active_instances: string[];
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlation_id?: string;
  flags?: string[];
  invalid_params?: Array<{ loc: string[]; msg: string; type: string }>;
}
