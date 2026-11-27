import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createPayout,
  fetchPayoutOptions,
  fetchPayouts,
  fetchSettlements,
  fetchTransactions,
  fetchWallet,
  getYm27ErrorMessage,
  getYm27ResponseMode,
  type PayoutsResponse,
  type Ym27DataMode,
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
  payoutSubmissionEnabled: boolean;
  payoutOptionsLoading: boolean;
  payoutOptionsError: string | null;
  payouts: PayoutsResponse | null;
  dataMode: Ym27DataMode | null;
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
  const [dataMode, setDataMode] = useState<Ym27DataMode | null>(null);
  const [wallet, setWallet] = useState<Resource<WalletResponse>>(initialResource);
  const [transactions, setTransactions] = useState<Resource<Transaction[]>>(initialResource);
  const [settlements, setSettlements] = useState<Resource<Settlement[]>>(initialResource);
  const [payoutOptions, setPayoutOptions] = useState<Resource<BankAccount[]>>(initialResource);
  const [payoutSubmissionEnabled, setPayoutSubmissionEnabled] = useState(false);
  const [payouts, setPayouts] = useState<Resource<PayoutsResponse>>(initialResource);
  const walletRequestVersion = useRef(0);
  const payoutsRequestVersion = useRef(0);

  const refreshWallet = useCallback(async () => {
    const requestVersion = ++walletRequestVersion.current;
    setWallet((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchWallet();
      if (requestVersion === walletRequestVersion.current) {
        setDataMode(data.mode);
        setWallet({ data, loading: false, error: null });
      }
    } catch (error) {
      if (requestVersion === walletRequestVersion.current) {
        const responseMode = getYm27ResponseMode(error);
        if (responseMode) setDataMode(responseMode);
        setWallet({ data: null, loading: false, error: getYm27ErrorMessage(error) });
      }
    }
  }, []);
  const refreshTransactions = useCallback(async () => {
    setTransactions((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetchTransactions();
      setDataMode(response.mode);
      setTransactions({ data: response.transactions, loading: false, error: null });
    } catch (error) {
      const responseMode = getYm27ResponseMode(error);
      if (responseMode) setDataMode(responseMode);
      setTransactions({ data: null, loading: false, error: getYm27ErrorMessage(error) });
    }
  }, []);
  const refreshSettlements = useCallback(async () => {
    setSettlements((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetchSettlements();
      setDataMode(response.mode);
      setSettlements({ data: response.settlements, loading: false, error: null });
    } catch (error) {
      const responseMode = getYm27ResponseMode(error);
      if (responseMode) setDataMode(responseMode);
      setSettlements({ data: null, loading: false, error: getYm27ErrorMessage(error) });
    }
  }, []);
  const refreshPayoutOptions = useCallback(async () => {
    setPayoutOptions((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetchPayoutOptions();
      setDataMode(response.mode);
      setPayoutSubmissionEnabled(response.payoutSubmissionEnabled);
      setPayoutOptions({ data: response.payoutOptions, loading: false, error: null });
    } catch (error) {
      const responseMode = getYm27ResponseMode(error);
      if (responseMode) setDataMode(responseMode);
      setPayoutOptions({ data: null, loading: false, error: getYm27ErrorMessage(error) });
    }
  }, []);
  const refreshPayouts = useCallback(async () => {
    const requestVersion = ++payoutsRequestVersion.current;
    setPayouts((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchPayouts();
      if (requestVersion === payoutsRequestVersion.current) {
        setDataMode(data.mode);
        setPayouts({ data, loading: false, error: null });
        setWallet((current) => current.data
          ? { ...current, data: { ...current.data, remainingRequestable: data.remainingRequestable } }
          : current);
      }
    } catch (error) {
      if (requestVersion === payoutsRequestVersion.current) {
        const responseMode = getYm27ResponseMode(error);
        if (responseMode) setDataMode(responseMode);
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
    if (dataMode === 'database' && !payoutSubmissionEnabled) {
      throw new Error('Payout submission is disabled in database read-only mode.');
    }
    const mode = dataMode ?? 'mock';
    const response = await createPayout(amountCents, bankValue, idempotencyKey, mode);
    payoutsRequestVersion.current += 1;
    walletRequestVersion.current += 1;
    setDataMode(response.mode);
    if (response.mode === 'database') {
      await Promise.all([refreshWallet(), refreshPayouts(), refreshTransactions()]);
      return response.payout;
    }
    const remainingRequestable = response.remainingRequestable;
    if (!response.payouts || remainingRequestable === undefined) {
      throw new TypeError('Mock payout response is incomplete.');
    }
    setPayouts({
      data: {
        mode: response.mode,
        payouts: response.payouts,
        remainingRequestable,
      },
      loading: false,
      error: null,
    });
    setWallet((current) => current.data
      ? { ...current, data: { ...current.data, remainingRequestable } }
      : current);
    return response.payout;
  }, [dataMode, payoutSubmissionEnabled, refreshWallet, refreshPayouts, refreshTransactions]);

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
    payoutSubmissionEnabled,
    payoutOptionsLoading: payoutOptions.loading,
    payoutOptionsError: payoutOptions.error,
    payouts: payouts.data,
    dataMode,
    payoutsLoading: payouts.loading,
    payoutsError: payouts.error,
    refreshWallet,
    refreshTransactions,
    refreshSettlements,
    refreshPayoutOptions,
    refreshPayouts,
    submitPayout,
  }), [
    wallet, transactions, settlements, payoutOptions, payouts, dataMode, payoutSubmissionEnabled,
    refreshWallet, refreshTransactions, refreshSettlements, refreshPayoutOptions, refreshPayouts, submitPayout,
  ]);

  return <PayoutStateContext.Provider value={value}>{children}</PayoutStateContext.Provider>;
}

export function usePayoutState(): PayoutStateValue {
  const context = useContext(PayoutStateContext);
  if (!context) throw new Error('usePayoutState must be used within PayoutStateProvider');
  return context;
}
