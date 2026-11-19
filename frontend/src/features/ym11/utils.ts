export function formatLkrFromCents(cents: number | null | undefined, currency = 'LKR'): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return `${currency} 0`;
  }
  const hasFraction = Math.abs(cents % 100) !== 0;
  const amount = cents / 100;
  return `${currency} ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`;
}

export function formatLkrNumberFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '0';
  const hasFraction = Math.abs(cents % 100) !== 0;
  const amount = cents / 100;
  return amount.toLocaleString('en-LK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}

export function formatKg(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '0 kg';
  const rounded = Number(kg.toFixed(3));
  return `${rounded.toLocaleString('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} kg`;
}

export function formatPaddedCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return '00';
  return count < 10 ? `0${count}` : String(count);
}

export function formatColomboHeadingDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(date)
    .toUpperCase();
}

export function formatColomboShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatColomboDayMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function getFirstName(fullName: string | null | undefined): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return 'Buyer';
  return trimmed.split(/\s+/)[0];
}

export function getInitials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'YM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function formatOrderStatusForBadge(status: string): string {
  switch (status) {
    case 'awaiting_suppliers':
      return 'Awaiting response';
    case 'ready_to_confirm':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'in_fulfilment':
      return 'In transit';
    case 'delivered':
    case 'closed':
      return 'Verified';
    case 'draft':
      return 'Draft';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Rejected';
    default:
      return status.replaceAll('_', ' ');
  }
}

export function formatOrderStatusDisplay(status: string): string {
  switch (status) {
    case 'awaiting_suppliers':
      return 'Awaiting response';
    case 'ready_to_confirm':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'in_fulfilment':
      return 'In transit';
    case 'delivered':
      return 'Delivered';
    case 'closed':
      return 'Completed';
    case 'draft':
      return 'Draft';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status.replaceAll('_', ' ');
  }
}
