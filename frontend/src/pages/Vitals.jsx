import { useMemo, useState } from 'react';
import { Card, Stat, Alert, Button } from '../components/Primitives.jsx';
import Sparkline from '../components/Sparkline.jsx';
import Icon from '../components/Icon.jsx';
import { STREAMS, DETECTOR_DEFAULTS } from '../data/vitals.js';
import { detectAnomalies, describeAnomaly, anomalySeverity } from '../lib/anomaly.js';

const TONE = { warn: 'crimson', caution: 'sand', info: 'sage' };

export default function Vitals() {
  const [settings, setSettings] = useState(DETECTOR_DEFAULTS);

  const results = useMemo(
    () =>
      STREAMS.map((stream) => ({
        stream,
        anomalies: detectAnomalies(stream.points, settings),
      })),
    [settings],
  );

  const flagged = results.flatMap(({ stream, anomalies }) =>
    anomalies.map((a) => ({ stream, a, severity: anomalySeverity(a) })),
  );

  return (
    <div className="page">
      <header className="page__head">
        <h1>Vitals &amp; anomalies</h1>
        <p className="lead">
          Four synthetic streams running through a rolling z-score detector. No model sits in this path —
          it has to answer on every sample, so the rule is arithmetic and the latency is measured in
          milliseconds.
        </p>
      </header>

      <section className="section">
        <div className="grid grid--4">
          <Stat value={flagged.length} label="Windows flagged" note={`z ≥ ${settings.threshold}`} tone={flagged.length ? 'sand' : 'sage'} />
          <Stat value={`${settings.window}`} label="Rolling window" note="samples" />
          <Stat value={`${settings.minRun}`} label="Minimum run" note="consecutive samples" />
          <Stat value="1.2 s" label="Stream lag" note="ingest to alert" />
        </div>
      </section>

      {flagged.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>Flagged windows</h2>
            <span className="tiny">Signals, not verdicts. A flag means look, not worry.</span>
          </div>
          <div className="stack-4">
            {flagged.map(({ stream, a, severity }) => (
              <Alert
                key={`${stream.id}-${a.startIndex}`}
                tone={TONE[severity]}
                icon="pulse"
                title={`${stream.label}: ${a.delta >= 0 ? '+' : ''}${a.delta} ${stream.unit} ${a.direction} baseline`}
              >
                <p>
                  {describeAnomaly(stream, a)} Baseline over the preceding window was {a.baseline}{' '}
                  {stream.unit}; the peak reached {a.peakValue} {stream.unit}.
                </p>
              </Alert>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Streams</h2>
        </div>
        <div className="grid grid--2">
          {results.map(({ stream, anomalies }) => (
            <Card key={stream.id} title={stream.label} subtitle={`Baseline ${stream.baseline} ${stream.unit}`}
              actions={<Icon name={stream.icon} size={24} />}>
              <Sparkline
                points={stream.points}
                highlight={anomalies[0]}
                color={anomalies.length ? 'var(--amber-ink)' : 'var(--sage-deep)'}
                height={96}
              />
              <p className="small">
                {anomalies.length
                  ? `${anomalies.length} window${anomalies.length > 1 ? 's' : ''} outside the threshold.`
                  : 'Nothing outside the threshold in the last 48 samples.'}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Detector settings</h2>
          <Button variant="ghost" onClick={() => setSettings(DETECTOR_DEFAULTS)}>Reset to defaults</Button>
        </div>
        <Card tone="flat" subtitle="Tightening these changes what the dashboard shouts about. They are the same values the stream processor reads in production.">
          <div className="grid grid--3">
            <div className="field">
              <label htmlFor="window">Rolling window (samples)</label>
              <select id="window" value={settings.window} onChange={(e) => setSettings({ ...settings, window: Number(e.target.value) })}>
                {[8, 12, 20, 30].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="threshold">Z-score threshold</label>
              <select id="threshold" value={settings.threshold} onChange={(e) => setSettings({ ...settings, threshold: Number(e.target.value) })}>
                {[2, 2.5, 3, 3.5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="minrun">Minimum run length</label>
              <select id="minrun" value={settings.minRun} onChange={(e) => setSettings({ ...settings, minRun: Number(e.target.value) })}>
                {[1, 2, 3, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
