import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { MOCK_BANK_ACCOUNTS, MOCK_WALLET_SUMMARY, type PayoutRecord } from './mockData';

// In-memory simulated payout requests. Reloading, or leaving the wallet routes, clears them.
// Nothing here calls a bank, a payment API, or the database.

export type PayoutResult = { ok: true } | { ok: false; error: string };

interface PayoutStateValue {
  localPayouts: PayoutRecord[];
  /** Original available balance minus pending local requests, in LKR cents. */
  remainingRequestable: number;
  addPayout: (amountCents: number, bankValue: string) => PayoutResult;
}

const PayoutStateContext = createContext<PayoutStateValue | undefined>(undefined);

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function PayoutStateProvider({ children }: { children: ReactNode }) {
  const [localPayouts, setLocalPayouts] = useState<PayoutRecord[]>([]);

  const remainingRequestable = useMemo(() => {
    const reserved = localPayouts
      .filter((payout) => payout.status === 'pending')
      .reduce((sum, payout) => sum + payout.amount, 0);
    return MOCK_WALLET_SUMMARY.availableBalance - reserved;
  }, [localPayouts]);

  const addPayout = useCallback((amountCents: number, bankValue: string): PayoutResult => {
    const bank = MOCK_BANK_ACCOUNTS.find((account) => account.value === bankValue);
    if (!bank) return { ok: false, error: 'Choose one of the simulated destinations.' };
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: 'Enter a simulated amount greater than zero.' };
    }

    const reserved = localPayouts
      .filter((payout) => payout.status === 'pending')
      .reduce((sum, payout) => sum + payout.amount, 0);
    const remaining = MOCK_WALLET_SUMMARY.availableBalance - reserved;
    if (amountCents > remaining) {
      return { ok: false, error: 'That amount is above the remaining simulated balance.' };
    }

    const date = todayIso();
    const record: PayoutRecord = {
      id: `local-${crypto.randomUUID()}`,
      date,
      amount: amountCents,
      bankLabel: bank.label,
      status: 'pending',
      reference: `SIM-LOCAL-${date.replaceAll('-', '')}-${String(localPayouts.length + 1).padStart(3, '0')}`,
    };

    setLocalPayouts((current) => {
      if (current.some((item) => item.id === record.id)) return current;
      const reservedNow = current
        .filter((payout) => payout.status === 'pending')
        .reduce((sum, payout) => sum + payout.amount, 0);
      if (amountCents > MOCK_WALLET_SUMMARY.availableBalance - reservedNow) return current;
      return [record, ...current];
    });

    return { ok: true };
  }, [localPayouts]);

  const value = useMemo(
    () => ({ localPayouts, remainingRequestable, addPayout }),
    [localPayouts, remainingRequestable, addPayout],
  );

  return <PayoutStateContext.Provider value={value}>{children}</PayoutStateContext.Provider>;
}

export function usePayoutState(): PayoutStateValue {
  const context = useContext(PayoutStateContext);
  if (!context) throw new Error('usePayoutState must be used within PayoutStateProvider');
  return context;
}
