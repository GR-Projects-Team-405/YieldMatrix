// Types and helpers for data coming from the YM20 API.
export type ApiTransaction = {
  id: string;
  reference: string;
  type: string;
  status: string;
  amountCents: string; // BIGINT arrives as text
  occurredAt: string; // UTC instant
  orderId: string | null;
};

/** 38947500 cents becomes "LKR 389,475.00" */
export const formatCents = (cents: string | number) =>
  `LKR ${(Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Short readable code from a UUID, e.g. TX-66144E9A */
export const shortCode = (prefix: string, id: string | null) =>
  id ? `${prefix}-${id.slice(0, 8).toUpperCase()}` : '—';

/** Dates are stored in UTC and shown in Sri Lanka time. */
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

export const typeLabel: Record<string, string> = {
  funding: 'Funding',
  hold: 'Funds held',
  settlement: 'Settlement',
  refund: 'Refund',
  reversal: 'Reversal',
};

export const badgeClass = (status: string) => {
  if (status === 'Held') return 'bg-orange-100 text-orange-800';
  if (status === 'Completed') return 'bg-green-100 text-green-900';
  return 'bg-gray-100 text-gray-700';
};

export const sumCents = (rows: ApiTransaction[], type: string) =>
  rows.filter((r) => r.type === type).reduce((total, r) => total + Number(r.amountCents), 0);

export type ApiTransactionDetail = ApiTransaction & {
  recordedAt: string;
  orderStatus: string | null;
  destination: string | null;
  orderTotalCents: string | null;
};

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export type ApiAllocation = {
  id: string;
  status: string;
  farm: string;
  crop: string;
  grade: string;
  agreedKg: string;
  unitPriceCents: string;
  valueCents: string;
  fundedCents: string;
  heldCents: string;
  settledCents: string;
  refundedCents: string;
};

export type ApiOrderDetail = {
  order: { id: string; status: string; destination: string; deliveryDate: string; createdAt: string; totalCents: string | null };
  allocations: ApiAllocation[];
};

export const formatKg = (kg: string | number) => `${Number(kg).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;

export const labelize = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

type CentsKey = 'valueCents' | 'fundedCents' | 'heldCents' | 'settledCents' | 'refundedCents' | 'agreedKg';
export const sumField = (rows: ApiAllocation[], key: CentsKey) => rows.reduce((t, r) => t + Number(r[key]), 0);

export const paymentStatus = (rows: ApiAllocation[]) => {
  if (sumField(rows, 'heldCents') > 0) return 'Held';
  if (sumField(rows, 'settledCents') > 0) return 'Completed';
  if (sumField(rows, 'refundedCents') > 0) return 'Refunded';
  return 'Not funded';
};