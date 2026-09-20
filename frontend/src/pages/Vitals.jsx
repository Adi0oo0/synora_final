import { useMemo, useState } from 'react';
import { Card, Stat, Alert, Button } from '../components/Primitives.jsx';
import Sparkline from '../components/Sparkline.jsx';
import Icon from '../components/Icon.jsx';
import { METRICS, METRIC_IDS, DETECTOR_DEFAULTS } from '../data/metrics.js';
import { describeAnomaly } from '../lib/anomaly.js';
import { findAnomalies, seriesFor } from '../lib/insights.js';
import { dateTimeLabel, fromInputDateTime, toInputDateTime } from '../lib/dates.js';
import { useHealth } from '../state/HealthContext.jsx';

const TONE = { warn: 'crimson', caution: 'sand', info: 'sage' };

function validate(metric, value, value2) {
  const m = METRICS[metric];
  const v = Number(value);
  if (value === '' || !Number.isFinite(v)) return 'Enter a number.';
  if (v < m.min || v > m.max) return `${m.label} is usually between ${m.min} and ${m.max} ${m.unit}. Check for a typo.`;
  if (m.dual) {
    const d = Number(value2);
    if (value2 === '' || !Number.isFinite(d)) return 'Enter both numbers, systolic then diastolic.';
    if (d < m.min || d > m.max) return `The second number should be between ${m.min} and ${m.max}.`;
    if (d > v) return 'The first number (systolic) should be the larger one.';
  }
  return null;
}

