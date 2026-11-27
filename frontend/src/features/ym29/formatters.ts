// YM29 · Yasindu Janapriya · Unit & date formatters (kg, LKR per kg, Asia/Colombo dates, IF-04).

export function formatLkr(cents: number | null | undefined, withUnit = true): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '—';
  const lkr = cents / 100;
  const formatted = lkr.toLocaleString('en-LK', {
    minimumFractionDigits: Number.isInteger(lkr) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return withUnit ? `LKR ${formatted}` : formatted;
}

export function formatPriceRange(p25: number | null | undefined, p75: number | null | undefined): string {
  if (p25 === null || p25 === undefined || p75 === null || p75 === undefined) return '—';
  return `${formatLkr(p25)} – ${formatLkr(p75, false)}`;
}

export function formatKg(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 1),
  })} kg`;
}

export function formatVariance(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatColomboDate(iso: string | null | undefined, includeWeekday = false): string {
  if (!iso) return '—';
  const normalized = iso.length === 10 ? `${iso}T00:00:00+05:30` : iso;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: includeWeekday ? 'short' : undefined,
    day: '2-digit',
    month: 'short',
    year: includeWeekday ? undefined : 'numeric',
  }).format(dt);
}

export function formatColomboTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
}

export function formatColomboDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
}

export function extractApiError(error: unknown, fallback = 'Request could not be completed'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { error?: string } } }).response;
    if (resp?.data?.error) return resp.data.error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
