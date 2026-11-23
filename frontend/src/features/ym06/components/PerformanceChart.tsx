export type ChartPoint = { label: string; value: number };

export default function PerformanceChart({ points, label, valueLabel = 'kg' }: { points: ChartPoint[]; label: string; valueLabel?: string }) {
  const width = 680;
  const height = 220;
  const left = 48;
  const right = 18;
  const top = 18;
  const bottom = 34;
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const coords = points.map((point, index) => ({
    x: points.length <= 1 ? left + usableWidth / 2 : left + (index / (points.length - 1)) * usableWidth,
    y: top + usableHeight - (point.value / maxValue) * usableHeight,
    ...point,
  }));
  const line = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = coords.length ? `${line} L ${coords.at(-1)?.x} ${top + usableHeight} L ${coords[0].x} ${top + usableHeight} Z` : '';
  const ticks = [0, 1, 2, 3];
  return <div className="ym06-chart-wrap">
    <svg className="ym06-performance-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}; ${points.length} data points, measured in ${valueLabel}`}>
      <defs><linearGradient id="ym06-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--ym06-green)" stopOpacity=".2"/><stop offset="100%" stopColor="var(--ym06-green)" stopOpacity="0"/></linearGradient></defs>
      {ticks.map((tick) => { const y = top + (tick / 3) * usableHeight; return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} className="ym06-chart-gridline"/><text x={left - 8} y={y + 4} textAnchor="end" className="ym06-chart-axis">{Math.round(maxValue * (1 - tick / 3)).toLocaleString()}</text></g>; })}
      {coords.length > 1 && <path d={area} fill="url(#ym06-area-fill)"/>}
      {coords.length > 1 && <path d={line} fill="none" className="ym06-chart-line"/>}
      {coords.map((point) => <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="3.5" className="ym06-chart-point"><title>{point.label}: {point.value.toLocaleString()} {valueLabel}</title></circle>)}
      {coords.filter((_, index) => index === 0 || index === coords.length - 1 || index === Math.floor(coords.length / 2)).map((point) => <text key={`label-${point.x}`} x={point.x} y={height - 8} textAnchor="middle" className="ym06-chart-axis">{point.label}</text>)}
    </svg>
  </div>;
}
