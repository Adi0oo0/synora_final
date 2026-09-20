import { useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Card, Button, Chip, Alert, SafetyStrip, Finding } from '../components/Primitives.jsx';
import BodyDiagram from '../components/BodyDiagram.jsx';
import Gauge from '../components/Gauge.jsx';
import Icon from '../components/Icon.jsx';
import SeveritySlider from '../components/SeveritySlider.jsx';
import { REGIONS, REGION_IDS, TRIGGERS, DURATIONS } from '../data/regions.js';
import { scoreTriage, considerationsFor, nextStepFor, mergeServerResult, BANDS } from '../lib/triage.js';
import { explainTriage } from '../lib/api.js';
import { dateTimeLabel } from '../lib/dates.js';
import { makeId } from '../lib/storage.js';
import { useHealth } from '../state/HealthContext.jsx';

const PILL = { low: 'ok', moderate: 'soon', immediate: 'late' };

export default function Triage() {
  const { triage: history, latestTriage, conditionIds, addTriage, updateTriage, removeTriage } = useHealth();
  const { openEmergency } = useOutletContext();
  const [params] = useSearchParams();

  const [region, setRegion] = useState('chest');
  const [symptoms, setSymptoms] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [severity, setSeverity] = useState(4);
  const [duration, setDuration] = useState('days');
  const [notes, setNotes] = useState((params.get('q') ?? '').slice(0, 500));
  const [activeId, setActiveId] = useState(latestTriage?.id ?? null);
  const [busyId, setBusyId] = useState(null);
  const [offline, setOffline] = useState(false);

  const result = useMemo(() => history.find((h) => h.id === activeId) ?? null, [history, activeId]);
  const catalogue = REGIONS[region].symptoms;
  const canRun = symptoms.length > 0 || notes.trim().length > 0;

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function pickRegion(next) {
    setRegion(next);
    setSymptoms([]);
    setActiveId(null);
  }

  function startOver() {
    setSymptoms([]);
    setTriggers([]);
    setNotes('');
    setSeverity(4);
    setDuration('days');
    setActiveId(null);
    setOffline(false);
  }

  async function run() {
    if (!canRun || busyId) return;
    const input = { region, symptoms, triggers, severity, duration, notes: notes.trim() };
    const scored = scoreTriage(input);
    const entry = {
      id: makeId('tri'),
      at: new Date().toISOString(),
      input,
      conditionIds: [...conditionIds],
      score: scored.score,
      band: scored.band,
      redFlag: scored.redFlag,
      reasons: scored.reasons,
      breakdown: scored.breakdown,
      findings: considerationsFor({ ...input, conditionIds }, scored),
      summary: null,
      citations: [],
      source: 'local',
    };
    addTriage(entry);
    setActiveId(entry.id);
    setOffline(false);

    // No model round-trip in front of an emergency.
    if (scored.band === 'immediate') return;

    setBusyId(entry.id);
    const res = await explainTriage({ ...input, conditionIds });
    setBusyId(null);
    if (res.ok) updateTriage(entry.id, mergeServerResult(entry, res));
    else setOffline(true);
  }

  const step = result ? nextStepFor(result.band) : null;
  const labelOf = (h) => {
    const list = REGIONS[h.input.region]?.symptoms ?? [];
    return h.input.symptoms.map((id) => list.find((s) => s.id === id)?.label ?? id);
  };

  return (
    <div className="page">
      <header className="page__head">
        <h1>Where does it hurt?</h1>
        <p className="lead">
          Pick a region, say what you feel, and the rule engine scores it. The score is decided by code
          you can read, not by a model guessing — the model only helps put it in plain language.
        </p>
        <SafetyStrip />
      </header>

      <section className="section">
        <div className="grid grid--aside">
          <Card title="Body map" kanji="体" subtitle="Tap a point, or use the buttons under the figure.">
            <BodyDiagram region={region} onSelect={pickRegion} />
            <ul className="chips">
              {REGION_IDS.map((id) => (
                <Chip key={id} pressed={region === id} onClick={() => pickRegion(id)}>
                  {REGIONS[id].label}
                </Chip>
              ))}
            </ul>
          </Card>

          <Card title={region === 'general' ? 'How does the rest of you feel?' : `What does the ${REGIONS[region].label.toLowerCase()} feel like?`} kanji="症状">
            <div className="card__body">
              <fieldset className="fieldset" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend>Pick everything that applies.</legend>
                <ul className="chips">
                  {catalogue.map((s) => (
                    <Chip
                      key={s.id}
                      variant={s.redFlag ? 'flag' : undefined}
                      pressed={symptoms.includes(s.id)}
                      onClick={() => toggle(symptoms, setSymptoms, s.id)}
                    >
                      {s.label}
                    </Chip>
                  ))}
                </ul>
              </fieldset>

              <div className="field">
                <label htmlFor="duration">How long has it been going on?</label>
                <select id="duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  {DURATIONS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>

              <SeveritySlider
                label="Severity at its worst"
                value={severity}
                onChange={setSeverity}
                hint="1 is barely noticeable. 10 is the worst you have felt."
              />

              <fieldset className="fieldset" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend>What seems to set it off?</legend>
                <ul className="chips">
                  {TRIGGERS.map((t) => (
                    <Chip
                      key={t.id}
                      pressed={triggers.includes(t.id)}
                      onClick={() => toggle(triggers, setTriggers, t.id)}
                    >
                      {t.label}
                    </Chip>
                  ))}
                </ul>
              </fieldset>

              <div className="field">
                <label htmlFor="notes">Anything else worth saying? (optional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  maxLength={500}
                  placeholder="It started after I carried shopping up the stairs…"
                  onChange={(e) => setNotes(e.target.value)}
                />
                <span className="tiny">What you write here is read for emergency wording too, so describe it plainly.</span>
              </div>

              <div className="row">
                <Button variant="solid" size="lg" onClick={run} disabled={!canRun || Boolean(busyId)}>
                  {busyId ? 'Checking…' : 'Check my symptoms'}
                </Button>
                <Button variant="ghost" onClick={startOver}>Start over</Button>
                <Button variant="alarm" icon="alert" onClick={openEmergency}>
                  Emergency screen
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {result && (
        <section className="section" id="triage-result" aria-live="polite">
          <div className="section__head">
            <h2>What the check found</h2>
            <span className="tiny">
              {dateTimeLabel(result.at)} · score {result.score}/100 · symptoms {result.breakdown.symptomScore} · triggers{' '}
              {result.breakdown.triggerScore} · severity {result.breakdown.severityScore} · duration{' '}
              {result.breakdown.durationScore}
            </span>
          </div>

          <div className="grid grid--aside">
            <Card tone="flat" title="Urgency">
              <Gauge score={result.score} band={result.band} />
              {result.band !== 'low' && (
                <Link className="btn btn--wide btn--solid" to="/care">
                  <Icon name="steth" size={18} /> Prepare a summary for a clinician
                </Link>
              )}
            </Card>

            <div className="stack-6">
              <Alert tone={step.tone} icon={result.band === 'immediate' ? 'alert' : 'check'} title={step.title}>
                {step.body}
              </Alert>

              <Card tone="flat" title="Patterns worth raising" subtitle="Discussion points for a clinician. Not a diagnosis, and not a list of conditions you have.">
                <ul className="findings">
                  {result.findings.map((f, i) => (
                    <Finding key={i} warn={f.warn}>{f.text}</Finding>
                  ))}
                </ul>
                {busyId === result.id && <p className="tiny">Writing a plain-language summary…</p>}
                {result.summary && (
                  <Alert tone={result.band === 'immediate' ? 'crimson' : 'sage'} icon="info" title="In plain language">
                    <p>{result.summary}</p>
                    {result.citations?.length > 0 && (
                      <ul className="chips" style={{ marginTop: 'var(--space-3)' }}>
                        {result.citations.map((c) => (
                          <Chip key={c.id}>{c.title}</Chip>
                        ))}
                      </ul>
                    )}
                  </Alert>
                )}
                {offline && activeId === result.id && (
                  <p className="tiny">
                    The server could not be reached, so this is the on-device result. The urgency rules run in your browser too, so the band is unaffected — only the written summary is missing.
                  </p>
                )}
              </Card>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Your earlier checks</h2>
          <span className="tiny">{history.length ? `${history.length} saved` : ''}</span>
        </div>
        {history.length === 0 ? (
          <div className="empty">
            <p>No symptom checks yet. Each one you run is saved here, so you can see how things change and hand the latest to a clinician.</p>
          </div>
        ) : (
          <Card tone="flat">
            <ul className="rows">
              {[...history].reverse().slice(0, 12).map((h) => (
                <li key={h.id}>
                  <div>
                    <b className="serif" style={{ fontSize: 'var(--text-md)' }}>
                      {REGIONS[h.input.region]?.label ?? h.input.region}: {labelOf(h).join(', ') || 'described in notes'}
                    </b>
                    <div className="tiny">{dateTimeLabel(h.at)} · severity {h.input.severity}/10</div>
                  </div>
                  <div className="row-tight">
                    <span className={`pill pill--${PILL[h.band]}`}>{BANDS[h.band].label.split(' — ')[0]}</span>
                    <Button variant="ghost" onClick={() => { setActiveId(h.id); setTimeout(() => document.getElementById('triage-result')?.scrollIntoView({ behavior: 'smooth' }), 0); }}>View</Button>
                    <Button variant="ghost" onClick={() => { removeTriage(h.id); if (activeId === h.id) setActiveId(null); }} aria-label={`Delete the check from ${dateTimeLabel(h.at)}`}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
