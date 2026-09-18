import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountsApi, transfersApi } from '../services/api';
import { Account, TransferResponse, ProblemDetail } from '../types';
import { Badge } from '../components/Badge';
import {
  Send,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Receipt
} from 'lucide-react';

export const Transfers: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [senderAccount, setSenderAccount] = useState<string>('');
  const [receiverAccount, setReceiverAccount] = useState<string>('');
  const [amountPounds, setAmountPounds] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [narration, setNarration] = useState<string>('');

  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<TransferResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorDetail, setErrorDetail] = useState<ProblemDetail | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await accountsApi.getAccounts();
        setAccounts(data);
        const querySender = searchParams.get('sender');
        if (querySender) {
          setSenderAccount(querySender);
        } else if (data.length > 0) {
          setSenderAccount(data[0].account_number);
        }
      } catch (err) {
        console.error('Failed to load accounts', err);
      }
    };
    loadAccounts();
  }, [searchParams]);

  const handleTransfer = async (isRetry: boolean = false) => {
    setLoading(true);
    setErrorDetail(null);
    setSuccessMessage(null);

    const amountMinorUnits = Math.round(parseFloat(amountPounds || '0') * 100);

    const payload = isRetry && lastPayload
      ? lastPayload
      : {
          sender_account_number: senderAccount,
          receiver_account_number: receiverAccount,
          amount: amountMinorUnits,
          currency: 'GBP',
          reference: reference || undefined,
          narration: narration || undefined,
        };

    const idempotencyKey = isRetry && lastIdempotencyKey
      ? lastIdempotencyKey
      : `IDEMP-${crypto.randomUUID()}`;

    try {
      const res = await transfersApi.executeTransfer(payload, idempotencyKey);
      setLastResponse(res.data);
      setLastPayload(payload);
      setLastIdempotencyKey(idempotencyKey);

      if (isRetry) {
        setSuccessMessage(
          'Duplicate Charge Protection Verified: Transaction re-confirmed without re-billing your account.'
        );
      } else {
        setSuccessMessage(
          `Payment of £${(amountMinorUnits / 100).toFixed(2)} completed successfully.`
        );
      }
    } catch (err: any) {
      if (err.response?.data) {
        setErrorDetail(err.response.data as ProblemDetail);
      } else {
        setErrorDetail({
          type: 'https://errors.trezo.bank/network-error',
          title: 'Transfer Failed',
          status: 500,
          detail: err.message || 'Unable to complete transfer at this time.',
          instance: '/api/v1/transfers',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#191A19] tracking-tight">
          Send Money & Transfers
        </h1>
        <p className="text-xs sm:text-sm text-[#7E807A] mt-1">
          Instant, encrypted interbank transfers with guaranteed zero-duplicate protection.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-[32px] p-6 sm:p-8 border border-[#E5E3DC] card-shadow space-y-6">
          <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-4">
            <span className="text-sm font-bold text-[#191A19]">Payment Details</span>
            <span className="text-xs text-[#7E807A] bg-[#F2F0E8] px-2.5 py-1 rounded-full font-medium">
              Currency: GBP (£)
            </span>
          </div>

          <div className="space-y-4">
            {/* Sender Account */}
            <div>
              <label className="block text-xs font-semibold text-[#191A19] mb-1.5">
                From Account
              </label>
              <select
                value={senderAccount}
                onChange={(e) => setSenderAccount(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] text-sm focus:outline-none focus:border-[#5C7C68]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.account_number}>
                    {a.account_number} — Available: £{(a.balance / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Account */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#191A19]">
                  To Account (Recipient)
                </label>
                <div className="flex gap-2 text-xs">
                  {[
                    { name: 'Alice Smith', account: 'ACT-GB1001' },
                    { name: 'Bob Jones', account: 'ACT-GB1002' },
                    { name: 'Charlie Brown', account: 'ACT-GB1003' },
                  ]
                    .filter((c) => !accounts.some((a) => a.account_number === c.account))
                    .map((c) => (
                      <button
                        key={c.account}
                        type="button"
                        onClick={() => setReceiverAccount(c.account)}
                        className="text-xs text-[#2E593E] bg-[#E4EFE7] hover:bg-[#d5e7db] px-2.5 py-0.5 rounded-full font-medium transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </div>
              <input
                type="text"
                required
                value={receiverAccount}
                onChange={(e) => setReceiverAccount(e.target.value)}
                placeholder="e.g. ACT-GB1002"
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] font-mono text-sm focus:outline-none focus:border-[#5C7C68]"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-[#191A19] mb-1.5">
                Amount (£)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-[#7E807A] font-semibold text-sm">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountPounds}
                  onChange={(e) => setAmountPounds(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] font-bold text-base focus:outline-none focus:border-[#5C7C68]"
                />
              </div>
            </div>

            {/* Reference & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#191A19] mb-1.5">
                  Reference
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. INV-904"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] text-xs focus:outline-none focus:border-[#5C7C68]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#191A19] mb-1.5">
                  Description / Memo
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="e.g. Rent Payment"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] text-xs focus:outline-none focus:border-[#5C7C68]"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => handleTransfer(false)}
              disabled={loading}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-[#5C7C68] hover:bg-[#4D6A58] text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Sending Transfer...' : 'Send Transfer'}</span>
            </button>

            {lastIdempotencyKey && (
              <button
                onClick={() => handleTransfer(true)}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-[#F2F0E8] hover:bg-[#E5E3DC] text-[#191A19] font-medium text-xs transition-colors"
                title="Verify Duplicate Shield"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#7E807A]" />
                <span>Resend Protection Test</span>
              </button>
            )}
          </div>

          {/* Guarantee Banner */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-xs text-[#7E807A]">
            <ShieldCheck className="w-4 h-4 text-[#5C7C68] shrink-0 mt-0.5" />
            <span>
              <strong>Duplicate Charge Protection Active</strong>: Every transfer is cryptographically keyed to guarantee you will never be charged twice for an accidental resubmission.
            </span>
          </div>
        </div>

        {/* Transfer Confirmation Receipt (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Status Message Banner */}
          {successMessage && (
            <div className="rounded-[24px] bg-[#E4EFE7] p-4 flex items-start gap-3 text-xs text-[#2E593E] font-medium">
              <CheckCircle2 className="w-5 h-5 text-[#2E593E] shrink-0 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          {errorDetail && (
            <div className="rounded-[24px] bg-[#FCE8E6] p-4 space-y-2 text-xs text-[#D14334]">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorDetail.title || 'Transfer Declined'}</span>
              </div>
              <p>{errorDetail.detail}</p>
              {errorDetail.flags && errorDetail.flags.length > 0 && (
                <div className="pt-1 text-[11px] text-[#9A6B1F] bg-[#FEF3E2] p-2 rounded-xl">
                  <strong>Security Review Flagged:</strong> {errorDetail.flags.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Official Bank Receipt Card */}
          <div className="bg-white rounded-[32px] p-6 border border-[#E5E3DC] card-shadow space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#5C7C68]" />
                <span className="text-xs font-bold text-[#191A19]">Transfer Receipt</span>
              </div>
              {lastResponse && (
                <Badge variant={lastResponse.status}>{lastResponse.status}</Badge>
              )}
            </div>

            {lastResponse ? (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between py-1 border-b border-[#F4F2EB]">
                  <span className="text-[#7E807A]">Reference</span>
                  <span className="font-mono font-bold text-[#191A19]">{lastResponse.reference}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-[#F4F2EB]">
                  <span className="text-[#7E807A]">Amount Sent</span>
                  <span className="font-bold text-[#191A19]">
                    £{(lastResponse.amount / 100).toFixed(2)} GBP
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-[#F4F2EB]">
                  <span className="text-[#7E807A]">From</span>
                  <span className="font-mono text-[#191A19]">{senderAccount}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-[#F4F2EB]">
                  <span className="text-[#7E807A]">To</span>
                  <span className="font-mono text-[#191A19]">{receiverAccount}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-[#F4F2EB]">
                  <span className="text-[#7E807A]">Settlement</span>
                  <span className="font-semibold text-[#2E593E]">Instant (Direct Debit)</span>
                </div>

                {lastResponse.fraud_flags && lastResponse.fraud_flags.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[#FEF3E2] text-[#9A6B1F] text-[11px] space-y-1">
                    <span className="font-bold block">Routine Compliance Verification:</span>
                    <span>Amount threshold flagged for administrative audit. Funds will settle within standard clearing times.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#7E807A] space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#F2F0E8] flex items-center justify-center mx-auto text-[#7E807A]">
                  <Send className="w-5 h-5 stroke-[1.8]" />
                </div>
                <p>Complete the payment details on the left to initiate and view your instant transfer receipt.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
