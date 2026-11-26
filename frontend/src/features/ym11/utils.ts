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

export function formatColomboTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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

const CATEGORY_LABELS: Record<string, string> = {
  vegetables: 'vegetables',
  fruits: 'fruits',
  leafy_greens: 'leafy greens',
  root_crops: 'root crops',
  grains: 'grains',
  other: 'other produce',
};

export function normalizeCropKey(name: string | null | undefined): string {
  const cleaned = (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';
  if (cleaned.endsWith('ies') && cleaned.length > 4) {
    return `${cleaned.slice(0, -3)}y`;
  }
  if (/(o|ch|sh|x|z)es$/.test(cleaned) && cleaned.length > 4) {
    return cleaned.slice(0, -2);
  }
  if (cleaned.endsWith('s') && !cleaned.endsWith('ss') && cleaned.length > 3) {
    return cleaned.slice(0, -1);
  }
  return cleaned;
}

export function matchesSearchQuery(
  item: {
    cropName: string;
    farmName: string;
    district: string;
    gradeName: string;
    category: string;
    availabilityStatus: 'available_now' | 'planned';
  },
  rawQuery: string
): boolean {
  const tokens = rawQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const cropLower = item.cropName.toLowerCase();
  const cropNorm = normalizeCropKey(item.cropName);
  const farmLower = item.farmName.toLowerCase();
  const districtLower = item.district.toLowerCase();
  const gradeLower = item.gradeName.toLowerCase();
  const catLabel = CATEGORY_LABELS[item.category] || '';
  const availLabel =
    item.availabilityStatus === 'available_now'
      ? 'available now ready harvested'
      : 'planned upcoming expected';

  return tokens.every((token) => {
    const tokenNorm = normalizeCropKey(token);
    return (
      cropLower.includes(token) ||
      (tokenNorm.length >= 2 && cropNorm.includes(tokenNorm)) ||
      farmLower.includes(token) ||
      districtLower.includes(token) ||
      gradeLower.includes(token) ||
      catLabel.includes(token) ||
      availLabel.includes(token)
    );
  });
}
