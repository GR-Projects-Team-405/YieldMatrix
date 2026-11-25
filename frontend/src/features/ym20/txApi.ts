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