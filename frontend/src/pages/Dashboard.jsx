import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Card, Button, Stat, Alert, Chip } from '../components/Primitives.jsx';
import MoodPicker from '../components/MoodPicker.jsx';
import SeveritySlider from '../components/SeveritySlider.jsx';
import Sparkline from '../components/Sparkline.jsx';
import Gauge from '../components/Gauge.jsx';
import Icon from '../components/Icon.jsx';
import { useHealth } from '../state/HealthContext.jsx';
import { CONDITIONS } from '../data/conditions.js';
import { METRICS } from '../data/metrics.js';
import { describeAnomaly } from '../lib/anomaly.js';
import { buildNotifications, findAnomalies, latestReading, seriesFor, todayMeals, todayTotals } from '../lib/insights.js';
import { dateTimeLabel, timeLabel } from '../lib/dates.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const reading = (metric, r) => (r ? `${METRICS[metric].dual && r.v2 != null ? `${r.v}/${r.v2}` : r.v}` : '—');

export default function Dashboard() {
  const { state, profile, conditionIds, todayLog, saveLog, latestTriage: triage, meals, vitals, acknowledgeAnomaly } = useHealth();
  const { openEmergency } = useOutletContext();
  const [draft, setDraft] = useState(todayLog ?? { mood: 'Steady', severity: 4 });
  useEffect(() => {
    if (todayLog) setDraft(todayLog);
  }, [todayLog]);

  const totals = todayTotals(meals);
  const sodiumTarget = profile.targets.sodiumMg;
  const sodiumPct = sodiumTarget ? Math.round((totals.sodium / sodiumTarget) * 100) : 0;

  const bp = latestReading(vitals, 'bp');
  const glucose = latestReading(vitals, 'glucose');
  const hba1c = latestReading(vitals, 'hba1c');
  const hr = latestReading(vitals, 'hr');

  const anomaly = useMemo(
    () => findAnomalies(vitals, state.settings.detector).find((f) => !state.acknowledged.includes(f.key) && f.severity !== 'info'),
    [vitals, state.settings.detector, state.acknowledged],
  );
  const attention = useMemo(() => buildNotifications(state), [state]);
  const hoursSince = triage ? (Date.now() - new Date(triage.at).getTime()) / 3600000 : null;
  const empty = !meals.length && !vitals.length && !state.triage.length && !state.logs.length;

  return (
    <div className="page">
      <header className="page__head">
        <h1>
          {greeting()}
          {profile.name ? `, ${profile.name}` : ''}
        </h1>
        <p className="lead">
          {empty
            ? 'This is your space. Log how today feels, a reading or a meal and it builds up here — nothing is filled in for you.'
            : attention.length
              ? `${attention.length === 1 ? 'One thing wants' : `${attention.length} things want`} your attention. ${attention.map((a) => a.text).slice(0, 2).join(' ')}`
              : 'Nothing needs your attention right now.'}
        </p>
        {conditionIds.length > 0 && (
          <ul className="chips">
            {conditionIds.map((id) => (
              <Chip key={id} variant="cond">{CONDITIONS[id]?.label ?? id}</Chip>
            ))}
          </ul>
        )}
      </header>

      <section className="section">
        <div className="grid grid--4">
          <Stat
            value={reading('bp', bp)}
            label="Blood pressure"
            note={bp ? `Logged ${dateTimeLabel(bp.at)}` : 'Log a reading on Vitals'}
            tone={bp ? 'sand' : undefined}
          />
          {hba1c ? (
            <Stat value={`${hba1c.v}%`} label="HbA1c" note={`Logged ${dateTimeLabel(hba1c.at)}`} />
          ) : conditionIds.includes('t2d') ? (
            <Stat value={reading('glucose', glucose)} label="Blood glucose" note={glucose ? `mg/dL · ${dateTimeLabel(glucose.at)}` : 'Log a reading on Vitals'} />
          ) : (
            <Stat value={reading('hr', hr)} label="Heart rate" note={hr ? `bpm · ${dateTimeLabel(hr.at)}` : 'Log a reading on Vitals'} />
          )}
          <Stat
            value={`${totals.sodium.toLocaleString()} mg`}
            label="Sodium today"
            note={sodiumTarget ? `${sodiumPct}% of ${sodiumTarget.toLocaleString()} mg target` : 'No target set'}
            tone={sodiumPct >= 100 ? 'crimson' : sodiumPct >= 80 ? 'sand' : undefined}
          />
          <Stat value={totals.kcal.toLocaleString()} label="Calories logged today" note={`${todayMeals(meals).length} entries`} />
        </div>
      </section>

      {anomaly && (
        <section className="section">
          <Alert
            tone={anomaly.severity === 'warn' ? 'crimson' : 'sand'}
            icon="pulse"
            title={`${METRICS[anomaly.metric].label}: ${anomaly.anomaly.delta >= 0 ? '+' : ''}${anomaly.anomaly.delta} ${METRICS[anomaly.metric].unit} ${anomaly.anomaly.direction} your recent baseline`}
            actions={
              <div className="row">
                <Link className="btn" to="/vitals">See the readings</Link>
                <Button variant="ghost" onClick={() => acknowledgeAnomaly(anomaly.key)}>Got it</Button>
                <span className="tiny">{describeAnomaly(METRICS[anomaly.metric], anomaly.anomaly)}</span>
              </div>
            }
          >
            <p>
              Flagged from your own readings, {dateTimeLabel(anomaly.startAt)}. A flag means take a look — it is a signal, not a verdict.
            </p>
            <Sparkline
              points={seriesFor(vitals, anomaly.metric)}
              highlight={anomaly.anomaly}
              color="var(--amber-ink)"
            />
          </Alert>
        </section>
      )}

      <section className="section">
        <div className="grid grid--sidebar">
          <Card title="Today's log" kanji="今日" subtitle="Two taps now saves guessing later.">
            <div className="card__body">
              <div className="stack-3">
                <p className="small">How does today feel?</p>
                <MoodPicker value={draft.mood} onChange={(mood) => setDraft({ ...draft, mood })} />
              </div>
              <SeveritySlider
                value={draft.severity}
                onChange={(severity) => setDraft({ ...draft, severity })}
                hint="1 is barely noticeable. 10 is the worst you have felt."
              />
              <div className="row">
                <Button variant="solid" icon="check" onClick={() => saveLog(draft)}>
                  {todayLog ? "Update today's entry" : "Save today's entry"}
                </Button>
                <span className="tiny">
                  {todayLog?.savedAt ? `Saved ${timeLabel(todayLog.savedAt)}` : 'Not saved yet today'}
                </span>
              </div>
            </div>
          </Card>

          <Card title="Urgency right now" kanji="安全">
            {triage ? (
              <Gauge
                score={triage.score}
                band={triage.band}
                note={`From your symptom check ${hoursSince < 24 ? `at ${timeLabel(triage.at)}` : `on ${dateTimeLabel(triage.at)}`}.`}
              />
            ) : (
              <p className="small">No symptom check yet. Run one when something feels off and the result sits here.</p>
            )}
            <div className="stack-3">
              <Link className="btn btn--wide" to="/triage">
                <Icon name="body" size={18} /> Run a symptom check
              </Link>
              <Button variant="alarm" className="btn--wide" icon="alert" onClick={openEmergency}>
                Something feels wrong now
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Keep it going</h2>
          <Link className="btn btn--ghost" to="/library">Preventive care</Link>
        </div>
        <div className="grid grid--3">
          <Card as="article" tone="sunken" title="Log a meal" subtitle="Checked against your conditions before you eat it.">
            <Link className="btn" to="/nutrition">
              <Icon name="bowl" size={18} /> Open nutrition
            </Link>
          </Card>
          <Card as="article" tone="sunken" title="Log a reading" subtitle="Blood pressure, glucose, heart rate, weight and more.">
            <Link className="btn" to="/vitals">
              <Icon name="pulse" size={18} /> Open vitals
            </Link>
          </Card>
          <Card as="article" tone="sunken" title="Medicines and care team" subtitle="Track today's doses and keep contacts in one place.">
            <Link className="btn" to="/care">
              <Icon name="pill" size={18} /> Open care team
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
