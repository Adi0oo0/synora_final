import { Card, Chip, Button, Alert } from '../components/Primitives.jsx';
import { usePreferences } from '../state/PreferencesContext.jsx';
import { useHealth } from '../state/HealthContext.jsx';
import { CONDITIONS, ALL_CONDITION_IDS, PROFILE } from '../data/profile.js';

const TEXT_SIZES = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
];

const THEMES = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light paper' },
  { id: 'dark', label: 'Dark paper' },
];

export default function Settings() {
  const { prefs, set, reset } = usePreferences();
  const { conditionIds, toggleCondition, resetSession } = useHealth();

  return (
    <div className="page">
      <header className="page__head">
        <h1>Profile &amp; display</h1>
        <p className="lead">
          Conditions here drive every recommendation elsewhere. Turning one off changes the nutrition
          verdicts and the reading list immediately.
        </p>
      </header>

      <section className="section">
        <div className="grid grid--2">
          <Card title="Active conditions" kanji="記録" subtitle={`${PROFILE.name}, ${PROFILE.age}, ${PROFILE.city}. Logging since ${PROFILE.loggingSince}.`}>
            <ul className="chips">
              {ALL_CONDITION_IDS.map((id) => (
                <Chip key={id} pressed={conditionIds.includes(id)} onClick={() => toggleCondition(id)}>
                  {CONDITIONS[id].label}
                </Chip>
              ))}
            </ul>
            <p className="tiny">
              Stored in this browser only. Wire to your record service when there is one.
            </p>
          </Card>

          <Card title="Display" subtitle="Applies everywhere and survives a reload.">
            <div className="stack-6">
              <div className="stack-3">
                <span className="small">Text size</span>
                <div className="segmented" role="group" aria-label="Text size">
                  {TEXT_SIZES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={prefs.textScale === t.id} onClick={() => set({ textScale: t.id })}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stack-3">
                <span className="small">Paper</span>
                <div className="segmented" role="group" aria-label="Theme">
                  {THEMES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={prefs.theme === t.id} onClick={() => set({ theme: t.id })}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={prefs.contrast === 'high'}
                  onChange={(e) => set({ contrast: e.target.checked ? 'high' : 'normal' })}
                />
                <span className="rail" />
                <span>High contrast</span>
              </label>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={prefs.motion === 'reduced'}
                  onChange={(e) => set({ motion: e.target.checked ? 'reduced' : 'full' })}
                />
                <span className="rail" />
                <span>Reduce motion</span>
              </label>

              <Button variant="ghost" onClick={reset}>Reset display settings</Button>
            </div>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Data &amp; safety</h2>
        </div>
        <Alert tone="sage" icon="info" title="Where your data goes">
          <p>
            Logs, meals and preferences stay in this browser. Model calls go to your own backend, which
            holds the NVIDIA key — the browser never sees it. Nothing is sent anywhere until you use a
            feature that needs it.
          </p>
        </Alert>
        <Card tone="flat" title="Start over" subtitle="Clears today's log, meals and the last triage result from this browser.">
          <Button variant="alarm" onClick={resetSession}>Clear session data</Button>
        </Card>
      </section>
    </div>
  );
}
