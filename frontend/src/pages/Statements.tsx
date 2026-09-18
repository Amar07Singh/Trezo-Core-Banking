import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountsApi, statementsApi } from '../services/api';
import { Account, StatementResponse } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet
} from 'lucide-react';

export const Statements: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await accountsApi.getAccounts();
        setAccounts(data);
        const queryAcc = searchParams.get('account');
        if (queryAcc) {
          setSelectedAccount(queryAcc);
        } else if (data.length > 0) {
          setSelectedAccount(data[0].account_number);
        }
      } catch (err) {
        console.error('Failed to load accounts', err);
      }
    };
    fetchAccounts();
  }, [searchParams]);

  const loadStatement = async (accNo: string, targetPage: number) => {
    if (!accNo) return;
    setLoading(true);
    try {
      const data = await statementsApi.getStatement(accNo, targetPage, pageSize);
      setStatement(data);
    } catch (err) {
      console.error('Failed to load statement', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      loadStatement(selectedAccount, page);
      setSearchParams({ account: selectedAccount });
    }
  }, [selectedAccount, page]);

  const handleDownloadReport = () => {
    if (!statement) return;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Date,Reference,Description,Type,Amount,Balance After']
        .concat(
          statement.entries.map(
            (e) =>
              `"${new Date(e.timestamp).toISOString()}","${e.reference}","${e.narration}","${e.entry_type}","${(
                e.amount / 100
              ).toFixed(2)}","${(e.balance_after / 100).toFixed(2)}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Statement_${selectedAccount}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#191A19] tracking-tight">
            Account Statements & History
          </h1>
          <p className="text-xs sm:text-sm text-[#7E807A] mt-1">
            Official banking statement and ledger records.
          </p>
        </div>

        {/* Account Selector & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 rounded-2xl bg-white border border-[#E5E3DC] text-[#191A19] text-xs font-medium focus:outline-none focus:border-[#5C7C68] card-shadow"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.account_number}>
                {a.account_number} — £{(a.balance / 100).toFixed(2)}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadStatement(selectedAccount, page)}
            className="p-2.5 rounded-full bg-white border border-[#E5E3DC] text-[#7E807A] hover:text-[#191A19] transition-colors card-shadow"
            title="Refresh Statement"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#5C7C68] hover:bg-[#4D6A58] text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[32px] border border-[#E5E3DC] card-shadow overflow-hidden">
        {/* Table Summary Bar */}
        {statement && (
          <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E3DC] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#7E807A]">Account Number:</span>
              <span className="font-mono font-bold text-[#191A19]">{statement.account_number}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#7E807A]">Current Balance:</span>
              <span className="font-bold text-[#2E593E] text-sm font-serif">
                £{(statement.current_balance / 100).toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#7E807A]">Total Records:</span>
              <span className="font-bold text-[#191A19]">{statement.total_count}</span>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#191A19]">
            <thead className="bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wider text-[#7E807A] border-b border-[#E5E3DC]">
              <tr>
                <th className="px-6 py-3.5">Date & Time</th>
                <th className="px-6 py-3.5">Reference</th>
                <th className="px-6 py-3.5">Description</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F0E8]">
              {statement?.entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#FBFBFA] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-[#7E807A]">
                    {new Date(entry.timestamp).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-[#191A19]">
                    {entry.reference}
                  </td>
                  <td className="px-6 py-4 text-[#191A19]">
                    {entry.narration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        entry.entry_type === 'CREDIT'
                          ? 'bg-[#E4EFE7] text-[#2E593E]'
                          : 'bg-[#FCE8E6] text-[#D14334]'
                      }`}
                    >
                      {entry.entry_type === 'CREDIT' ? (
                        <>
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>Money In</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Money Out</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-right font-bold ${
                      entry.entry_type === 'CREDIT' ? 'text-[#2E593E]' : 'text-[#D14334]'
                    }`}
                  >
                    {entry.entry_type === 'CREDIT' ? '+' : '-'}£{(entry.amount / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-[#191A19]">
                    £{(entry.balance_after / 100).toFixed(2)}
                  </td>
                </tr>
              ))}

              {(!statement || statement.entries.length === 0) && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#7E807A]">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-[#BDB9AD] mb-2" />
                    No transactions recorded for this account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {statement && statement.total_pages > 1 && (
          <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#E5E3DC] flex items-center justify-between text-xs text-[#7E807A]">
            <div>
              Page <span className="font-bold text-[#191A19]">{statement.page}</span> of{' '}
              <span className="font-bold text-[#191A19]">{statement.total_pages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E3DC] text-[#191A19] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(statement.total_pages, p + 1))}
                disabled={page >= statement.total_pages || loading}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E3DC] text-[#191A19] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
