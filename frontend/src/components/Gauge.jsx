import { BANDS } from '../lib/triage.js';

/** Semicircular urgency dial. Needle sweeps -78deg to +78deg across 0–100. */
export default function Gauge({ score = 0, band = 'low', note }) {
  const rotation = -78 + Math.max(0, Math.min(100, score)) * 1.56;
  const arc = 'M20 100A80 80 0 0 1 180 100';

  return (
    <div className="gauge">
      <svg className="gauge__svg" viewBox="0 0 200 128" aria-hidden="true">
        <path d={arc} stroke="var(--sage)" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray="72 300" strokeDashoffset="0" />
        <path d={arc} stroke="var(--sand)" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray="72 300" strokeDashoffset="-84" />
        <path d={arc} stroke="var(--crimson)" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray="72 300" strokeDashoffset="-168" />
        <g className="gauge__needle" style={{ rotate: `${rotation}deg` }}>
          <path d="M100 100V38" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="100" r="7" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.6" />
        </g>
      </svg>
      <div className="gauge__scale" aria-hidden="true">
        <span>Low</span>
        <span>Moderate</span>
        <span>Immediate</span>
      </div>
      <p className="gauge__verdict" data-band={band} role="status">
        {BANDS[band].label}
      </p>
      {note && <p className="small" style={{ textAlign: 'center' }}>{note}</p>}
    </div>
  );
}
