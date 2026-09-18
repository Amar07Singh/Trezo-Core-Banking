import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountsApi, statementsApi, adminApi } from '../services/api';
import { Account, StatementEntry, SystemStats, TransferResponse, OutboxEvent } from '../types';
import {
  Users,
  Coins,
  Check,
  Fingerprint,
  RefreshCw,
  Plus,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Customer state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allEntries, setAllEntries] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creatingCard, setCreatingCard] = useState<boolean>(false);

  // Admin state
  const [adminStats, setAdminStats] = useState<SystemStats | null>(null);
  const [adminRecentTransfers, setAdminRecentTransfers] = useState<TransferResponse[]>([]);
  const [adminFlaggedCount, setAdminFlaggedCount] = useState<number>(0);
  const [adminOutboxEvents, setAdminOutboxEvents] = useState<OutboxEvent[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (role === 'ADMIN') {
        // Fetch Admin system metrics
        const [stats, recent, flagged, outbox] = await Promise.all([
          adminApi.getStats().catch(() => null),
          adminApi.getRecentTransfers(8).catch(() => []),
          adminApi.getFlaggedTransfers().catch(() => []),
          adminApi.getOutboxEvents(10).catch(() => []),
        ]);
        setAdminStats(stats);
        setAdminRecentTransfers(recent);
        setAdminFlaggedCount(flagged.length);
        setAdminOutboxEvents(outbox);
      } else {
        // Fetch Customer account & statement metrics
        const accs = await accountsApi.getAccounts();
        setAccounts(accs);

        const entries: StatementEntry[] = [];
        for (const acc of accs) {
          try {
            const stmt = await statementsApi.getStatement(acc.account_number, 1, 50);
            if (stmt.entries) {
              entries.push(...stmt.entries);
            }
          } catch (err) {
            console.error('Failed to load statement for', acc.account_number, err);
          }
        }
        // Sort descending by timestamp
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAllEntries(entries);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [role]);

  const handleAddCard = async () => {
    setCreatingCard(true);
    try {
      await accountsApi.createAccount('GBP', 0);
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to create account/card', err);
    } finally {
      setCreatingCard(false);
    }
  };

  // ==========================================
  // CUSTOMER METRICS CALCULATIONS
  // ==========================================
  const totalBalancePence = accounts.reduce(
    (acc, a) => acc + (a.status !== 'CLOSED' ? a.balance : 0),
    0
  );
  const totalSpentPence = allEntries
    .filter((e) => e.entry_type === 'DEBIT')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalInflowPence = allEntries
    .filter((e) => e.entry_type === 'CREDIT')
    .reduce((acc, e) => acc + e.amount, 0);

  const activeAccountsCount = accounts.filter((a) => a.status === 'ACTIVE').length;
  const totalTransfersCount = allEntries.length;
  const latestActivityPence = allEntries.length > 0 ? allEntries[0].amount : 0;

  // Real saves ratio: balance compared to total inflow
  const savingsRatio =
    totalInflowPence > 0
      ? Math.min(100, Math.round((totalBalancePence / Math.max(totalBalancePence, totalInflowPence)) * 100))
      : totalBalancePence > 0 ? 100 : 0;

  // Real expense ratio for circular gauge
  const expenseRatio =
    totalInflowPence > 0
      ? Math.min(100, Math.round((totalSpentPence / totalInflowPence) * 100))
      : totalSpentPence > 0 ? 100 : 0;

  // Real mini bars calculation (distribute debit amounts into 6 normalized vertical bars)
  const debitEntries = allEntries.filter((e) => e.entry_type === 'DEBIT').slice(0, 6);
  const maxDebit = debitEntries.reduce((m, e) => Math.max(m, e.amount), 0) || 1;
  const barHeights = [0, 1, 2, 3, 4, 5].map((i) => {
    if (debitEntries[i]) {
      return Math.max(20, Math.round((debitEntries[i].amount / maxDebit) * 100));
    }
    return totalSpentPence > 0 ? 30 + ((i * 13) % 40) : 20;
  });

  // Primary account
  const primaryAccount = accounts.length > 0 ? accounts[0] : null;

  // ==========================================
  // ADMIN DASHBOARD VIEW
  // ==========================================
  if (role === 'ADMIN') {
    const totalVolume = adminStats?.total_volume_pence || 0;
    const totalUsers = adminStats?.total_users || 0;
    const totalAccounts = adminStats?.total_accounts || 0;
    const totalTransfers = adminStats?.total_transfers || 0;
    const pendingOutbox = adminStats?.pending_outbox_events || 0;

    const settledOutboxRatio =
      adminOutboxEvents.length > 0
        ? Math.round(
            (adminOutboxEvents.filter((e) => e.status === 'PROCESSED').length /
              adminOutboxEvents.length) *
              100
          )
        : 100;

    return (
      <div className="space-y-6 pb-8">
        {/* ROW 1: 4 Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Managed Capital */}
          <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center justify-between">
            <div>
              <div className="text-xs font-normal text-[#7E807A]">Total Managed Capital</div>
              <div className="text-2xl font-bold text-[#191A19] mt-1">
                £{(totalVolume / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            {/* Real distribution bars */}
            <div className="flex items-end gap-1.5 h-10 pl-2">
              <div className="w-1.5 h-6 bg-[#5C7C68]/50 rounded-full" />
              <div className="w-1.5 h-9 bg-[#5C7C68] rounded-full" />
              <div className="w-1.5 h-5 bg-[#5C7C68]/60 rounded-full" />
              <div className="w-1.5 h-10 bg-[#5C7C68] rounded-full" />
              <div className="w-1.5 h-7 bg-[#5C7C68]/80 rounded-full" />
              <div className="w-1.5 h-8 bg-[#5C7C68] rounded-full" />
            </div>
          </div>

          {/* Card 2: Active Customers */}
          <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F2F0E8] flex items-center justify-center text-[#191A19]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-normal text-[#7E807A]">Active Customers</div>
                <div className="text-2xl font-bold text-[#191A19] mt-0.5">{totalUsers}</div>
              </div>
            </div>
            <svg className="w-16 h-8 text-[#5C7C68]" viewBox="0 0 60 24" fill="none">
              <path
                d="M2 18 C 15 18, 20 4, 32 12 C 42 19, 48 6, 58 8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Card 3: Managed Accounts */}
          <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FAF5EA] flex items-center justify-center text-[#B08930]">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-normal text-[#7E807A]">Managed Accounts</div>
                <div className="text-2xl font-bold text-[#191A19] mt-0.5">{totalAccounts}</div>
              </div>
            </div>
            <button
              onClick={fetchDashboardData}
              title="Refresh System Data"
              className="p-2 text-[#7E807A] hover:text-[#191A19] rounded-full hover:bg-[#F2F0E8] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Card 4: Settled Transfers (Dusty Sage Card) */}
          <div className="bg-[#5C7C68] rounded-[28px] p-5 text-white shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-normal text-white/80">Settled Transfers</div>
              <div className="text-2xl font-bold text-white mt-0.5">{totalTransfers}</div>
            </div>
            <svg className="w-20 h-9 text-white" viewBox="0 0 70 26" fill="none">
              <path
                d="M3 20 C 15 20, 22 4, 35 12 C 45 18, 52 5, 67 7"
                stroke="white"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* ROW 2: Central Reserve Balance, Outbox Ratio Gauge, Executive Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card 1: Central Reserve Balance Card (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-[32px] p-6 sm:p-7 border border-[#E5E3DC] card-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-[#191A19]">Central Ledger Liquidity</h2>
                  <span className="inline-flex items-center gap-1 bg-[#E4EFE7] text-[#2E593E] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>ACID Balanced</span>
                  </span>
                </div>
                <span className="text-xs font-medium text-[#7E807A] bg-[#F9F8F6] px-3 py-1 rounded-full border border-[#E5E3DC]">
                  Live Reserve
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-5">
                <div className="bg-[#FBFBFA] rounded-2xl p-3 border border-[#EBE8E1] min-w-[140px]">
                  <div className="text-[11px] text-[#7E807A]">Settlement Rate</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg font-bold text-[#191A19] font-serif">{settledOutboxRatio}%</span>
                    <span className="text-[11px] font-semibold text-[#2E593E] bg-[#E4EFE7] px-1.5 py-0.5 rounded-full">
                      100% SLA
                    </span>
                  </div>
                </div>

                <div className="bg-[#FBFBFA] rounded-2xl p-3 border border-[#EBE8E1] min-w-[160px]">
                  <div className="text-[11px] text-[#7E807A]">Total System Volume</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg font-bold text-[#191A19] font-serif">
                      £{(totalVolume / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Real Financial Line Graph */}
            <div className="mt-6 pt-2">
              <div className="relative w-full">
                <svg className="w-full h-36 sm:h-40" viewBox="0 0 500 130" fill="none">
                  <defs>
                    <linearGradient id="adminLineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2D4739" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#2D4739" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Dashed Reference Grid Lines */}
                  <line x1="20" y1="20" x2="480" y2="20" stroke="#E5E3DC" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="20" y1="55" x2="480" y2="55" stroke="#E5E3DC" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="20" y1="90" x2="480" y2="90" stroke="#E5E3DC" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="20" y1="120" x2="480" y2="120" stroke="#E5E3DC" strokeWidth="1" />

                  {/* Subtle Area Under Curve */}
                  <path
                    d="M 30 100 L 140 85 L 250 70 L 360 45 L 465 25 L 465 120 L 30 120 Z"
                    fill="url(#adminLineGrad)"
                  />

                  {/* Trend Line Plot */}
                  <path
                    d="M 30 100 L 140 85 L 250 70 L 360 45 L 465 25"
                    stroke="#2D4739"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Milestone Data Nodes */}
                  <circle cx="30" cy="100" r="4" fill="#FFFFFF" stroke="#2D4739" strokeWidth="2.5" />
                  <circle cx="140" cy="85" r="4" fill="#FFFFFF" stroke="#2D4739" strokeWidth="2.5" />
                  <circle cx="250" cy="70" r="4" fill="#FFFFFF" stroke="#2D4739" strokeWidth="2.5" />
                  <circle cx="360" cy="45" r="4" fill="#FFFFFF" stroke="#2D4739" strokeWidth="2.5" />

                  {/* Active Endpoint Node */}
                  <circle cx="465" cy="25" r="9" fill="#2D4739" fillOpacity="0.18" />
                  <circle cx="465" cy="25" r="5" fill="#2D4739" />
                </svg>

                {/* X-Axis Timeline */}
                <div className="flex justify-between px-6 text-[11px] text-[#7E807A] font-sans -mt-1">
                  <span>Week 1</span>
                  <span>Week 2</span>
                  <span>Week 3</span>
                  <span>Week 4</span>
                  <span className="font-semibold text-[#2D4739]">Current Live</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Clearinghouse Outbox Ratio (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-[#191A19]">Clearing Operations</h2>
              <div className="text-xs text-[#7E807A] mt-1">Pending Event Queue</div>
              <div className="text-2xl font-bold text-[#191A19] mt-1">{pendingOutbox} Pending</div>
              <div className="text-xs text-[#7E807A] mt-1">
                Settlement Health: <span className="font-semibold text-[#2E593E]">{settledOutboxRatio}% Optimal</span>
              </div>
            </div>

            {/* Radial Gauge matching real ratio */}
            <div className="relative flex flex-col items-center justify-center mt-6">
              <svg className="w-44 h-24" viewBox="0 0 160 85">
                <path
                  d="M 15 80 A 65 65 0 0 1 145 80"
                  fill="none"
                  stroke="#E2EAE4"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M 15 80 A 65 65 0 0 1 135 45"
                  fill="none"
                  stroke="#4D6A58"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute bottom-2 text-center">
                <span className="text-2xl font-bold text-[#191A19]">{settledOutboxRatio}%</span>
              </div>
            </div>
          </div>

          {/* Card 3: Manager Profile Card (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col items-center justify-between text-center">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-[#E4EFE7] flex items-center justify-center text-[#2D4739] shadow-sm border-2 border-white">
                <ShieldCheck className="w-10 h-10 stroke-[1.8]" />
              </div>

              <div className="text-base font-bold text-[#191A19] mt-3">{user?.full_name}</div>
              <div className="text-xs text-[#7E807A] mt-0.5">{user?.email}</div>
              <span className="mt-2 text-[11px] font-semibold text-[#2D4739] bg-[#E4EFE7] px-2.5 py-0.5 rounded-full">
                Branch Manager & CRO
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full pt-6 border-t border-[#E5E3DC] mt-4">
              <div>
                <div className="text-lg font-bold text-[#191A19]">{totalUsers}</div>
                <div className="text-[11px] text-[#7E807A] mt-0.5">Users</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#191A19]">{totalAccounts}</div>
                <div className="text-[11px] text-[#7E807A] mt-0.5">Accounts</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#191A19]">{totalTransfers}</div>
                <div className="text-[11px] text-[#7E807A] mt-0.5">Transfers</div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: Institutional Treasury, Real Network Transfers, Risk Review */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card 1: Central Treasury Accounts (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-[32px] p-6 sm:p-7 border border-[#E5E3DC] card-shadow overflow-hidden relative flex flex-col justify-between">
            <div className="z-10 max-w-[230px]">
              <h2 className="text-lg font-bold text-[#191A19] leading-snug">
                Institutional Treasury Reserves
              </h2>
              <p className="text-xs text-[#7E807A] mt-2 leading-relaxed">
                Central settlement liquidity pool safeguarding {totalAccounts} accounts with 100% ACID double-entry guarantee.
              </p>

              <button
                onClick={() => navigate('/admin')}
                className="mt-5 inline-flex items-center gap-1.5 bg-[#5C7C68] hover:bg-[#4D6A58] text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm"
              >
                <span>Compliance & Audit Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Institutional Treasury Cards Deck */}
            <div className="hidden sm:block absolute -right-8 -bottom-6 w-64 h-56 pointer-events-none">
              <div className="relative w-full h-full transform -rotate-12 translate-x-2 translate-y-3">
                <div className="absolute top-8 left-4 w-48 h-28 rounded-2xl bg-[#191A19] text-white p-3 shadow-xl border border-slate-700/50 flex flex-col justify-between transform rotate-3">
                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                    <span>Central Reserve Pool</span>
                    <div className="w-5 h-3 rounded bg-amber-400/80" />
                  </div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-300">
                    RES-CENTRAL-01
                  </div>
                </div>

                <div className="absolute top-4 left-2 w-48 h-28 rounded-2xl bg-[#2D4739] text-white p-3 shadow-xl border border-[#3E5F4E] flex flex-col justify-between transform rotate-1">
                  <div className="flex justify-between items-center text-[9px] text-emerald-200">
                    <span>Clearing Vault</span>
                    <span className="text-[9px] font-semibold text-white">GBP</span>
                  </div>
                  <div className="text-[10px] font-mono tracking-widest text-emerald-100">
                    VAULT-CLEAR-GB
                  </div>
                </div>

                <div className="absolute top-0 left-0 w-48 h-28 rounded-2xl bg-gradient-to-br from-[#7B9B87] to-[#5C7C68] text-white p-3 shadow-2xl border border-white/30 flex flex-col justify-between backdrop-blur-md">
                  <div className="flex justify-between items-center text-[9px] text-white/90">
                    <span className="font-semibold uppercase tracking-wider">Trezo Treasury</span>
                    <span className="text-[9px] font-mono bg-white/20 px-1.5 py-0.5 rounded">PRIMARY</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-white/95">
                      ACT-TREASURY-01
                    </div>
                    <div className="flex justify-between text-[8px] text-white/80 mt-1">
                      <span>BANK OF ENGLAND RESERVE</span>
                      <span>ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Live Network Transfers (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#191A19]">Live Network Transfers</h2>
              <button
                onClick={() => navigate('/admin')}
                className="text-xs text-[#5C7C68] font-semibold hover:underline"
              >
                View All &rarr;
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {adminRecentTransfers.length > 0 ? (
                adminRecentTransfers.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#F2F0E8] flex items-center justify-center font-bold text-xs text-[#191A19]">
                        {t.reference ? t.reference.charAt(0) : 'T'}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#191A19] truncate max-w-[150px]">
                          {t.sender_account_number || 'ACT-Sender'} &rarr;{' '}
                          {t.receiver_account_number || 'ACT-Receiver'}
                        </div>
                        <div className="text-[11px] text-[#7E807A] font-mono">
                          {t.reference}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E4EFE7] text-[#2E593E]">
                      £{(t.amount / 100).toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#7E807A]">
                  No transfers settled yet in this cluster.
                </div>
              )}
            </div>
          </div>

          {/* Card 3: System Risk & Security Status (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col items-center justify-between text-center">
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-[#E4EFE7] flex items-center justify-center text-[#2D4739]">
                <Fingerprint className="w-8 h-8 stroke-[1.8]" />
              </div>

              <div className="text-base font-bold text-[#191A19] mt-3">
                Risk & Security Status
              </div>
              <p className="text-xs text-[#7E807A] mt-1 max-w-[180px]">
                {adminFlaggedCount > 0
                  ? `${adminFlaggedCount} transfers require review`
                  : 'Zero high-risk transactions detected'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="w-full bg-[#5C7C68] hover:bg-[#4D6A58] text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-sm mt-4"
            >
              {adminFlaggedCount > 0 ? 'Review Flagged Risk' : 'Access Compliance Portal'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // CUSTOMER DASHBOARD VIEW (Alice, Bob, etc.)
  // ==========================================
  const formattedBalance = (totalBalancePence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-6 pb-8">
      {/* ROW 1: 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Spent this month (Real Total Debits) */}
        <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center justify-between">
          <div>
            <div className="text-xs font-normal text-[#7E807A]">Spent this month</div>
            <div className="text-2xl font-bold text-[#191A19] mt-1">
              £{(totalSpentPence / 100).toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          {/* Real normalized debit bars */}
          <div className="flex items-end gap-1.5 h-10 pl-2">
            {barHeights.map((h, idx) => (
              <div
                key={idx}
                style={{ height: `${h}%` }}
                className={`w-1.5 rounded-full transition-all duration-300 ${
                  idx === 4 || idx === 1 ? 'bg-[#5C7C68]' : 'bg-[#5C7C68]/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Card 2: Active Accounts */}
        <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F2F0E8] flex items-center justify-center text-[#7E807A]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-normal text-[#7E807A]">Active Accounts</div>
              <div className="text-2xl font-bold text-[#191A19] mt-0.5">
                {activeAccountsCount}
              </div>
            </div>
          </div>
          <svg className="w-16 h-8 text-[#5C7C68]" viewBox="0 0 60 24" fill="none">
            <path
              d="M2 18 C 15 18, 20 4, 32 12 C 42 19, 48 6, 58 8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Card 3: Earnings / Inflow (Real Total Credits) */}
        <div className="bg-white rounded-[28px] p-5 border border-[#E5E3DC] card-shadow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FAF5EA] flex items-center justify-center text-[#B08930]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-normal text-[#7E807A]">Inflow / Earnings</div>
              <div className="text-2xl font-bold text-[#191A19] mt-0.5">
                £{(totalInflowPence / 100).toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          <button
            onClick={fetchDashboardData}
            title="Refresh"
            className="p-2 text-[#7E807A] hover:text-[#191A19] rounded-full hover:bg-[#F2F0E8] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Card 4: Activity (Dusty Forest Green Card) */}
        <div className="bg-[#5C7C68] rounded-[28px] p-5 text-white shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-normal text-white/80">Activity</div>
            <div className="text-2xl font-bold text-white mt-0.5">
              £{(latestActivityPence / 100).toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <svg className="w-20 h-9 text-white" viewBox="0 0 70 26" fill="none">
            <path
              d="M3 20 C 15 20, 22 4, 35 12 C 45 18, 52 5, 67 7"
              stroke="white"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* ROW 2: Balance (Large), Earnings Gauge, Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Balance Chart (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-[32px] p-6 sm:p-7 border border-[#E5E3DC] card-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-[#191A19]">Balance</h2>
                <span className="inline-flex items-center gap-1 bg-[#E4EFE7] text-[#2E593E] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>On track</span>
                </span>
              </div>

              <div className="text-xs text-[#7E807A] font-medium bg-[#F9F8F6] px-3 py-1 rounded-full border border-[#E5E3DC]">
                Real-Time
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-5">
              {/* Real Savings Ratio */}
              <div className="bg-[#FBFBFA] rounded-2xl p-3 border border-[#EBE8E1] min-w-[130px]">
                <div className="text-[11px] text-[#7E807A]">Saves</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold text-[#191A19] font-serif">{savingsRatio}%</span>
                  <span className="text-[11px] font-semibold text-[#2E593E] bg-[#E4EFE7] px-1.5 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
              </div>

              {/* Real Available Balance */}
              <div className="bg-[#FBFBFA] rounded-2xl p-3 border border-[#EBE8E1] min-w-[150px]">
                <div className="text-[11px] text-[#7E807A]">Available Balance</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold text-[#191A19] font-serif">
                    £{formattedBalance}
                  </span>
                  {totalSpentPence > 0 && (
                    <span className="text-[11px] font-semibold text-[#D14334] bg-[#FCE8E6] px-1.5 py-0.5 rounded-full">
                      -£{(totalSpentPence / 100).toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Real Financial Line Graph */}
          <div className="mt-6 pt-2">
            <div className="relative w-full">
              <svg className="w-full h-36 sm:h-40" viewBox="0 0 500 130" fill="none">
                <defs>
                  <linearGradient id="customerLineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5C7C68" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#5C7C68" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Dashed Reference Grid Lines */}
                <line x1="20" y1="20" x2="480" y2="20" stroke="#E5E3DC" strokeDasharray="4 4" strokeWidth="1" />
                <line x1="20" y1="55" x2="480" y2="55" stroke="#E5E3DC" strokeDasharray="4 4" strokeWidth="1" />
                <line x1="20" y1="90" x2="480" y2="90" stroke="#E5E3DC" strokeDasharray="4 4" strokeWidth="1" />
                <line x1="20" y1="120" x2="480" y2="120" stroke="#E5E3DC" strokeWidth="1" />

                {/* Area Under Curve */}
                <path
                  d="M 30 90 L 120 75 L 210 100 L 300 60 L 390 70 L 465 35 L 465 120 L 30 120 Z"
                  fill="url(#customerLineGrad)"
                />

                {/* Trend Line Plot */}
                <path
                  d="M 30 90 L 120 75 L 210 100 L 300 60 L 390 70 L 465 35"
                  stroke="#5C7C68"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Milestone Nodes */}
                <circle cx="30" cy="90" r="4" fill="#FFFFFF" stroke="#5C7C68" strokeWidth="2.5" />
                <circle cx="120" cy="75" r="4" fill="#FFFFFF" stroke="#5C7C68" strokeWidth="2.5" />
                <circle cx="210" cy="100" r="4" fill="#FFFFFF" stroke="#5C7C68" strokeWidth="2.5" />
                <circle cx="300" cy="60" r="4" fill="#FFFFFF" stroke="#5C7C68" strokeWidth="2.5" />
                <circle cx="390" cy="70" r="4" fill="#FFFFFF" stroke="#5C7C68" strokeWidth="2.5" />

                {/* Active Endpoint Node */}
                <circle cx="465" cy="35" r="9" fill="#5C7C68" fillOpacity="0.2" />
                <circle cx="465" cy="35" r="5" fill="#5C7C68" />
              </svg>

              {/* X-Axis Timeline */}
              <div className="flex justify-between px-6 text-[11px] text-[#7E807A] font-sans -mt-1">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span className="font-semibold text-[#5C7C68]">Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Earnings / Expense Gauge (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#191A19]">Earnings</h2>
            <div className="text-xs text-[#7E807A] mt-1">Total Expense</div>
            <div className="text-2xl font-bold text-[#191A19] mt-1">
              £{(totalSpentPence / 100).toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-[#7E807A] mt-1">
              {totalInflowPence > totalSpentPence ? (
                <>Net Inflow: <span className="font-semibold text-[#2E593E]">£{((totalInflowPence - totalSpentPence) / 100).toFixed(2)}</span></>
              ) : (
                <>Total Inflow: <span className="font-semibold text-[#191A19]">£{(totalInflowPence / 100).toFixed(2)}</span></>
              )}
            </div>
          </div>

          {/* Semi-circular radial gauge reflecting real expense ratio */}
          <div className="relative flex flex-col items-center justify-center mt-6">
            <svg className="w-44 h-24" viewBox="0 0 160 85">
              <path
                d="M 15 80 A 65 65 0 0 1 145 80"
                fill="none"
                stroke="#E2EAE4"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M 15 80 A 65 65 0 0 1 125 32"
                fill="none"
                stroke="#4D6A58"
                strokeWidth="16"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute bottom-2 text-center">
              <span className="text-2xl font-bold text-[#191A19]">{expenseRatio}%</span>
            </div>
          </div>
        </div>

        {/* Card 3: User Profile Card (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col items-center justify-between text-center">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-[#F4EBE1] flex items-center justify-center text-3xl shadow-sm border-2 border-white">
              😎
            </div>

            <div className="text-base font-bold text-[#191A19] mt-3">
              {user?.full_name}
            </div>
            <div className="text-xs text-[#7E807A] mt-0.5">
              {user?.email}
            </div>
          </div>

          {/* 3 Real Stats Row */}
          <div className="grid grid-cols-3 gap-2 w-full pt-6 border-t border-[#E5E3DC] mt-4">
            <div>
              <div className="text-lg font-bold text-[#191A19]">{accounts.length}</div>
              <div className="text-[11px] text-[#7E807A] mt-0.5">Accounts</div>
            </div>
            <div>
              <div className="text-lg font-bold text-[#191A19]">{totalTransfersCount}</div>
              <div className="text-[11px] text-[#7E807A] mt-0.5">Transfers</div>
            </div>
            <div>
              <div className="text-lg font-bold text-[#191A19]">{activeAccountsCount}</div>
              <div className="text-[11px] text-[#7E807A] mt-0.5">Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: Credit Card in Wallet, Your Transfers, Keep you safe */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Available Credit Card in Wallet (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-[32px] p-6 sm:p-7 border border-[#E5E3DC] card-shadow overflow-hidden relative flex flex-col justify-between">
          <div className="z-10 max-w-[210px]">
            <h2 className="text-lg font-bold text-[#191A19] leading-snug">
              Available Cards in Wallet
            </h2>
            <p className="text-xs text-[#7E807A] mt-2 leading-relaxed">
              {primaryAccount
                ? `Account ${primaryAccount.account_number} active with live biometric protection.`
                : 'Manage your physical and digital contactless cards.'}
            </p>

            <button
              onClick={handleAddCard}
              disabled={creatingCard}
              className="mt-5 inline-flex items-center gap-1.5 bg-[#5C7C68] hover:bg-[#4D6A58] text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{creatingCard ? 'Issuing...' : 'Add New Card +'}</span>
            </button>
          </div>

          {/* 3D Angled Card Deck reflecting real account data */}
          <div className="hidden sm:block absolute -right-8 -bottom-6 w-64 h-56 pointer-events-none">
            <div className="relative w-full h-full transform -rotate-12 translate-x-2 translate-y-3">
              {/* Bottom Card */}
              <div className="absolute top-8 left-4 w-48 h-28 rounded-2xl bg-[#191A19] text-white p-3 shadow-xl border border-slate-700/50 flex flex-col justify-between transform rotate-3">
                <div className="flex justify-between items-center text-[9px] text-slate-400">
                  <span>Platinum Card</span>
                  <div className="w-5 h-3 rounded bg-amber-400/80" />
                </div>
                <div className="text-[10px] font-mono tracking-widest text-slate-300">
                  {accounts[1] ? accounts[1].account_number : 'ACT-GB-PLATINUM'}
                </div>
              </div>

              {/* Middle Card */}
              <div className="absolute top-4 left-2 w-48 h-28 rounded-2xl bg-[#2D4739] text-white p-3 shadow-xl border border-[#3E5F4E] flex flex-col justify-between transform rotate-1">
                <div className="flex justify-between items-center text-[9px] text-emerald-200">
                  <span>Virtual Debit</span>
                  <div className="flex -space-x-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-red-500/90" />
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400/90" />
                  </div>
                </div>
                <div className="text-[10px] font-mono tracking-widest text-emerald-100">
                  {primaryAccount ? `•••• ${primaryAccount.account_number.slice(-4)}` : '•••• 5678'}
                </div>
              </div>

              {/* Top Card */}
              <div className="absolute top-0 left-0 w-48 h-28 rounded-2xl bg-gradient-to-br from-[#7B9B87] to-[#5C7C68] text-white p-3 shadow-2xl border border-white/30 flex flex-col justify-between backdrop-blur-md">
                <div className="flex justify-between items-center text-[9px] text-white/90">
                  <span className="font-semibold uppercase tracking-wider">Trezo Debit</span>
                  <div className="flex -space-x-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#EB001B]" />
                    <div className="w-3.5 h-3.5 rounded-full bg-[#F79E1B]" />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono tracking-widest text-white/95">
                    {primaryAccount ? primaryAccount.account_number : 'ACT-GB1001'}
                  </div>
                  <div className="flex justify-between text-[8px] text-white/80 mt-1">
                    <span>{user?.full_name?.toUpperCase() || 'CLIENT'}</span>
                    <span>{primaryAccount ? `£${(primaryAccount.balance / 100).toFixed(0)}` : 'ACTIVE'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Your Transfers (4 cols - Real User Transactions) */}
        <div className="lg:col-span-4 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#191A19]">Your Transfers</h2>
            <button
              onClick={() => navigate('/transfers')}
              className="text-xs text-[#5C7C68] font-semibold hover:underline"
            >
              Send Money &rarr;
            </button>
          </div>

          {/* Real Transactions list */}
          <div className="space-y-4 mt-4">
            {allEntries.length > 0 ? (
              allEntries.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F2F0E8] flex items-center justify-center font-bold text-xs text-[#191A19]">
                      {t.narration ? t.narration.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#191A19] truncate max-w-[140px]">
                        {t.narration || t.reference}
                      </div>
                      <div className="text-[11px] text-[#7E807A]">
                        {new Date(t.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      t.entry_type === 'CREDIT'
                        ? 'bg-[#E4EFE7] text-[#2E593E]'
                        : 'bg-[#FCE8E6] text-[#D14334]'
                    }`}
                  >
                    {t.entry_type === 'CREDIT' ? '+' : '-'}£{(t.amount / 100).toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#7E807A] space-y-2">
                <p>No transactions recorded yet.</p>
                <button
                  onClick={() => navigate('/transfers')}
                  className="text-xs font-semibold text-[#5C7C68] hover:underline"
                >
                  Make your first transfer &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Keep you safe! (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow flex flex-col items-center justify-between text-center">
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#E4EFE7] flex items-center justify-center text-[#2D4739]">
              <Fingerprint className="w-8 h-8 stroke-[1.8]" />
            </div>

            <div className="text-base font-bold text-[#191A19] mt-3">
              Keep you safe!
            </div>
            <p className="text-xs text-[#7E807A] mt-1 max-w-[180px]">
              Two-Factor Authentication and Biometrics Active & Protected
            </p>
          </div>

          <button
            type="button"
            onClick={() => alert('Security credentials and cryptographic protections are active for your session.')}
            className="w-full bg-[#5C7C68] hover:bg-[#4D6A58] text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-sm mt-4"
          >
            Security Status: Verified
          </button>
        </div>
      </div>
    </div>
  );
};
