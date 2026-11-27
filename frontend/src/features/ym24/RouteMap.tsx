interface RouteStop {
  name: string;
  detail: string;
  kind: 'pickup' | 'handover';
}

const WIDTH = 900;
const HEIGHT = 200;
const BEND = 52; // how strongly each leg curves up (arch) or down (dip)

export default function RouteMap({ stops }: { stops: RouteStop[] }) {
  const n = stops.length;

  // Stops are spread evenly along the line. The handover (last stop) sits a little higher.
  const pts = stops.map((_, i) => ({
    x: n === 1 ? WIDTH / 2 : 110 + (i * (WIDTH - 220)) / (n - 1),
    y: n > 1 && i === n - 1 ? 100 : 120,
  }));

  // Each leg is a smooth curve. Legs alternate: arch (bulges up), dip (bulges down), arch ...
  let d = '';
  pts.forEach((p, i) => {
    if (i === 0) {
      d = 'M' + p.x + ' ' + p.y;
    } else {
      const prev = pts[i - 1];
      const dx = p.x - prev.x;
      const dir = (i - 1) % 2 === 0 ? -1 : 1;
      d += ' C' + (prev.x + dx * 0.35) + ' ' + (prev.y + dir * BEND) + ', ' + (p.x - dx * 0.35) + ' ' + (p.y + dir * BEND) + ', ' + p.x + ' ' + p.y;
    }
  });

  // Text gets a thin outline in the card colour so the dashed line never cuts through letters.
  const halo = { stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const };
  const label = 'Route: ' + stops.map((s) => s.name).join(', then ');

  return (
    <svg viewBox={'0 0 ' + WIDTH + ' ' + HEIGHT} role="img" aria-label={label}>
      {n > 1 && <path d={d} fill="none" stroke="var(--control-border)" strokeWidth="1.5" strokeDasharray="4 4" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="9" fill={stops[i].kind === 'handover' ? 'var(--orange)' : 'var(--ym24-primary)'} />
          {stops[i].kind === 'handover' && (
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">✓</text>
          )}
          <text className="ym24-route-text" x={p.x} y={p.y + 30} textAnchor="middle" style={halo}>{stops[i].name}</text>
          <text className="ym24-route-sub" x={p.x} y={p.y + 46} textAnchor="middle" style={halo}>{stops[i].detail}</text>
        </g>
      ))}
    </svg>
  );
}