const FACES = {
  Bright: (<><circle cx="12" cy="12" r="9" /><path d="M8.5 14c1 1.5 5 1.5 6 0" /><path d="M8.6 9.2h.01" /><path d="M15.4 9.2h.01" /><path d="M7 7l1.6 1.6" /><path d="m17 7-1.6 1.6" /></>),
  Steady: (<><circle cx="12" cy="12" r="9" /><path d="M8.6 14.2c1 1 4.8 1 5.8 0" /><path d="M8.6 9.4h.01" /><path d="M15.4 9.4h.01" /></>),
  Flat: (<><circle cx="12" cy="12" r="9" /><path d="M8.8 14.6h6.4" /><path d="M8.6 9.4h.01" /><path d="M15.4 9.4h.01" /></>),
  Low: (<><circle cx="12" cy="12" r="9" /><path d="M8.6 15.4c1-1.4 4.8-1.4 5.8 0" /><path d="M8.6 9.4h.01" /><path d="M15.4 9.4h.01" /></>),
  Rough: (<><circle cx="12" cy="12" r="9" /><path d="M8.4 16c1.2-2 5-2 6.2 0" /><path d="m7.6 8.8 2.2 1.2" /><path d="m16.4 8.8-2.2 1.2" /></>),
};

export default function MoodPicker({ value, onChange }) {
  return (
    <div className="moods" role="radiogroup" aria-label="How today feels">
      {Object.keys(FACES).map((mood) => (
        <button
          key={mood}
          type="button"
          role="radio"
          aria-checked={value === mood}
          className="mood"
          onClick={() => onChange(mood)}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            {FACES[mood]}
          </svg>
          {mood}
        </button>
      ))}
    </div>
  );
}
