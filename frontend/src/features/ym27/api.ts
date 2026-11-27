import axios from 'axios';
import api from '../../services/api';
import type {
  BankAccount,
  PayoutRecord,
  Settlement,
  Transaction,
  WalletSummary,
} from './mockData';

export type Ym27DataMode = 'mock' | 'database';

const SESSION_STORAGE_KEY = 'ym27_wallet_session';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WalletResponse {
  mode: Ym27DataMode;
  summary: WalletSummary;
  remainingRequestable: number | null;
}

export interface PayoutsResponse {
  mode: Ym27DataMode;
  payouts: PayoutRecord[];
  remainingRequestable: number | null;
}

export interface PayoutSubmissionResponse {
  mode: Ym27DataMode;
  payout: PayoutRecord;
  replayed?: boolean;
  payouts?: PayoutRecord[];
  remainingRequestable?: number | null;
}

export interface TransactionsResponse {
  mode: Ym27DataMode;
  transactions: Transaction[];
}

export interface SettlementsResponse {
  mode: Ym27DataMode;
  settlements: Settlement[];
}

export interface PayoutOptionsResponse {
  mode: Ym27DataMode;
  destinationSource: 'simulated' | 'not-stored';
  payoutOptions: BankAccount[];
  payoutSubmissionEnabled: boolean;
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

export function getYm27ResponseMode(error: unknown): Ym27DataMode | null {
  if (!axios.isAxiosError<{ mode?: string }>(error)) return null;
  const mode = error.response?.data?.mode;
  return mode === 'mock' || mode === 'database' ? mode : null;
}

export async function fetchWallet(): Promise<WalletResponse> {
  const response = await api.get<WalletResponse>('/ym27/wallet', { headers: sessionHeaders() });
  return response.data;
}

export async function fetchTransactions(): Promise<TransactionsResponse> {
  const response = await api.get<TransactionsResponse>('/ym27/wallet/transactions');
  return response.data;
}

export async function fetchSettlements(): Promise<SettlementsResponse> {
  const response = await api.get<SettlementsResponse>('/ym27/wallet/settlements');
  return response.data;
}

export async function fetchSettlement(settlementId: string): Promise<{
  settlement: Settlement | null;
  mode: Ym27DataMode | null;
}> {
  try {
    const response = await api.get<{ settlement: Settlement; mode: Ym27DataMode }>(
      `/ym27/wallet/settlements/${encodeURIComponent(settlementId)}`,
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError<{ mode?: string }>(error) && error.response?.status === 404) {
      const mode = error.response.data?.mode;
      return {
        settlement: null,
        mode: mode === 'mock' || mode === 'database' ? mode : null,
      };
    }
    throw error;
  }
}

export async function fetchPayoutOptions(): Promise<PayoutOptionsResponse> {
  const response = await api.get<PayoutOptionsResponse>('/ym27/payout-options');
  return response.data;
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
  mode: Ym27DataMode,
): Promise<PayoutSubmissionResponse> {
  const response = await api.post<PayoutSubmissionResponse>(
    '/ym27/wallet/payouts',
    mode === 'database' ? { amountCents } : { amountCents, bankValue },
    {
      headers: {
        ...(mode === 'mock' ? sessionHeaders() : {}),
        'Idempotency-Key': idempotencyKey,
      },
    },
  );
  return response.data;
}
