export default function SeveritySlider({ value, onChange, label = 'Severity right now', hint }) {
  const ticks = Array.from({ length: 10 }, (_, i) => {
    const on = i < value;
    const tone = value >= 8 ? 'hot' : value >= 5 ? 'mid' : '';
    return <i key={i} className={on ? `on ${tone}`.trim() : undefined} />;
  });

  return (
    <div className="slider">
      <div className="slider__head">
        <label htmlFor="severity">{label}</label>
        <span className="slider__value">
          {value}
          <span className="tiny"> / 10</span>
        </span>
      </div>
      <input
        id="severity"
        type="range"
        min="1"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={hint ? 'severity-hint' : undefined}
      />
      <div className="ticks" aria-hidden="true">{ticks}</div>
      {hint && <p className="tiny" id="severity-hint">{hint}</p>}
    </div>
  );
}
