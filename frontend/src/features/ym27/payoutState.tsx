import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createPayout,
  fetchPayoutOptions,
  fetchPayouts,
  fetchSettlements,
  fetchTransactions,
  fetchWallet,
  getYm27ErrorMessage,
  type PayoutsResponse,
  type WalletResponse,
} from './api';
import type { BankAccount, PayoutRecord, Settlement, Transaction } from './mockData';

interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function initialResource<T>(): Resource<T> {
  return { data: null, loading: true, error: null };
}

interface PayoutStateValue {
  wallet: WalletResponse | null;
  walletLoading: boolean;
  walletError: string | null;
  transactions: Transaction[] | null;
  transactionsLoading: boolean;
  transactionsError: string | null;
  settlements: Settlement[] | null;
  settlementsLoading: boolean;
  settlementsError: string | null;
  payoutOptions: BankAccount[] | null;
  payoutOptionsLoading: boolean;
  payoutOptionsError: string | null;
  payouts: PayoutsResponse | null;
  payoutsLoading: boolean;
  payoutsError: string | null;
  refreshWallet: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshSettlements: () => Promise<void>;
  refreshPayoutOptions: () => Promise<void>;
  refreshPayouts: () => Promise<void>;
  submitPayout: (amountCents: number, bankValue: string, idempotencyKey: string) => Promise<PayoutRecord>;
}

const PayoutStateContext = createContext<PayoutStateValue | undefined>(undefined);

export function PayoutStateProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Resource<WalletResponse>>(initialResource);
  const [transactions, setTransactions] = useState<Resource<Transaction[]>>(initialResource);
  const [settlements, setSettlements] = useState<Resource<Settlement[]>>(initialResource);
  const [payoutOptions, setPayoutOptions] = useState<Resource<BankAccount[]>>(initialResource);
  const [payouts, setPayouts] = useState<Resource<PayoutsResponse>>(initialResource);
  const walletRequestVersion = useRef(0);
  const payoutsRequestVersion = useRef(0);

  const refreshWallet = useCallback(async () => {
    const requestVersion = ++walletRequestVersion.current;
    setWallet((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchWallet();
      if (requestVersion === walletRequestVersion.current) setWallet({ data, loading: false, error: null });
    } catch (error) {
      if (requestVersion === walletRequestVersion.current) {
        setWallet({ data: null, loading: false, error: getYm27ErrorMessage(error) });
      }
    }
  }, []);
  const refreshTransactions = useCallback(async () => {
    setTransactions((current) => ({ ...current, loading: true, error: null }));
    try {
      setTransactions({ data: await fetchTransactions(), loading: false, error: null });
    } catch (error) {
      setTransactions({ data: null, loading: false, error: getYm27ErrorMessage(error) });
    }
  }, []);
  const refreshSettlements = useCallback(async () => {
    setSettlements((current) => ({ ...current, loading: true, error: null }));
    try {
      setSettlements({ data: await fetchSettlements(), loading: false, error: null });
    } catch (error) {
      setSettlements({ data: null, loading: false, error: getYm27ErrorMessage(error) });
    }
  }, []);
  const refreshPayoutOptions = useCallback(async () => {
    setPayoutOptions((current) => ({ ...current, loading: true, error: null }));
    try {
      setPayoutOptions({ data: await fetchPayoutOptions(), loading: false, error: null });
    } catch (error) {
      setPayoutOptions({ data: null, loading: false, error: getYm27ErrorMessage(error) });
    }
  }, []);
  const refreshPayouts = useCallback(async () => {
    const requestVersion = ++payoutsRequestVersion.current;
    setPayouts((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchPayouts();
      if (requestVersion === payoutsRequestVersion.current) {
        setPayouts({ data, loading: false, error: null });
        setWallet((current) => current.data
          ? { ...current, data: { ...current.data, remainingRequestable: data.remainingRequestable } }
          : current);
      }
    } catch (error) {
      if (requestVersion === payoutsRequestVersion.current) {
        setPayouts({ data: null, loading: false, error: getYm27ErrorMessage(error) });
      }
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      refreshWallet(),
      refreshTransactions(),
      refreshSettlements(),
      refreshPayoutOptions(),
      refreshPayouts(),
    ]);
  }, [refreshWallet, refreshTransactions, refreshSettlements, refreshPayoutOptions, refreshPayouts]);

  const submitPayout = useCallback(async (
    amountCents: number,
    bankValue: string,
    idempotencyKey: string,
  ): Promise<PayoutRecord> => {
    const response = await createPayout(amountCents, bankValue, idempotencyKey);
    payoutsRequestVersion.current += 1;
    walletRequestVersion.current += 1;
    setPayouts({
      data: { payouts: response.payouts, remainingRequestable: response.remainingRequestable },
      loading: false,
      error: null,
    });
    setWallet((current) => current.data
      ? { ...current, data: { ...current.data, remainingRequestable: response.remainingRequestable } }
      : current);
    return response.payout;
  }, []);

  const value = useMemo(() => ({
    wallet: wallet.data,
    walletLoading: wallet.loading,
    walletError: wallet.error,
    transactions: transactions.data,
    transactionsLoading: transactions.loading,
    transactionsError: transactions.error,
    settlements: settlements.data,
    settlementsLoading: settlements.loading,
    settlementsError: settlements.error,
    payoutOptions: payoutOptions.data,
    payoutOptionsLoading: payoutOptions.loading,
    payoutOptionsError: payoutOptions.error,
    payouts: payouts.data,
    payoutsLoading: payouts.loading,
    payoutsError: payouts.error,
    refreshWallet,
    refreshTransactions,
    refreshSettlements,
    refreshPayoutOptions,
    refreshPayouts,
    submitPayout,
  }), [
    wallet, transactions, settlements, payoutOptions, payouts,
    refreshWallet, refreshTransactions, refreshSettlements, refreshPayoutOptions, refreshPayouts, submitPayout,
  ]);

  return <PayoutStateContext.Provider value={value}>{children}</PayoutStateContext.Provider>;
}

export function usePayoutState(): PayoutStateValue {
  const context = useContext(PayoutStateContext);
  if (!context) throw new Error('usePayoutState must be used within PayoutStateProvider');
  return context;
}