export default function Vitals() {
  const { state, vitals, addVital, removeVital, setDetector, resetDetector, acknowledgeAnomaly } = useHealth();
  const settings = state.settings.detector;

  const [metric, setMetric] = useState('bp');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [at, setAt] = useState(() => toInputDateTime());
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  const m = METRICS[metric];
  const streams = useMemo(() => METRIC_IDS.map((id) => ({ metric: METRICS[id], points: seriesFor(vitals, id) })).filter((s) => s.points.length), [vitals]);
  const flagged = useMemo(() => findAnomalies(vitals, settings), [vitals, settings]);
  const open = flagged.filter((f) => !state.acknowledged.includes(f.key));
  const need = settings.window + settings.minRun;
  const recent = useMemo(() => [...vitals].reverse().slice(0, 15), [vitals]);

  function submit(e) {
    e.preventDefault();
    const problem = validate(metric, value, value2);
    setError(problem);
    if (problem) return;
    addVital({ metric, value, value2: m.dual ? value2 : null, at: fromInputDateTime(at), note: note.trim().slice(0, 200) });
    setValue('');
    setValue2('');
    setNote('');
    setAt(toInputDateTime());
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>Vitals &amp; anomalies</h1>
        <p className="lead">
          Log readings when you take them — from a home cuff, a glucose meter, a watch or a lab report. Once there is enough history,
          a rolling z-score compares each new reading with your own recent baseline. No model sits in this path; the rule is
          arithmetic you can read in <code>src/lib/anomaly.js</code>.
        </p>
      </header>

      <section className="section">
        <Card title="Add a reading" kanji="記録">
          <form className="stack-4" onSubmit={submit} noValidate>
            <div className="formrow">
              <div className="field">
                <label htmlFor="v-metric">What did you measure?</label>
                <select id="v-metric" value={metric} onChange={(e) => { setMetric(e.target.value); setValue(''); setValue2(''); setError(null); }}>
                  {METRIC_IDS.map((id) => (
                    <option key={id} value={id}>{METRICS[id].label} ({METRICS[id].unit})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="v-value">{m.dual ? 'Systolic (top number)' : `Value (${m.unit})`}</label>
                <input id="v-value" type="number" inputMode="decimal" step={m.step} value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              {m.dual && (
                <div className="field">
                  <label htmlFor="v-value2">Diastolic (bottom number)</label>
                  <input id="v-value2" type="number" inputMode="decimal" step={m.step} value={value2} onChange={(e) => setValue2(e.target.value)} />
                </div>
              )}
              <div className="field">
                <label htmlFor="v-at">When</label>
                <input id="v-at" type="datetime-local" value={at} max={toInputDateTime()} onChange={(e) => setAt(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="v-note">Note (optional)</label>
              <input id="v-note" type="text" maxLength={200} placeholder="After a walk, fasting, on the left arm…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <Alert tone="crimson" icon="alert">{error}</Alert>}
            <div className="row">
              <Button type="submit" variant="solid" icon="plus">Save reading</Button>
              {m.hint && <span className="tiny">{m.hint}</span>}
            </div>
          </form>
        </Card>
      </section>

      {vitals.length === 0 ? (
        <section className="section">
          <div className="empty">
            <p>No readings yet. Add your first one above. The trend lines and the unusual-window detector appear as your history builds — the detector needs at least {need} readings of the same kind to have a baseline to compare against.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="grid grid--4">
              <Stat value={vitals.length} label="Readings logged" note={`${streams.length} kind${streams.length === 1 ? '' : 's'}`} />
              <Stat value={open.length} label="Windows flagged" note={`z ≥ ${settings.threshold}`} tone={open.length ? 'sand' : 'sage'} />
              <Stat value={settings.window} label="Baseline" note="readings looked back" />
              <Stat value={settings.minRun} label="Minimum run" note="readings in a row" />
            </div>
          </section>

          {open.length > 0 && (
            <section className="section">
              <div className="section__head">
                <h2>Flagged windows</h2>
                <span className="tiny">Signals, not verdicts. A flag means look, not worry.</span>
              </div>
              <div className="stack-4">
                {open.map((f) => (
                  <Alert
                    key={f.key}
                    tone={TONE[f.severity]}
                    icon="pulse"
                    title={`${METRICS[f.metric].label}: ${f.anomaly.delta >= 0 ? '+' : ''}${f.anomaly.delta} ${METRICS[f.metric].unit} ${f.anomaly.direction} baseline`}
                    actions={<div className="row"><Button variant="ghost" onClick={() => acknowledgeAnomaly(f.key)}>Dismiss</Button></div>}
                  >
                    <p>
                      {describeAnomaly(METRICS[f.metric], f.anomaly)} Baseline was {f.anomaly.baseline} {METRICS[f.metric].unit}; the peak reached{' '}
                      {f.anomaly.peakValue} {METRICS[f.metric].unit}. First flagged {dateTimeLabel(f.startAt)}.
                    </p>
                  </Alert>
                ))}
              </div>
            </section>
          )}

          <section className="section">
            <div className="section__head"><h2>Trends</h2></div>
            <div className="grid grid--2">
              {streams.map(({ metric: mt, points }) => {
                const mine = flagged.filter((f) => f.metric === mt.id);
                const last = points.at(-1);
                return (
                  <Card key={mt.id} title={mt.label} subtitle={`Latest ${mt.dual && last.v2 != null ? `${last.v}/${last.v2}` : last.v} ${mt.unit} · ${points.length} reading${points.length === 1 ? '' : 's'}`} actions={<Icon name={mt.icon} size={24} />}>
                    {points.length > 1 ? (
                      <Sparkline points={points} highlight={mine[0]?.anomaly} color={mine.length ? 'var(--amber-ink)' : 'var(--sage-deep)'} height={96} />
                    ) : (
                      <p className="small">One reading so far. A trend line needs two.</p>
                    )}
                    <p className="small">
                      {points.length < need
                        ? `${need - points.length} more reading${need - points.length === 1 ? '' : 's'} before anomaly detection can start for this.`
                        : mine.length
                          ? `${mine.length} window${mine.length > 1 ? 's' : ''} outside the threshold.`
                          : 'Nothing outside the threshold.'}
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="section">
            <div className="section__head"><h2>Recent readings</h2></div>
            <Card tone="flat">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>When</th><th>Measure</th><th>Value</th><th>Note</th><th><span className="sr-only">Delete</span></th></tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => {
                      const mt = METRICS[r.metric];
                      return (
                        <tr key={r.id}>
                          <td>{dateTimeLabel(r.at)}</td>
                          <td>{mt?.label ?? r.metric}</td>
                          <td>{mt?.dual && r.value2 != null ? `${r.value}/${r.value2}` : r.value} {mt?.unit}</td>
                          <td>{r.note}</td>
                          <td>
                            <button type="button" className="chip__x" onClick={() => removeVital(r.id)} aria-label={`Delete ${mt?.label ?? r.metric} reading from ${dateTimeLabel(r.at)}`}>
                              <Icon name="close" size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Detector settings</h2>
          <Button variant="ghost" onClick={resetDetector}>Reset to defaults</Button>
        </div>
        <Card tone="flat" subtitle="Tightening these changes what gets flagged. The defaults suit a reading a day or so; a watch that samples every few minutes wants a much longer baseline.">
          <div className="grid grid--3">
            <div className="field">
              <label htmlFor="window">Baseline (readings looked back)</label>
              <select id="window" value={settings.window} onChange={(e) => setDetector({ window: Number(e.target.value) })}>
                {[...new Set([5, 7, 12, 20, 30, settings.window])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="threshold">Z-score threshold</label>
              <select id="threshold" value={settings.threshold} onChange={(e) => setDetector({ threshold: Number(e.target.value) })}>
                {[...new Set([2, 2.5, 3, 3.5, settings.threshold])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="minrun">Minimum run length</label>
              <select id="minrun" value={settings.minRun} onChange={(e) => setDetector({ minRun: Number(e.target.value) })}>
                {[...new Set([1, 2, 3, 5, settings.minRun])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <p className="tiny">Defaults: baseline {DETECTOR_DEFAULTS.window}, threshold {DETECTOR_DEFAULTS.threshold}, run {DETECTOR_DEFAULTS.minRun}.</p>
        </Card>
      </section>
    </div>
  );
}
