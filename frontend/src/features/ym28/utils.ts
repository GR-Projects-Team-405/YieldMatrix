export type CentsValue = string | number;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BuyerWalletResponse {
  simulated: boolean;
  simulationNotice: string;
  wallet: {
    id: string;
    ownerId: string;
    ownerName: string;
    accountType: string;
    currency: string;
    availableCents: CentsValue;
    heldCents: CentsValue;
    pendingPayoutCents: CentsValue;
    totalBalanceCents: CentsValue;
    simulated: boolean;
    createdAt: string;
  };
  summary: {
    totalFundedCents: CentsValue;
    totalSettledCents: CentsValue;
    totalRefundedCents: CentsValue;
    totalTransactionCount: number;
    heldOrderCount: number;
    heldAllocationCount: number;
    allocationHeldCents: CentsValue;
  };
  requestId: string;
}

export interface BuyerTransactionItem {
  id: string;
  eventType: string;
  eventReference: string;
  currency: string;
  amountCents: CentsValue;
  availableDeltaCents: CentsValue;
  heldDeltaCents: CentsValue;
  orderId: string | null;
  allocationId: string | null;
  reversalOf: string | null;
  reversedById: string | null;
  occurredAt: string;
  recordedAt: string;
}

export interface BuyerTransactionsResponse {
  simulated: boolean;
  transactions: BuyerTransactionItem[];
  pagination: PaginationMeta;
  requestId: string;
}

export interface BuyerTransactionDetailResponse {
  simulated: boolean;
  transaction: {
    id: string;
    eventType: string;
    eventReference: string;
    currency: string;
    amountCents: CentsValue;
    orderId: string | null;
    allocationId: string | null;
    reversalOf: string | null;
    reversedById: string | null;
    actorName: string;
    actorRole: string;
    occurredAt: string;
    recordedAt: string;
    lines: Array<{
      id: string;
      walletLabel: string;
      accountType: string;
      isOwnWallet: boolean;
      bucket: string;
      side: 'debit' | 'credit';
      amountCents: CentsValue;
      createdAt: string;
    }>;
    order: {
      id: string;
      destination: string;
      destinationDistrict: string;
      deliveryDate: string;
      agreedTotalCents: CentsValue;
      status: string;
      cancellationReason: string | null;
    } | null;
    allocation: {
      id: string;
      orderId: string;
      batchId: string;
      farmerName: string;
      agreedKg: string;
      agreedUnitPriceCents: CentsValue;
      agreedValueCents: CentsValue;
      acceptedKg: string;
      fundedCents: CentsValue;
      settledCents: CentsValue;
      refundedCents: CentsValue;
      heldCents: CentsValue;
      status: string;
    } | null;
  };
  requestId: string;
}

export interface BuyerHeldFundsResponse {
  simulated: boolean;
  walletHeldCents: CentsValue;
  totalAllocationHeldCents: CentsValue;
  totalAllocationFundedCents: CentsValue;
  totalAllocationSettledCents: CentsValue;
  totalAllocationRefundedCents: CentsValue;
  holdsAligned: boolean;
  orders: Array<{
    orderId: string;
    destination: string;
    destinationDistrict: string;
    deliveryDate: string;
    agreedTotalCents: CentsValue;
    orderStatus: string;
    createdAt: string;
    orderFundedCents: CentsValue;
    orderSettledCents: CentsValue;
    orderRefundedCents: CentsValue;
    orderHeldCents: CentsValue;
    allocations: Array<{
      allocationId: string;
      batchId: string;
      farmerId: string;
      farmerName: string;
      agreedKg: string;
      agreedUnitPriceCents: CentsValue;
      agreedValueCents: CentsValue;
      committedKg: string;
      pickedUpKg: string;
      handedOverKg: string;
      acceptedKg: string;
      fundedCents: CentsValue;
      settledCents: CentsValue;
      refundedCents: CentsValue;
      heldCents: CentsValue;
      status: string;
    }>;
  }>;
  requestId: string;
}

export interface BuyerRefundsResponse {
  simulated: boolean;
  summary: {
    totalRefundCount: number;
    totalRefundedCents: CentsValue;
    openDisputeCount: number;
  };
  refunds: Array<{
    id: string;
    eventReference: string;
    amountCents: CentsValue;
    currency: string;
    orderId: string | null;
    allocationId: string | null;
    orderStatus: string | null;
    destinationDistrict: string | null;
    cancellationReason: string | null;
    farmerName: string | null;
    agreedKg: string | null;
    acceptedKg: string | null;
    fundedCents: CentsValue | null;
    settledCents: CentsValue | null;
    allocationRefundedCents: CentsValue | null;
    allocationHeldCents: CentsValue | null;
    allocationStatus: string | null;
    dispute: {
      id: string;
      status: string;
      reason: string;
      resolution: string | null;
      resolvedAt: string | null;
    } | null;
    occurredAt: string;
    recordedAt: string;
  }>;
  disputes: Array<{
    id: string;
    allocationId: string;
    orderId: string;
    farmerName: string;
    disputedKg: string;
    disputedCents: CentsValue;
    refundCents: CentsValue;
    settlementCents: CentsValue;
    status: string;
    reason: string;
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
  }>;
  pagination: PaginationMeta;
  requestId: string;
}

