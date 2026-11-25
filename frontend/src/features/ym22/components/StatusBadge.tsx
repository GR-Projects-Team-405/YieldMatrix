export default function StatusBadge({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <span className={`ym22-status ym22-status--${status}`}>{label}</span>;
}
