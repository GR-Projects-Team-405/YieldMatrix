interface RouteStop {
  name: string;
  detail: string;
  kind: 'pickup' | 'handover';
}

export default function RouteMap({ stops }: { stops: RouteStop[] }) {
  const n = stops.length;
  const pts = stops.map((_, i) => ({
    x: n === 1 ? 450 : 72 + (i * 702) / (n - 1),
    y: n === 1 ? 90 : i === 0 ? 95 : i === n - 1 ? 62 : 100,
  }));

  // Wave: alternate an arch and a dip between stops, like a real road.
  const d = pts.reduce((path, p, i) => {
    if (i === 0) return `M${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const dx = p.x - prev.x;
    const bend = i % 2 === 1 ? -55 : 55;
    return `${path} C${prev.x + dx * 0.33} ${prev.y + bend} ${p.x - dx * 0.33} ${p.y + bend} ${p.x} ${p.y}`;
  }, '');

  return (
    <svg viewBox="0 40 900 115" role="img" aria-label={`Route: ${stops.map((s) => s.name).join(', then ')}`}>
      <path d={d} fill="none" stroke="var(--control-border)" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
      {pts.map((p, i) => {
        const handover = stops[i].kind === 'handover';
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="9" fill={handover ? 'var(--orange)' : 'var(--ym24-primary)'} stroke="var(--surface)" strokeWidth="3" />
            {handover && (
              <path
                d="M-4 0 L-1.2 3 L4 -3"
                transform={`translate(${p.x} ${p.y})`}
                fill="none"
                stroke="#263a31"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <text className="ym24-route-text" x={p.x} y={p.y + 28} textAnchor="middle">{stops[i].name}</text>
            <text className="ym24-route-sub" x={p.x} y={p.y + 43} textAnchor="middle">{stops[i].detail}</text>
          </g>
        );
      })}
    </svg>
  );
}