import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { InputField } from '../../../components/InputField';
import { SelectField } from '../../../components/SelectField';
import { Toast } from '../../../components/Toast';
import { formatLKR } from '../mockData';
import { usePayoutState } from '../payoutState';
import { getYm27ErrorMessage } from '../api';

function parseLkrToCents(value: string): { cents: number } | { error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { error: 'Enter a simulated payout amount.' };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { error: 'Use a positive LKR amount with at most two decimal places, such as 1500.00.' };
  }
  const [whole, fraction = ''] = trimmed.split('.');
  if (whole.length > 12) return { error: 'That amount is too large for this simulated wallet.' };
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) return { error: 'Enter a simulated amount greater than zero.' };
  return { cents };
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function WalletTabs() {
  const tabs = [
    { id: 'overview', label: 'Overview', to: '/farmer/wallet' },
    { id: 'transactions', label: 'Transactions', to: '/farmer/wallet/transactions' },
    { id: 'history', label: 'Payout history', to: '/farmer/wallet/payout/history' },
    { id: 'request', label: 'Request payout', to: '/farmer/wallet/payout/request' },
  ];
  return (
    <nav className="ym27-tabs" aria-label="Wallet sections">
      {tabs.map((tab) => (
        <Link key={tab.id} to={tab.to} className={tab.id === 'request' ? 'ym27-tab ym27-tab--active' : 'ym27-tab'} aria-current={tab.id === 'request' ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default function PayoutRequest() {
  const {
    wallet,
    walletLoading,
    walletError,
    payoutOptions,
    payoutOptionsLoading,
    payoutOptionsError,
    submitPayout,
    refreshWallet,
    refreshPayoutOptions,
  } = usePayoutState();
  const [amount, setAmount] = useState('');
  const [bankValue, setBankValue] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCents, setPendingCents] = useState<number | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<{ key: string; amountCents: number; bankValue: string } | null>(null);

  const remainingRequestable = wallet?.remainingRequestable ?? 0;
  const bankOptions = payoutOptions ?? [];
  const bank = bankOptions.find((account) => account.value === bankValue);
  const parsed = parseLkrToCents(amount);
  const previewCents = 'cents' in parsed ? parsed.cents : null;
  const withinBalance = previewCents !== null && previewCents <= remainingRequestable;
  const remainingAfter = previewCents !== null && withinBalance ? remainingRequestable - previewCents : null;

  useEffect(() => {
    if (!bankValue && bankOptions.length > 0) setBankValue(bankOptions[0].value);
  }, [bankOptions, bankValue]);

  useEffect(() => {
    void refreshWallet();
    void refreshPayoutOptions();
    const refreshOnFocus = () => {
      void refreshWallet();
      void refreshPayoutOptions();
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [refreshWallet, refreshPayoutOptions]);

  function validate(): { cents: number } | { error: string } {
    const result = parseLkrToCents(amount);
    if ('error' in result) return result;
    if (!wallet) return { error: 'The simulated wallet balance is not available yet.' };
    if (!bank) return { error: 'Choose one of the simulated destinations.' };
    if (result.cents > remainingRequestable) {
      return { error: `The most you can request in this session is ${formatLKR(remainingRequestable)}.` };
    }
    return result;
  }

  function requestConfirmation() {
    const result = validate();
    if ('error' in result) {
      setFieldError('cents' in parseLkrToCents(amount) ? '' : (parseLkrToCents(amount) as { error: string }).error);
      setFormError(result.error);
      setConfirmOpen(false);
      return;
    }
    setFieldError('');
    setFormError('');
    setPendingCents(result.cents);
    setConfirmOpen(true);
  }

  async function confirmRequest() {
    if (pendingCents === null || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setConfirmOpen(false);
    const previousRequest = idempotencyRef.current;
    const idempotencyKey = previousRequest
      && previousRequest.amountCents === pendingCents
      && previousRequest.bankValue === bankValue
      ? previousRequest.key
      : crypto.randomUUID();
    idempotencyRef.current = { key: idempotencyKey, amountCents: pendingCents, bankValue };
    try {
      await submitPayout(pendingCents, bankValue, idempotencyKey);
      setAmount('');
      setPendingCents(null);
      setFormError('');
      idempotencyRef.current = null;
      setToastOpen(true);
    } catch (error) {
      setFormError(getYm27ErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="ym27-demo-banner">
        <Alert type="warning">Demo data – Simulated wallet and payouts. No real money movement.</Alert>
        <span className="ym27-demo-tag">YM27</span>
      </div>

      <WalletTabs />

      <div className="ym27-page-header">
        <div>
          <h1>Request a simulated payout</h1>
          <p>Choose an amount and review your demo payout before submitting.</p>
        </div>
        <span className="ym27-sim-pill">Simulated only</span>
      </div>

      <Alert type="info">
        Pending requests stay in temporary server memory for this browser session. They may expire after inactivity or be cleared when the server restarts; the displayed wallet balance remains unchanged.
      </Alert>
      {walletLoading && <p role="status">Loading wallet balance…</p>}
      {payoutOptionsLoading && <p role="status">Loading simulated destinations…</p>}
      {walletError && <Alert type="error">{walletError}</Alert>}
      {payoutOptionsError && <Alert type="error">{payoutOptionsError}</Alert>}

      <div className="ym27-split ym27-section-gap">
        <form className="ym27-info-card" onSubmit={(event) => { event.preventDefault(); requestConfirmation(); }}>
          <h2>Payout amount</h2>
          <p className="ym27-cell-meta">Available to request now: {wallet ? formatLKR(remainingRequestable) : '—'}</p>
          <div className="ym27-amount-row">
            <InputField
              label="Amount"
              unit="LKR"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              error={fieldError}
              onChange={(event) => { setAmount(event.target.value); setFieldError(''); setFormError(''); }}
            />
            <button
              type="button"
              className="ym27-text-button"
              disabled={remainingRequestable <= 0}
              onClick={() => { setAmount(centsToInput(remainingRequestable)); setFieldError(''); setFormError(''); }}
            >
              Use max
            </button>
          </div>
          <p className="ym27-cell-meta">Enter an amount greater than LKR 0.00 and no more than the remaining simulated balance. Amounts use two decimal places.</p>

          <div className="ym27-destination">
            <h2>Demo destination</h2>
            <SelectField
              label="Simulated account"
              value={bankValue}
              options={bankOptions.map((account) => ({ value: account.value, label: account.label }))}
              onChange={(event) => setBankValue(event.target.value)}
            />
            <p className="ym27-cell-meta">Masked demo labels only. No account number is collected or stored.</p>
          </div>

          {payoutOptions?.length === 0 && <p role="status">No simulated payout destinations are available.</p>}

          {formError && <div className="ym27-section-gap"><Alert type="error">{formError}</Alert></div>}

          <div className="ym27-form-actions">
            <Button type="submit" disabled={!wallet || !payoutOptions?.length || payoutOptionsLoading || remainingRequestable <= 0 || submitting}>
              {submitting ? 'Recording simulated request…' : 'Submit simulated payout'}
            </Button>
            <Link to="/farmer/wallet/payout/history" className="ym27-inline-link">View payout history</Link>
          </div>
        </form>

        <aside className="ym27-info-card">
          <h2>Review summary</h2>
          <p className="ym27-review-amount">{previewCents !== null && withinBalance ? formatLKR(previewCents) : '—'}</p>
          <dl className="ym27-kv">
            <dt>Original available balance</dt>
            <dd>{wallet ? formatLKR(wallet.summary.availableBalance) : '—'}</dd>
            <dt>Remaining before this request</dt>
            <dd>{formatLKR(remainingRequestable)}</dd>
            <dt>Remaining if recorded</dt>
            <dd>{remainingAfter === null ? '—' : formatLKR(remainingAfter)}</dd>
            <dt>Destination</dt>
            <dd>{bank?.label ?? '—'}</dd>
            <dt>Status if recorded</dt>
            <dd>Pending</dd>
          </dl>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Record this simulated payout request?"
        description={pendingCents === null ? 'No amount is selected.' : `Record ${formatLKR(pendingCents)} to ${bank?.label ?? 'the selected demo destination'} as pending. No bank is contacted and no funds move.`}
        simulationNote="The displayed balance stays unchanged. This temporary request may expire after inactivity or a server restart."
        confirmLabel="Record simulated request"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { void confirmRequest(); }}
      />
      <Toast open={toastOpen} message="Simulated payout request recorded as pending. No funds were transferred." onClose={() => setToastOpen(false)} />
    </div>
  );
}
