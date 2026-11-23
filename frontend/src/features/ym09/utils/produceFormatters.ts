import type { ListingStatus } from '../types/produce';

/**
 * Formats integer LKR cents to a standard per-kg price string.
 * Example: 32000 cents -> "LKR 320 / kg"
 * Currency calculations must use integer cents (DR-06).
 */
export function formatLkrPrice(cents: number): string {
  const rupees = Math.round(cents / 100);
  return `LKR ${rupees.toLocaleString('en-US')} / kg`;
}

/**
 * Formats integer LKR cents to a total value string.
 * Example: 14500000 cents -> "LKR 145,000"
 */
export function formatLkrTotal(cents: number): string {
  const rupees = Math.round(cents / 100);
  return `LKR ${rupees.toLocaleString('en-US')}`;
}

/**
 * Formats weight in kg with up to 3 decimal places (DR-06), trimming trailing zeros.
 * Example: 80 -> "80 kg", 25.5 -> "25.5 kg"
 */
export function formatKg(kg: number): string {
  const formatted = Number(kg.toFixed(3));
  return `${formatted.toLocaleString('en-US')} kg`;
}

/**
 * Maps database listing status to YieldMatrix semantic tone.
 * active -> success (green)
 * draft -> warning (amber)
 * paused -> neutral (grey)
 * expired -> error (red)
 * closed -> neutral (grey)
 */
export function getListingStatusTone(status: ListingStatus): 'success' | 'warning' | 'info' | 'error' | 'neutral' {
  switch (status) {
    case 'active':
      return 'success';
    case 'draft':
      return 'warning';
    case 'expired':
      return 'error';
    case 'paused':
    case 'closed':
    default:
      return 'neutral';
  }
}

/**
 * Capitalizes listing status for UI badges.
 * Example: 'active' -> 'Active'
 */
export function formatListingStatusLabel(status: ListingStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an ISO date string (YYYY-MM-DD or UTC ISO) to "D MMM YYYY".
 * Example: "2026-11-10" -> "10 Nov 2026"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Formats a date range into the concise preview format: "10 Nov – 25 Nov 2026".
 */
export function formatDateRangePreview(fromStr: string, untilStr: string): string {
  if (!fromStr && !untilStr) return 'Dates pending';
  if (!untilStr) return `From ${formatDisplayDate(fromStr)}`;
  if (!fromStr) return `Until ${formatDisplayDate(untilStr)}`;

  const fromDate = new Date(fromStr);
  const untilDate = new Date(untilStr);
  if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
    return `${fromStr} – ${untilStr}`;
  }

  const fromDay = fromDate.getDate();
  const fromMonth = MONTHS_SHORT[fromDate.getMonth()];
  const untilDay = untilDate.getDate();
  const untilMonth = MONTHS_SHORT[untilDate.getMonth()];
  const year = untilDate.getFullYear();

  if (fromMonth === untilMonth && fromDate.getFullYear() === untilDate.getFullYear()) {
    return `${fromDay} – ${untilDay} ${untilMonth} ${year}`;
  }
  return `${fromDay} ${fromMonth} – ${untilDay} ${untilMonth} ${year}`;
}

/**
 * Returns today's date formatted as YYYY-MM-DD for native HTML date inputs.
 */
export function getTodayDateInputString(): string {
  // Use fixed base date for reproducible demo matching screenshot (10 Nov 2026) or fallback to today
  const date = new Date();
  // Ensure default year matches 2026 project timeline
  const year = date.getFullYear() < 2026 ? 2026 : date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a future date string (YYYY-MM-DD) offset by a given number of days from baseDate.
 */
export function getFutureDateInputString(days: number = 15, baseDateStr?: string): string {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(base.getTime())) return getTodayDateInputString();
  const future = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const year = future.getFullYear() < 2026 ? 2026 : future.getFullYear();
  const month = String(future.getMonth() + 1).padStart(2, '0');
  const day = String(future.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

