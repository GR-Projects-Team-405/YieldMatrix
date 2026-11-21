/**
 * Pure display helpers for the YM17 Allocation Inbox.
 *
 * PostgreSQL returns money as BIGINT cents and weight as NUMERIC, both as
 * decimal *strings* in JSON. Every formatter below works on the string with
 * integer maths only, so no financial value is ever routed through a JavaScript
 * float (which would silently round large totals).
 */

/** Time zone used for every timestamp shown to the farmer. */
const COLOMBO = 'Asia/Colombo';

const colomboDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: COLOMBO,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const colomboDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: COLOMBO,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** "7200000" cents -> "LKR 72,000"; "7200050" -> "LKR 72,000.50". */
export function formatLkrCents(cents: string | number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  const raw = String(cents).trim();
  const negative = raw.startsWith('-');
  const digits = negative ? raw.slice(1) : raw;
  if (!/^\d+$/.test(digits)) return '—';

  // Split off the last two digits as the fractional rupees, without dividing.
  const rupees = (digits.slice(0, -2) || '0').replace(/^0+(?=\d)/, '');
  const fraction = digits.slice(-2);
  const grouped = rupees.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `LKR ${negative ? '-' : ''}${grouped}${fraction === '00' ? '' : `.${fraction}`}`;
}

/** "400.000" -> "400 kg"; "350.500" -> "350.5 kg" (trailing zeros trimmed, precision kept). */
export function formatKg(kg: string | number | null | undefined): string {
  if (kg === null || kg === undefined) return '—';
  const raw = String(kg).trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return `${raw} kg`;
  const [whole, fraction = ''] = raw.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return `${trimmed ? `${whole}.${trimmed}` : whole} kg`;
}

/** ISO instant -> "02 Nov, 11:30 AM" rendered in Asia/Colombo. */
export function formatColomboDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = colomboDateTime.formatToParts(date);
  const value = (type: 'day' | 'month' | 'hour' | 'minute' | 'dayPeriod') =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')} ${value('month')}, ${value('hour')}:${value('minute')} ${value('dayPeriod').toUpperCase()}`;
}

/** "02 NOV 2026" for the dashboard eyebrow, always in Asia/Colombo. */
export function formatDashboardDate(date: Date = new Date()): string {
  return colomboDate.format(date).toUpperCase();
}

/**
 * Shortens a UUID to its first 8 characters for display.
 * The schema has no human friendly reference code, and the operation_key it
 * does have exists for idempotency rather than for showing to people, so the
 * record's own id is shortened instead.
 */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

const STATUS_LABELS: Record<string, string> = {
  held: 'Awaiting Response',
  supplier_accepted: 'Supplier Accepted',
  committed: 'Committed',
  picked_up: 'Picked Up',
  handed_over: 'Handed Over',
  accepted: 'Accepted',
  partially_accepted: 'Partially Accepted',
  disputed: 'Disputed',
  resolved: 'Resolved',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

/** "supplier_accepted" -> "Supplier Accepted". */
export function statusLabel(status: string): string {
  const known = STATUS_LABELS[status];
  if (known) return known;
  const plain = status.replaceAll('_', ' ').trim();
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}
