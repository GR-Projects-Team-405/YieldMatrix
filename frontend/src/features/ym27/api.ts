import axios from 'axios';
import api from '../../services/api';
import type {
  BankAccount,
  PayoutRecord,
  Settlement,
  Transaction,
  WalletSummary,
} from './mockData';

const SESSION_STORAGE_KEY = 'ym27_wallet_session';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WalletResponse {
  summary: WalletSummary;
  remainingRequestable: number;
}

export interface PayoutsResponse {
  payouts: PayoutRecord[];
  remainingRequestable: number;
}

export interface PayoutSubmissionResponse extends PayoutsResponse {
  payout: PayoutRecord;
}

function sessionHeaders(): Record<string, string> {
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId || !uuidPattern.test(sessionId)) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return { 'X-YM27-Session-Id': sessionId };
}

export function getYm27ErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 401) return 'Your session has expired. Sign in again.';
    const message = error.response?.data?.error;
    if (message) return message;
  }
  return 'The wallet service could not be reached. Please try again.';
}

export async function fetchWallet(): Promise<WalletResponse> {
  const response = await api.get<WalletResponse>('/ym27/wallet', { headers: sessionHeaders() });
  return response.data;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const response = await api.get<{ transactions: Transaction[] }>('/ym27/wallet/transactions');
  return response.data.transactions;
}

export async function fetchSettlements(): Promise<Settlement[]> {
  const response = await api.get<{ settlements: Settlement[] }>('/ym27/wallet/settlements');
  return response.data.settlements;
}

export async function fetchSettlement(settlementId: string): Promise<Settlement | null> {
  try {
    const response = await api.get<{ settlement: Settlement }>(
      `/ym27/wallet/settlements/${encodeURIComponent(settlementId)}`,
    );
    return response.data.settlement;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function fetchPayoutOptions(): Promise<BankAccount[]> {
  const response = await api.get<{ payoutOptions: BankAccount[] }>('/ym27/payout-options');
  return response.data.payoutOptions;
}

export async function fetchPayouts(): Promise<PayoutsResponse> {
  const response = await api.get<PayoutsResponse>('/ym27/wallet/payouts', {
    headers: sessionHeaders(),
  });
  return response.data;
}

export async function createPayout(
  amountCents: number,
  bankValue: string,
  idempotencyKey: string,
): Promise<PayoutSubmissionResponse> {
  const response = await api.post<PayoutSubmissionResponse>(
    '/ym27/wallet/payouts',
    { amountCents, bankValue },
    {
      headers: {
        ...sessionHeaders(),
        'Idempotency-Key': idempotencyKey,
      },
    },
  );
  return response.data;
}
