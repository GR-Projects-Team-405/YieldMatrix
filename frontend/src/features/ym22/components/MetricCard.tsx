import type { ReactNode } from 'react';
export default function MetricCard({ label, value, detail, icon }: { label:string; value:string; detail:string; icon:ReactNode }) {
  return <section className="ym22-metric"><div className="ym22-metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></section>;
}
