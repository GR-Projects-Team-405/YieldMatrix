export function formatLkr(cents: number) {
  const value = (Number(cents) || 0) / 100;
  return `LKR ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatKg(kg: number) {
  return `${Number(kg || 0).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`;
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' });
}

export function splitCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return { hours, minutes, seconds: rest };
}

export function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function osmEmbed(lat?: number | null, lng?: number | null) {
  const latitude = lat ?? 6.9497;
  const longitude = lng ?? 80.7891;
  const delta = 0.08;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function osmExternalUrl(lat?: number | null, lng?: number | null) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return 'https://www.openstreetmap.org/';
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`;
}
