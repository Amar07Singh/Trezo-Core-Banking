import axios, { AxiosResponse } from 'axios';
import {
  Account,
  AccountBalance,
  TransferRequest,
  TransferResponse,
  StatementResponse,
  AuditLog,
  OutboxEvent,
  SystemStats,
  User,
  AccountStatus
} from '../types';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Broadcast channel/listener for live telemetry headers
export type TelemetryData = {
  servedBy?: string;
  cacheLookup?: string;
  correlationId?: string;
  processTime?: string;
  lastUrl?: string;
  lastStatus?: number;
};

export const telemetryListeners: ((data: TelemetryData) => void)[] = [];

export const onTelemetryUpdate = (listener: (data: TelemetryData) => void) => {
  telemetryListeners.push(listener);
  return () => {
    const idx = telemetryListeners.indexOf(listener);
    if (idx !== -1) telemetryListeners.splice(idx, 1);
  };
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const telemetry: TelemetryData = {
      servedBy: response.headers['x-served-by'],
      cacheLookup: response.headers['x-cache-lookup'],
      correlationId: response.headers['x-correlation-id'],
      processTime: response.headers['x-process-time'],
      lastUrl: response.config.url,
      lastStatus: response.status,
    };
    telemetryListeners.forEach((fn) => fn(telemetry));
    return response;
  },
  (error) => {
    if (error.response) {
      const telemetry: TelemetryData = {
        servedBy: error.response.headers['x-served-by'],
        cacheLookup: error.response.headers['x-cache-lookup'],
        correlationId: error.response.headers['x-correlation-id'],
        processTime: error.response.headers['x-process-time'],
        lastUrl: error.config?.url,
        lastStatus: error.response.status,
      };
      telemetryListeners.forEach((fn) => fn(telemetry));
    }
    return Promise.reject(error);
  }
);

// Auth Endpoints
export const authApi = {
  login: async (email: string, password: string): Promise<{ access_token: string; user: User }> => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const res = await apiClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

// Accounts Endpoints
export const accountsApi = {
  getAccounts: async (): Promise<Account[]> => {
    const res = await apiClient.get('/accounts');
    return res.data;
  },
  getAccountBalance: async (accountNumber: string): Promise<AccountBalance> => {
    const res = await apiClient.get(`/accounts/${accountNumber}/balance`);
    return res.data;
  },
  createAccount: async (currency: string = 'GBP', initialDeposit: number = 0): Promise<Account> => {
    const res = await apiClient.post('/accounts', {
      currency,
      initial_deposit: initialDeposit,
    });
    return res.data;
  },
};

// Transfers Endpoints
export const transfersApi = {
  executeTransfer: async (
    data: TransferRequest,
    idempotencyKey?: string
  ): Promise<{ data: TransferResponse; headers: any }> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post('/transfers', data, { headers });
    return { data: res.data, headers: res.headers };
  },
  getTransfer: async (transferId: string): Promise<TransferResponse> => {
    const res = await apiClient.get(`/transfers/${transferId}`);
    return res.data;
  },
};

// Statements Endpoints
export const statementsApi = {
  getStatement: async (accountNumber: string, page: number = 1, pageSize: number = 10): Promise<StatementResponse> => {
    const res = await apiClient.get(`/accounts/${accountNumber}/statement`, {
      params: { page, page_size: pageSize },
    });
    return res.data;
  },
};

// Admin Endpoints
export const adminApi = {
  getAuditLogs: async (limit: number = 50, offset: number = 0): Promise<AuditLog[]> => {
    const res = await apiClient.get('/admin/audit-logs', { params: { limit, offset } });
    return res.data;
  },
  getFlaggedTransfers: async (): Promise<TransferResponse[]> => {
    const res = await apiClient.get('/admin/transfers/flagged');
    return res.data;
  },
  updateAccountStatus: async (accountNumber: string, status: AccountStatus): Promise<Account> => {
    const res = await apiClient.patch(`/admin/accounts/${accountNumber}/status`, { status });
    return res.data;
  },
  getOutboxEvents: async (limit: number = 50): Promise<OutboxEvent[]> => {
    const res = await apiClient.get('/admin/outbox', { params: { limit } });
    return res.data;
  },
  getStats: async (): Promise<SystemStats> => {
    const res = await apiClient.get('/admin/stats');
    return res.data;
  },
  getRecentTransfers: async (limit: number = 10): Promise<TransferResponse[]> => {
    const res = await apiClient.get('/admin/transfers/recent', { params: { limit } });
    return res.data;
  },
};
