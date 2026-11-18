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
