import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Card, Button, Chip, Alert, SafetyStrip, Finding } from '../components/Primitives.jsx';
import BodyDiagram from '../components/BodyDiagram.jsx';
import Gauge from '../components/Gauge.jsx';
import Icon from '../components/Icon.jsx';
import { REGIONS, TRIGGERS, DURATIONS } from '../data/regions.js';
import { scoreTriage, considerationsFor, nextStepFor } from '../lib/triage.js';
import { explainTriage } from '../lib/api.js';
import { useHealth } from '../state/HealthContext.jsx';

export default function Triage() {
  const { setTriage, triage, conditionIds } = useHealth();
  const { openEmergency } = useOutletContext();

  const [region, setRegion] = useState('chest');
  const [symptoms, setSymptoms] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [severity, setSeverity] = useState(4);
  const [duration, setDuration] = useState('days');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState(triage ?? null);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [citations, setCitations] = useState([]);

  const input = useMemo(
    () => ({ region, symptoms, triggers, severity, duration }),
    [region, symptoms, triggers, severity, duration],
  );

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function pickRegion(next) {
    setRegion(next);
    setSymptoms([]);
    setResult(null);
    setExplanation(null);
  }

  async function run() {
    if (!symptoms.length) return;
    const scored = scoreTriage(input);
    const findings = considerationsFor(input, scored);
    const payload = { ...scored, findings, input, at: new Date().toISOString() };
    setResult(payload);
    setTriage(payload);
    setExplanation(null);
    setCitations([]);

    if (scored.band === 'immediate') return; // no model round-trip in front of an emergency

    setExplaining(true);
    const res = await explainTriage({
      region,
      symptoms,
      triggers,
      severity,
      duration,
      notes: notes.slice(0, 500),
      conditionIds,
    });
    setExplaining(false);
    if (res.ok && res.summary) setExplanation(res.summary);
    if (res.ok && res.citations?.length) setCitations(res.citations);
  }

  const step = result ? nextStepFor(result.band) : null;
  const catalogue = REGIONS[region].symptoms;

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
              {Object.values(REGIONS).map((r) => (
                <Chip key={r.id} pressed={region === r.id} onClick={() => pickRegion(r.id)}>
                  {r.label}
                </Chip>
              ))}
            </ul>
          </Card>

          <Card title={`What does the ${REGIONS[region].label.toLowerCase()} feel like?`} kanji="症状">
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

              <div className="grid grid--2" style={{ gap: 'var(--space-5)' }}>
                <div className="field">
                  <label htmlFor="duration">How long has it been going on?</label>
                  <select id="duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
                    {DURATIONS.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="worst">Severity at its worst</label>
                  <select id="worst" value={severity} onChange={(e) => setSeverity(Number(e.target.value))}>
                    <option value={2}>2 — mild</option>
                    <option value={4}>4 — noticeable</option>
                    <option value={6}>6 — interferes with the day</option>
                    <option value={8}>8 — hard to ignore</option>
                    <option value={10}>10 — worst I have felt</option>
                  </select>
                </div>
              </div>

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
              </div>

              <div className="row">
                <Button variant="solid" size="lg" onClick={run} disabled={!symptoms.length}>
                  Check my symptoms
                </Button>
                <Button variant="ghost" onClick={() => { setSymptoms([]); setTriggers([]); setResult(null); setExplanation(null); }}>
                  Start over
                </Button>
                <Button variant="alarm" icon="alert" onClick={openEmergency}>
                  Emergency screen
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {result && (
        <section className="section">
          <div className="section__head">
            <h2>What the check found</h2>
            <span className="tiny">
              Score {result.score}/100 · symptoms {result.breakdown.symptomScore} · triggers{' '}
              {result.breakdown.triggerScore} · severity {result.breakdown.severityScore} · duration{' '}
              {result.breakdown.durationScore}
            </span>
          </div>

          <div className="grid grid--aside">
            <Card tone="flat" title="Urgency">
              <Gauge score={result.score} band={result.band} />
              {result.band !== 'low' && (
                <Link className="btn btn--wide btn--solid" to="/care">
                  <Icon name="steth" size={18} /> Go to the care team
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
                {explaining && <p className="tiny">Writing a plain-language summary…</p>}
                {explanation && (
                  <Alert tone="sage" icon="info" title="In plain language">
                    <p>{explanation}</p>
                    {citations.length > 0 && (
                      <ul className="chips" style={{ marginTop: 'var(--space-3)' }}>
                        {citations.map((c) => (
                          <Chip key={c.id}>{c.title}</Chip>
                        ))}
                      </ul>
                    )}
                  </Alert>
                )}
              </Card>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
