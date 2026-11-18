export function formatLkr(amount: number): string {
  return `LKR ${Math.round(amount).toLocaleString('en-US')}`;
}
