import { useRef, useState } from 'react';
import { Card, Chip, Button, Alert } from '../components/Primitives.jsx';
import AccountCard from '../components/AccountCard.jsx';
import { usePreferences } from '../state/PreferencesContext.jsx';
import { useHealth } from '../state/HealthContext.jsx';
import { CONDITIONS, ALL_CONDITION_IDS } from '../data/conditions.js';
import { localDate } from '../lib/dates.js';

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
  const { profile, conditionIds, toggleCondition, updateProfile, exportData, importData, eraseEverything, persistence } = useHealth();
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null); // { tone, text }
  const [confirming, setConfirming] = useState(false);

  function download() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenhealth-${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.state) throw new Error('not an export');
      importData(parsed.state, { merge: true });
      setMessage({ tone: 'sage', text: 'Imported and merged with what is already here.' });
    } catch {
      setMessage({ tone: 'crimson', text: 'That file is not a ZenHealth export.' });
    }
  }

  async function erase() {
    const { remoteOk } = await eraseEverything();
    setConfirming(false);
    setMessage(
      remoteOk
        ? { tone: 'sage', text: 'Everything has been erased.' }
        : { tone: 'crimson', text: 'Erased on this device, but your account copy could not be reached. Try again when you are online, or it will sync back.' },
    );
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>Profile &amp; display</h1>
        <p className="lead">
          Conditions here drive every recommendation elsewhere. Turning one off changes the nutrition verdicts, check-ups and reading list immediately.
        </p>
      </header>

      <section className="section">
        <div className="grid grid--2">
          <Card title="About you" kanji="記録">
            <div className="stack-4">
              <div className="field">
                <label htmlFor="s-name">Name</label>
                <input id="s-name" type="text" value={profile.name} maxLength={80} onChange={(e) => updateProfile({ name: e.target.value })} />
              </div>
              <div className="formrow">
                <div className="field">
                  <label htmlFor="s-age">Age</label>
                  <input id="s-age" type="number" min="1" max="120" value={profile.age ?? ''} onChange={(e) => updateProfile({ age: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label htmlFor="s-city">City</label>
                  <input id="s-city" type="text" value={profile.city} maxLength={80} onChange={(e) => updateProfile({ city: e.target.value })} />
                </div>
              </div>
              <span className="small">Conditions you manage</span>
              <ul className="chips">
                {ALL_CONDITION_IDS.map((id) => (
                  <Chip key={id} pressed={conditionIds.includes(id)} onClick={() => toggleCondition(id)}>{CONDITIONS[id].label}</Chip>
                ))}
              </ul>
              <div className="formrow">
                <div className="field">
                  <label htmlFor="s-sodium">Daily sodium target (mg)</label>
                  <input id="s-sodium" type="number" min="0" step="50" value={profile.targets.sodiumMg} onChange={(e) => updateProfile({ targets: { sodiumMg: Number(e.target.value) || 0 } })} />
                </div>
                <div className="field">
                  <label htmlFor="s-kcal">Daily calorie target</label>
                  <input id="s-kcal" type="number" min="0" step="50" value={profile.targets.kcal} onChange={(e) => updateProfile({ targets: { kcal: Number(e.target.value) || 0 } })} />
                </div>
              </div>
              <p className="tiny">Changes save as you type.</p>
            </div>
          </Card>

          <Card title="Display" subtitle="Applies everywhere and survives a reload.">
            <div className="stack-6">
              <div className="stack-3">
                <span className="small">Text size</span>
                <div className="segmented" role="group" aria-label="Text size">
                  {TEXT_SIZES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={prefs.textScale === t.id} onClick={() => set({ textScale: t.id })}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div className="stack-3">
                <span className="small">Paper</span>
                <div className="segmented" role="group" aria-label="Theme">
                  {THEMES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={prefs.theme === t.id} onClick={() => set({ theme: t.id })}>{t.label}</button>
                  ))}
                </div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={prefs.contrast === 'high'} onChange={(e) => set({ contrast: e.target.checked ? 'high' : 'normal' })} />
                <span className="rail" />
                <span>High contrast</span>
              </label>
              <label className="switch">
                <input type="checkbox" checked={prefs.motion === 'reduced'} onChange={(e) => set({ motion: e.target.checked ? 'reduced' : 'full' })} />
                <span className="rail" />
                <span>Reduce motion</span>
              </label>
              <Button variant="ghost" onClick={reset}>Reset display settings</Button>
            </div>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Your data</h2></div>
        <div className="stack-6">
          <Alert tone="sage" icon="info" title="Where your data lives">
            <p>
              Everything you enter is saved in this browser as you go.
              {persistence.signedIn
                ? ' You are signed in, so it is also kept on your account and follows you between devices.'
                : ' If sign-in is set up for this app you can also keep it on an account. Symptom checks, meal photos and chat messages are sent to your own backend to be processed; the NVIDIA key never reaches the browser.'}
            </p>
          </Alert>

          <AccountCard />

          {message && <Alert tone={message.tone} icon={message.tone === 'crimson' ? 'alert' : 'check'}>{message.text}</Alert>}

          <Card tone="flat" title="Export and import" subtitle="A JSON file of everything above. Import merges it into what is here.">
            <div className="row">
              <Button onClick={download}>Export my data</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>Import a file</Button>
            </div>
          </Card>

          <Card tone="flat" title="Erase everything" subtitle="Deletes your profile, log, meals, readings, symptom checks, medicines and contacts here and, if signed in, on your account.">
            {confirming ? (
              <div className="row">
                <Button variant="alarm" onClick={erase}>Yes, erase it all</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Keep my data</Button>
              </div>
            ) : (
              <Button variant="alarm" onClick={() => setConfirming(true)}>Erase my data</Button>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
