import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { StatCard } from '../../components/StatCard';
import { Toast } from '../../components/Toast';
import BuyerSubNav from './BuyerSubNav';
import {
  extractApiError,
  formatColomboDateTime,
  formatLkrCents,
  generateOperationKey,
  isAbortError,
  type BuyerWalletResponse,
} from './utils';

const QUICK_AMOUNTS = ['25000', '50000', '100000', '250000'];

interface FundingSuccessReceipt {
  idempotentReplay: boolean;
  entry: {
    id: string;
    eventReference: string;
    amountCents: string;
    occurredAt: string;
  };
  wallet: {
    availableCents: string;
    heldCents: string;
  };
}

export default function SimulatedFundingPage() {
  const [walletData, setWalletData] = useState<BuyerWalletResponse | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [walletError, setWalletError] = useState('');

  const [amountLkr, setAmountLkr] = useState('');
  const [reference, setReference] = useState('');
  const [operationKey, setOperationKey] = useState(() => generateOperationKey('ym28-fund'));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<FundingSuccessReceipt | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  const loadWallet = useCallback(async (signal?: AbortSignal) => {
    setLoadingWallet(true);
    setWalletError('');
    try {
      const { data } = await api.get<BuyerWalletResponse>('/ym28/buyer/wallet', { signal });
      setWalletData(data);
    } catch (err) {
      if (!isAbortError(err)) {
        setWalletError(extractApiError(err, 'Could not load current wallet balance.').message);
      }
    } finally {
      if (!signal?.aborted) setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadWallet(controller.signal);
    return () => controller.abort();
  }, [loadWallet]);

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    const trimmed = amountLkr.trim();
    if (!trimmed) {
      errors.amountLkr = 'Enter the simulated funding amount in LKR.';
    } else if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      errors.amountLkr = 'Enter a valid positive LKR amount with at most 2 decimal places.';
    } else if (Number(trimmed) <= 0) {
      errors.amountLkr = 'Amount must be greater than LKR 0.00.';
    } else if (Number(trimmed) > 100000000) {
      errors.amountLkr = 'Single simulated funding cannot exceed LKR 100,000,000.00.';
    }
    if (reference.trim().length > 140) {
      errors.reference = 'Reference note must be 140 characters or fewer.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;
    setConfirmOpen(true);
  }

  async function executeFunding() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data } = await api.post<FundingSuccessReceipt>('/ym28/buyer/funding', {
        amountLkr: amountLkr.trim(),
        reference: reference.trim(),
        operationKey,
      });
      setReceipt(data);
      setConfirmOpen(false);
      setToastMessage(
        data.idempotentReplay
          ? `Idempotent replay returned existing funding of ${formatLkrCents(data.entry.amountCents)}.`
          : `Added ${formatLkrCents(data.entry.amountCents)} (simulated) to your Buyer Wallet.`
      );
      setAmountLkr('');
      setReference('');
      setOperationKey(generateOperationKey('ym28-fund'));
      await loadWallet();
    } catch (err) {
      const extracted = extractApiError(err, 'Simulated funding failed. Your form entries were preserved.');
      setSubmitError(extracted.message);
      if (Object.keys(extracted.fieldErrors).length > 0) {
        setFieldErrors(extracted.fieldErrors);
      }
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleAmountChange(nextVal: string) {
    setAmountLkr(nextVal);
    setFieldErrors((prev) => ({ ...prev, amountLkr: '' }));
    // Rotate operation key when inputs change so a new submission is cleanly distinct
    setOperationKey(generateOperationKey('ym28-fund'));
  }

  function handleReferenceChange(nextVal: string) {
    setReference(nextVal);
    setFieldErrors((prev) => ({ ...prev, reference: '' }));
    setOperationKey(generateOperationKey('ym28-fund'));
  }

  return (
    <div className="ym28-stack">
      <BuyerSubNav />

      <Alert type="warning">
        <strong>Simulated Funding Only:</strong> This form credits demonstration LKR funds from the local{' '}
        <code>simulation_source</code> ledger account. Do not enter real bank details or card numbers.
      </Alert>

      {walletError ? (
        <Alert type="error">{walletError}</Alert>
      ) : (
        <div className="ym28-stat-grid">
          <StatCard
            label="Current available balance (Simulated)"
            value={loadingWallet || !walletData ? 'Loading…' : formatLkrCents(walletData.wallet.availableCents)}
            subtext="Updated from PostgreSQL ledger"
            highlight
          />
          <StatCard
            label="Currently held on orders"
            value={loadingWallet || !walletData ? 'Loading…' : formatLkrCents(walletData.wallet.heldCents)}
            subtext="Protected until delivery acceptance or resolution"
          />
        </div>
      )}

      <ContentCard
        title="Add simulated buyer funds"
        subtitle="Posts a balanced double-entry journal (Debit Simulation Equity · Credit Buyer Available) with idempotent retry protection."
      >
        {submitError && (
          <div style={{ marginBottom: 16 }}>
            <Alert type="error">{submitError}</Alert>
          </div>
        )}

        <form className="ym28-stack" onSubmit={handleFormSubmit} noValidate>
          <div>
            <div className="ym28-form-grid">
              <InputField
                label="Simulated funding amount"
                unit="LKR"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 50000.00"
                value={amountLkr}
                onChange={(e) => handleAmountChange(e.target.value)}
                error={fieldErrors.amountLkr}
                required
              />
              <InputField
                label="Reference note (optional)"
                type="text"
                maxLength={140}
                placeholder="e.g. Weekly vegetable procurement budget"
                value={reference}
                onChange={(e) => handleReferenceChange(e.target.value)}
                error={fieldErrors.reference}
              />
            </div>

            <div className="ym28-preset-row" aria-label="Quick simulated amount presets">
              {QUICK_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="ym28-chip-btn"
                  onClick={() => handleAmountChange(preset)}
                >
                  + LKR {Number(preset).toLocaleString('en-LK')}
                </button>
              ))}
            </div>
          </div>

          <div className="ym28-meta-item">
            <span className="ym28-meta-label">Idempotency Operation Key</span>
            <span className="ym28-meta-value ym28-mono">{operationKey}</span>
            <span className="ym28-muted">
              Retrying the exact same request with this key will never double-credit your wallet.
            </span>
          </div>

          <div className="ym28-actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              Review simulated funding
            </Button>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setAmountLkr('');
                setReference('');
                setFieldErrors({});
                setSubmitError('');
                setOperationKey(generateOperationKey('ym28-fund'));
              }}
            >
              Reset form
            </Button>
          </div>
        </form>
      </ContentCard>

      {receipt && (
        <ContentCard title="Latest simulated funding receipt" subtitle="Verified and committed in the wallet journal.">
          <Alert type="success">
            Credited <strong>{formatLkrCents(receipt.entry.amountCents)}</strong> (Simulated) · New available balance:{' '}
            <strong>{formatLkrCents(receipt.wallet.availableCents)}</strong>
          </Alert>
          <div className="ym28-meta-grid" style={{ marginTop: 16 }}>
            <div className="ym28-meta-item">
              <span className="ym28-meta-label">Journal Entry ID</span>
              <span className="ym28-meta-value ym28-mono">{receipt.entry.id}</span>
            </div>
            <div className="ym28-meta-item">
              <span className="ym28-meta-label">Reference</span>
              <span className="ym28-meta-value">{receipt.entry.eventReference}</span>
            </div>
            <div className="ym28-meta-item">
              <span className="ym28-meta-label">Timestamp (Asia/Colombo)</span>
              <span className="ym28-meta-value">{formatColomboDateTime(receipt.entry.occurredAt)}</span>
            </div>
          </div>
          <div className="ym28-actions" style={{ marginTop: 16 }}>
            <Link className="ym28-inline-link" to={`/buyer/wallet/transactions/${receipt.entry.id}`}>
              Inspect journal entry lines →
            </Link>
          </div>
        </ContentCard>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm simulated funding"
        description={`Credit LKR ${amountLkr.trim() || '0.00'} into your Buyer Agri Wallet?`}
        simulationNote="This is a simulated funding transaction for local demonstration. No real money or bank transfer is involved."
        confirmLabel="Add simulated funds"
        busy={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void executeFunding()}
      />

      <Toast message={toastMessage} open={Boolean(toastMessage)} onClose={() => setToastMessage('')} />
    </div>
  );
}