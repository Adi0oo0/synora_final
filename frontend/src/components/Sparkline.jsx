/** Tiny trend line with an optional highlighted window. */
export default function Sparkline({ points = [], highlight, height = 72, color = 'var(--sage-deep)' }) {
  if (!points.length) return null;
  const width = 320;
  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (points.length - 1 || 1);
  const y = (v) => height - 8 - ((v - min) / span) * (height - 18);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, color }} aria-hidden="true">
      <path d={`M0 ${y(mean)}H${width}`} stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.35" />
      {highlight && (
        <rect
          x={highlight.startIndex * stepX}
          y="0"
          width={Math.max(6, (highlight.endIndex - highlight.startIndex) * stepX)}
          height={height}
          fill="var(--sand)"
          opacity="0.18"
        />
      )}
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {highlight && (
        <circle cx={highlight.endIndex * stepX} cy={y(highlight.peakValue)} r="4.5" fill="var(--crimson)" />
      )}
    </svg>
  );
}