export interface AdminReconciliationWallet {
  walletId: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  accountType: string;
  currency: string;
  availableCents: CentsValue;
  heldCents: CentsValue;
  pendingPayoutCents: CentsValue;
  journalAvailableCents: CentsValue;
  journalHeldCents: CentsValue;
  journalPendingPayoutCents: CentsValue;
  allocationHeldCents: CentsValue;
  allocationFundedCents: CentsValue;
  allocationSettledCents: CentsValue;
  allocationRefundedCents: CentsValue;
  pendingRequestCents: CentsValue;
  journalEntryCount: number;
  availableVarianceCents: CentsValue;
  heldVarianceCents: CentsValue;
  pendingVarianceCents: CentsValue;
  orderHoldVarianceCents: CentsValue;
  payoutRequestVarianceCents: CentsValue;
  isBalanced: boolean;
  issues: string[];
}

export interface AdminReconciliationResponse {
  simulated: boolean;
  generatedAt: string;
  reconciliationStatus: 'balanced' | 'mismatch_detected';
  mismatchCount: number;
  mismatches: Array<{
    scope: string;
    walletId?: string;
    ownerName?: string | null;
    accountType?: string;
    issues: string[];
  }>;
  summary: {
    totalJournalEntries: number;
    totalDebitCents: CentsValue;
    totalCreditCents: CentsValue;
    imbalancedEntryCount: number;
    netSimulatedIssuedCents: CentsValue;
    totalUserWalletCents: CentsValue;
    systemConservationVarianceCents: CentsValue;
    totalWalletAvailableCents: CentsValue;
    totalWalletHeldCents: CentsValue;
    totalWalletPendingPayoutCents: CentsValue;
    totalAllocations: number;
    totalOrderFundedCents: CentsValue;
    totalOrderSettledCents: CentsValue;
    totalOrderRefundedCents: CentsValue;
    totalOrderHeldCents: CentsValue;
    allocationInvariantViolations: number;
  };
  wallets: AdminReconciliationWallet[];
  requestId: string;
}

export interface AdminJournalItem {
  id: string;
  eventType: string;
  eventReference: string;
  operationKey: string;
  currency: string;
  amountCents: CentsValue;
  orderId: string | null;
  allocationId: string | null;
  reversalOf: string | null;
  reversedById: string | null;
  actorName: string;
  actorRole: string;
  occurredAt: string;
  recordedAt: string;
  canReverse: boolean;
  lines: Array<{
    id: string;
    walletId: string;
    ownerName: string;
    accountType: string;
    bucket: string;
    side: 'debit' | 'credit';
    amountCents: CentsValue;
  }>;
}

export interface AdminJournalsResponse {
  simulated: boolean;
  journals: AdminJournalItem[];
  pagination: PaginationMeta;
  requestId: string;
}

function toBigIntCents(value: CentsValue | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return BigInt(0);
  try {
    return BigInt(String(value).trim());
  } catch {
    return BigInt(0);
  }
}

function addThousandsSeparators(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatLkrCents(value: CentsValue | null | undefined): string {
  const big = toBigIntCents(value);
  const negative = big < BigInt(0);
  const abs = negative ? -big : big;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, '0');
  return `${negative ? '-' : ''}LKR ${addThousandsSeparators(whole.toString())}.${frac}`;
}

export function formatSignedLkrCents(value: CentsValue | null | undefined): string {
  const big = toBigIntCents(value);
  if (big > BigInt(0)) return `+${formatLkrCents(big.toString())}`;
  return formatLkrCents(big.toString());
}

export function isPositiveCents(value: CentsValue | null | undefined): boolean {
  return toBigIntCents(value) > BigInt(0);
}

export function isNegativeCents(value: CentsValue | null | undefined): boolean {
  return toBigIntCents(value) < BigInt(0);
}

export function isZeroCents(value: CentsValue | null | undefined): boolean {
  return toBigIntCents(value) === BigInt(0);
}

export function formatKg(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0 kg';
  const num = Number(value);
  if (Number.isNaN(num)) return `${value} kg`;
  return `${num.toLocaleString('en-LK', { maximumFractionDigits: 3 })} kg`;
}

export function formatColomboDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatColomboDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function humanizeLabel(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  return raw
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function generateOperationKey(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}:${randomPart}`;
}

export interface ExtractedApiError {
  message: string;
  fieldErrors: Record<string, string>;
  status?: number;
}

export function extractApiError(error: unknown, fallback: string): ExtractedApiError {
  const err = error as {
    response?: {
      status?: number;
      data?: { error?: string; fieldErrors?: Record<string, string> };
    };
  };
  return {
    message: err?.response?.data?.error || fallback,
    fieldErrors: err?.response?.data?.fieldErrors || {},
    status: err?.response?.status,
  };
}

export function isAbortError(error: unknown): boolean {
  const err = error as { name?: string; code?: string };
  return err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED';
}