import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { AuditLog, TransferResponse, OutboxEvent, SystemStats } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  History,
  Radio,
  RefreshCw,
  Lock,
  Unlock,
  Users,
  CreditCard,
  ArrowLeftRight,
  TrendingUp
} from 'lucide-react';

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'flagged' | 'outbox' | 'accounts'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [flaggedTransfers, setFlaggedTransfers] = useState<TransferResponse[]>([]);
  const [outboxEvents, setOutboxEvents] = useState<OutboxEvent[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);

  const [accountToModify, setAccountToModify] = useState<string>('');
  const [accountActionMessage, setAccountActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logs, flagged, outbox, systemStats] = await Promise.all([
        adminApi.getAuditLogs(50),
        adminApi.getFlaggedTransfers(),
        adminApi.getOutboxEvents(50),
        adminApi.getStats(),
      ]);
      setAuditLogs(logs);
      setFlaggedTransfers(flagged);
      setOutboxEvents(outbox);
      setStats(systemStats);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (freeze: boolean) => {
    setAccountActionMessage(null);
    try {
      const status = freeze ? 'FROZEN' : 'ACTIVE';
      await adminApi.updateAccountStatus(accountToModify, status);
      setAccountActionMessage(`Account ${accountToModify} has been updated to ${status}.`);
      await fetchData();
    } catch (err: any) {
      setAccountActionMessage(`Error: ${err.response?.data?.detail || 'Update failed'}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2D4739] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Compliance & Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-[#191A19] tracking-tight mt-1">
            Branch Manager & Risk Portal
          </h1>
          <p className="text-xs sm:text-sm text-[#7E807A] mt-0.5">
            Audit logging, suspicious activity monitoring, and account protection safeguards.
          </p>
        </div>

        <button
          onClick={fetchData}
          title="Refresh Portal Data"
          className="p-2.5 self-start sm:self-auto rounded-full bg-white border border-[#E5E3DC] text-[#7E807A] hover:text-[#191A19] transition-colors card-shadow"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Row of 4 Executive Metric Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#F2F0E8] flex items-center justify-center text-[#191A19]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#7E807A]">Total Customers</div>
              <div className="text-2xl font-bold text-[#191A19] font-serif mt-0.5">{stats.total_users}</div>
            </div>
          </div>

          <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#E4EFE7] flex items-center justify-center text-[#2E593E]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#7E807A]">Managed Accounts</div>
              <div className="text-2xl font-bold text-[#191A19] font-serif mt-0.5">{stats.total_accounts}</div>
            </div>
          </div>

          <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#F2F0E8] flex items-center justify-center text-[#191A19]">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#7E807A]">Settled Transfers</div>
              <div className="text-2xl font-bold text-[#191A19] font-serif mt-0.5">{stats.total_transfers}</div>
            </div>
          </div>

          <div className="bg-[#5C7C68] rounded-[28px] p-5 text-white shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-white/80">Total Ledger Volume</div>
              <div className="text-xl font-bold text-white font-serif mt-0.5">
                £{(stats.total_volume_pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E3DC] pb-2">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
            activeTab === 'audit'
              ? 'bg-[#191A19] text-white shadow-sm'
              : 'text-[#7E807A] hover:text-[#191A19] hover:bg-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Compliance Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('flagged')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
            activeTab === 'flagged'
              ? 'bg-[#191A19] text-white shadow-sm'
              : 'text-[#7E807A] hover:text-[#191A19] hover:bg-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Security Risk Flags ({flaggedTransfers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('outbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
            activeTab === 'outbox'
              ? 'bg-[#191A19] text-white shadow-sm'
              : 'text-[#7E807A] hover:text-[#191A19] hover:bg-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-[#5C7C68]" />
          <span>Settlement Operations ({outboxEvents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
            activeTab === 'accounts'
              ? 'bg-[#191A19] text-white shadow-sm'
              : 'text-[#7E807A] hover:text-[#191A19] hover:bg-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-[#D14334]" />
          <span>Account Safeguards & Hold</span>
        </button>
      </div>

      {/* Tab 1: Compliance Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-[32px] border border-[#E5E3DC] card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#191A19]">
              <thead className="bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wider text-[#7E807A] border-b border-[#E5E3DC]">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Operation</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Reference ID</th>
                  <th className="px-6 py-3.5">Audit Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0E8]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FBFBFA] transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap text-[#7E807A]">
                      {new Date(log.created_at).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F2F0E8] text-[#191A19] font-medium text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-[#7E807A]">{log.resource_type}</td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-mono text-[#191A19] truncate max-w-[140px]">
                      {log.resource_id}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="text-[11px] text-[#7E807A] truncate max-w-sm">
                        {log.after_state ? 'Verified audit record committed' : 'Status verified'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Security & Risk Flags */}
      {activeTab === 'flagged' && (
        <div className="bg-white rounded-[32px] border border-[#E5E3DC] card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#191A19]">
              <thead className="bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wider text-[#7E807A] border-b border-[#E5E3DC]">
                <tr>
                  <th className="px-6 py-3.5">Transfer Ref</th>
                  <th className="px-6 py-3.5">Accounts Involved</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Flagged Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0E8]">
                {flaggedTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FBFBFA] transition-colors">
                    <td className="px-6 py-4 font-bold text-[#191A19] font-mono">{t.reference}</td>
                    <td className="px-6 py-4 text-[#7E807A] font-mono">
                      {t.sender_account_number || t.sender_account_id.slice(0, 8)} &rarr;{' '}
                      {t.receiver_account_number || t.receiver_account_id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[#191A19]">
                      £{(t.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-[#FEF3E2] text-[#9A6B1F] font-semibold px-2.5 py-0.5 rounded-full text-xs">
                        UNDER REVIEW
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {t.fraud_flags?.map((flag, idx) => (
                          <div key={idx} className="text-[11px] text-[#9A6B1F] bg-[#FEF3E2] px-2 py-0.5 rounded-md inline-block mr-1">
                            {flag}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {flaggedTransfers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[#7E807A]">
                      No suspicious transactions pending review. System risk status: Clear.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Settlement Operations */}
      {activeTab === 'outbox' && (
        <div className="bg-white rounded-[32px] border border-[#E5E3DC] card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#191A19]">
              <thead className="bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wider text-[#7E807A] border-b border-[#E5E3DC]">
                <tr>
                  <th className="px-6 py-3.5">Queued At</th>
                  <th className="px-6 py-3.5">Operation Type</th>
                  <th className="px-6 py-3.5">Clearing Status</th>
                  <th className="px-6 py-3.5">Settled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0E8]">
                {outboxEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#FBFBFA] transition-colors">
                    <td className="px-6 py-3.5 text-[#7E807A]">
                      {new Date(evt.created_at).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-[#191A19]">{evt.event_type}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          evt.status === 'PROCESSED'
                            ? 'bg-[#E4EFE7] text-[#2E593E]'
                            : 'bg-[#FEF3E2] text-[#9A6B1F]'
                        }`}
                      >
                        {evt.status === 'PROCESSED' ? 'Settled' : 'In Queue'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[#7E807A]">
                      {evt.processed_at
                        ? new Date(evt.processed_at).toLocaleTimeString('en-GB')
                        : 'Processing...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Account Safeguards */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#E5E3DC] card-shadow space-y-5 max-w-xl">
          <div>
            <h2 className="text-base font-bold text-[#191A19]">Emergency Account Lock Controls</h2>
            <p className="text-xs text-[#7E807A] mt-1">
              Immediately apply or release administrative holds on customer accounts for protection.
            </p>
          </div>

          {accountActionMessage && (
            <div className="rounded-2xl bg-[#E4EFE7] p-3.5 text-xs font-medium text-[#2E593E]">
              {accountActionMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#191A19] mb-1.5">
                Target Account Number
              </label>
              <input
                type="text"
                value={accountToModify}
                onChange={(e) => setAccountToModify(e.target.value)}
                placeholder="e.g. ACT-GB1003"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] font-mono text-xs focus:outline-none focus:border-[#5C7C68]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleUpdateStatus(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#C53929] hover:bg-[#a82d20] text-white font-semibold text-xs transition-colors shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Place Emergency Hold</span>
              </button>

              <button
                onClick={() => handleUpdateStatus(false)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C7C68] hover:bg-[#4D6A58] text-white font-semibold text-xs transition-colors shadow-sm"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Release Account Hold</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
