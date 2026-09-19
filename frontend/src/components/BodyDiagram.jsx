import { REGIONS, REGION_IDS } from '../data/regions.js';

export default function BodyDiagram({ region, onSelect }) {
  return (
    <div className="figure">
      <svg
        className="figure__svg"
        viewBox="0 0 200 270"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="100" cy="30" r="17" />
        <path d="M100 47v12" />
        <path d="M100 59c-14 0-26 4-30 9-3 4-4 12-5 22-1 8-4 18-7 26" />
        <path d="M100 59c14 0 26 4 30 9 3 4 4 12 5 22 1 8 4 18 7 26" />
        <path d="M65 68c-6 3-10 9-12 17-2 7-5 16-8 22" />
        <path d="M135 68c6 3 10 9 12 17 2 7 5 16 8 22" />
        <path d="M45 107c-2 6-3 12-2 16" />
        <path d="M155 107c2 6 3 12 2 16" />
        <path d="M70 128c-1 12-2 22-1 30 1 12 3 26 4 38" />
        <path d="M130 128c1 12 2 22 1 30-1 12-3 26-4 38" />
        <path d="M70 128h60" />
        <path d="M73 196c-1 14-2 28-2 40 0 8 1 16 2 22" />
        <path d="M100 158v38" />
        <path d="M127 196c1 14 2 28 2 40 0 8-1 16-2 22" />
        <path d="M73 196h54" />
        <path d="M64 258h16" />
        <path d="M120 258h16" />
      </svg>

      {REGION_IDS.map((id) => {
        const r = REGIONS[id];
        return (
          <span key={id}>
            <button
              type="button"
              className="node"
              style={{ left: `${r.node.x}%`, top: `${r.node.y}%` }}
              aria-pressed={region === id}
              aria-label={`Select ${r.label.toLowerCase()}`}
              onClick={() => onSelect(id)}
            />
            <span className="node__label" style={{ left: `${r.labelPos.x}%`, top: `${r.labelPos.y}%` }}>
              {r.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
