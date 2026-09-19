import { Link, useOutletContext } from 'react-router-dom';
import { Card, Button, Stat, Alert, Chip } from '../components/Primitives.jsx';
import MoodPicker from '../components/MoodPicker.jsx';
import SeveritySlider from '../components/SeveritySlider.jsx';
import Sparkline from '../components/Sparkline.jsx';
import Gauge from '../components/Gauge.jsx';
import Icon from '../components/Icon.jsx';
import { useHealth } from '../state/HealthContext.jsx';
import { CONDITIONS } from '../data/profile.js';
import { FOOD_BY_ID } from '../data/foods.js';
import { STREAM_BY_ID, DETECTOR_DEFAULTS } from '../data/vitals.js';
import { detectAnomalies, describeAnomaly } from '../lib/anomaly.js';
import { dayTotals } from '../lib/nutrition.js';
import { useState } from 'react';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { profile, conditionIds, log, saveLog, meals, triage, callback } = useHealth();
  const { openEmergency } = useOutletContext();
  const [draft, setDraft] = useState(log);

  const hr = STREAM_BY_ID.hr;
  const anomaly = detectAnomalies(hr.points, DETECTOR_DEFAULTS)[0];
  const totals = dayTotals(meals, FOOD_BY_ID);
  const sodiumPct = Math.round((totals.sodium / profile.targets.sodiumMg) * 100);

  return (
    <div className="page">
      <header className="page__head">
        <h1>
          {greeting()}, {profile.shortName}
        </h1>
        <p className="lead">
          Three things want your attention today: a heart rate window from this morning, your sodium
          running ahead of target, and an eye screening that is five months overdue.
        </p>
        <ul className="chips">
          {conditionIds.map((id) => (
            <Chip key={id} variant="cond">
              {CONDITIONS[id]?.label ?? id}
            </Chip>
          ))}
        </ul>
      </header>

      <section className="section">
        <div className="grid grid--4">
          <Stat value={profile.vitals.hba1c} label="HbA1c" note="June reading" />
          <Stat value={profile.vitals.bp} label="Blood pressure" note="7-day mean" tone="sand" />
          <Stat value={`${totals.sodium.toLocaleString()} mg`} label="Sodium today" note={`${sodiumPct}% of target`} tone={sodiumPct > 80 ? 'crimson' : undefined} />
          <Stat value={`${totals.kcal.toLocaleString()}`} label="Calories logged" note={`${meals.length} entries`} />
        </div>
      </section>

      {anomaly && (
        <section className="section">
          <Alert
            tone="sand"
            icon="pulse"
            title={`Heart rate anomaly detected: ${anomaly.delta >= 0 ? '+' : ''}${anomaly.delta} bpm ${anomaly.direction} baseline`}
            actions={
              <div className="row">
                <Link className="btn" to="/vitals">Examine the stream</Link>
                <span className="tiny">{describeAnomaly(hr, anomaly)}</span>
              </div>
            }
          >
            <p>
              Detected at 06:40 by the rolling z-score watcher, five minutes after you woke, with no step
              count in the window. Skin temperature and blood oxygen stayed in range.
            </p>
            <Sparkline points={hr.points} highlight={anomaly} color="var(--amber-ink)" />
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
                  Save today's entry
                </Button>
                <span className="tiny">
                  {log.savedAt
                    ? `Saved ${new Date(log.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Last saved 08:12 this morning'}
                </span>
              </div>
            </div>
          </Card>

          <Card title="Urgency right now" kanji="安全">
            <Gauge
              score={triage?.score ?? 12}
              band={triage?.band ?? 'low'}
              note={
                triage
                  ? 'From your last symptom check.'
                  : 'Nothing logged today crosses a referral threshold.'
              }
            />
            <div className="stack-3">
              <Link className="btn btn--wide" to="/triage">
                <Icon name="body" size={18} /> Run a symptom check
              </Link>
              <Button variant="alarm" className="btn--wide" icon="alert" onClick={openEmergency}>
                Something feels wrong now
              </Button>
              {callback && (
                <p className="tiny">
                  Callback requested — Dr. Sato in about {callback.etaMinutes} minutes.
                </p>
              )}
            </div>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Pick up where you left off</h2>
          <Link className="btn btn--ghost" to="/library">All preventive care</Link>
        </div>
        <div className="grid grid--3">
          <Card as="article" tone="sunken" title="Log a meal" subtitle="Checked against all three conditions before you eat it.">
            <Link className="btn" to="/nutrition">
              <Icon name="bowl" size={18} /> Open nutrition
            </Link>
          </Card>
          <Card as="article" tone="sunken" title="Review medicines" subtitle="One interaction is waiting for a pharmacist's eye.">
            <Link className="btn" to="/care">
              <Icon name="pill" size={18} /> Open care team
            </Link>
          </Card>
          <Card as="article" tone="sunken" title="Book the eye screening" subtitle="Five months overdue — the longest-standing item on your list.">
            <Link className="btn" to="/library">
              <Icon name="clock" size={18} /> See what's due
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
