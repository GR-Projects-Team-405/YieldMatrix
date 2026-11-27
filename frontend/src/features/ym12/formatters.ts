const colomboDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function getDateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid date: ${value}`);

  const parts = colomboDateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return { day: part('day'), month: part('month'), year: part('year') };
}

export function formatKg(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new TypeError(`Invalid kilogram value: ${value}`);

  const [, sign, whole, fraction = ''] = match;
  const formattedWhole = BigInt(whole).toLocaleString('en-US');
  const formattedFraction = fraction.replace(/0+$/, '');
  return `${sign}${formattedWhole}${formattedFraction ? `.${formattedFraction}` : ''} kg`;
}

export function formatLkr(centsValue: string) {
  if (!/^-?\d+$/.test(centsValue)) throw new TypeError(`Invalid LKR cents value: ${centsValue}`);

  const cents = BigInt(centsValue);
  const sign = cents < 0n ? '-' : '';
  const absoluteCents = cents < 0n ? -cents : cents;
  const whole = (absoluteCents / 100n).toLocaleString('en-US');
  const fraction = String(absoluteCents % 100n).padStart(2, '0');
  return `${sign}${whole}${fraction === '00' ? '' : `.${fraction}`}`;
}

export function formatDateRange(startValue: string, endValue: string) {
  const start = getDateParts(startValue);
  const end = getDateParts(endValue);

  if (start.day === end.day && start.month === end.month && start.year === end.year) {
    return `${start.day} ${start.month} ${start.year}`;
  }
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}-${end.day} ${end.month} ${end.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${start.month} - ${end.day} ${end.month} ${end.year}`;
  }
  return `${start.day} ${start.month} ${start.year} - ${end.day} ${end.month} ${end.year}`;
}

export function formatUpdatedLabel(value: string) {
  const updated = getDateParts(value);
  const today = getDateParts(new Date().toISOString());
  if (updated.day === today.day && updated.month === today.month && updated.year === today.year) {
    return 'Updated today';
  }
  return `Updated ${updated.day} ${updated.month} ${updated.year}`;
}
