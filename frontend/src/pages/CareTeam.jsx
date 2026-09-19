import { Card, Button, Alert, Stat, Chip } from '../components/Primitives.jsx';
import Gauge from '../components/Gauge.jsx';
import Icon from '../components/Icon.jsx';
import { CLINICIANS, MEDICATIONS, INTERACTIONS, CONDITIONS } from '../data/profile.js';
import { useHealth } from '../state/HealthContext.jsx';

export default function CareTeam() {
  const { triage, callback, requestCallback } = useHealth();
  const requested = Boolean(callback);

  return (
    <div className="page">
      <header className="page__head">
        <h1>Care team</h1>
        <p className="lead">
          Your last triage summary, medicine list and flagged sensor windows travel with any request you
          make from this page, so nobody starts from scratch.
        </p>
      </header>

      <section className="section">
        <div className="grid grid--aside">
          <Card title="Current urgency" kanji="安全">
            <Gauge
              score={triage?.score ?? 12}
              band={triage?.band ?? 'low'}
              note={triage ? `From your check at ${new Date(triage.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No symptom check today.'}
            />
          </Card>

          <div className="stack-6">
            <Card title="Video callback" subtitle="One tap. No forms, no hold music.">
              <div className="grid grid--2">
                <Stat value={requested ? `${callback.etaMinutes} mins` : '3 mins'} label="Estimated wait" note={requested ? 'Dr. Sato is preparing' : 'Dr. Sato, internal medicine'} tone="sage" />
                <Stat value={requested ? 'Requested' : 'Ready'} label="Status" note={requested ? new Date(callback.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Nothing queued'} />
              </div>
              <Button
                variant="solid"
                size="lg"
                className="btn--wide"
                icon={requested ? 'check' : 'video'}
                disabled={requested}
                onClick={() => requestCallback('sato')}
              >
                {requested ? 'Callback requested' : 'Request a video callback'}
              </Button>
              {requested && (
                <p className="small">
                  Dr. Sato will call in about {callback.etaMinutes} minutes. Keep the app open — the
                  call rings here.
                </p>
              )}
            </Card>

            <Card title="Who is available" kanji="医">
              <ul className="rows">
                {CLINICIANS.map((c) => (
                  <li key={c.id}>
                    <div className="row-tight">
                      <span className="face">
                        <Icon name={c.id === 'nurse' ? 'pulse' : 'steth'} size={22} />
                      </span>
                      <div>
                        <b className="serif" style={{ fontSize: 'var(--text-md)' }}>{c.name}</b>
                        <div className="tiny">{c.specialty}</div>
                      </div>
                    </div>
                    <span className={`pill pill--${c.status === 'online' ? 'ok' : 'soon'}`}>
                      {c.status === 'online' ? 'online now' : `free in ${c.wait}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Medicines</h2>
          <span className="tiny">Green dots are doses already taken today.</span>
        </div>

        {INTERACTIONS.map((i) => (
          <Alert key={i.id} tone="sand" icon="alert" title={i.title}>
            {i.detail}
          </Alert>
        ))}

        <div className="grid grid--3">
          {MEDICATIONS.map((m) => (
            <Card key={m.id} as="article" title={`${m.name} ${m.dose}`} subtitle={m.schedule}>
              <div className="between">
                <Chip variant="cond">{CONDITIONS[m.condition]?.short ?? m.condition}</Chip>
                <span className="row-tight" aria-label={`${m.takenToday} of ${m.dosesPerDay} doses taken`}>
                  {Array.from({ length: m.dosesPerDay }, (_, i) => (
                    <i
                      key={i}
                      className="dot"
                      style={{ width: 12, height: 12, background: i < m.takenToday ? 'var(--sage)' : 'var(--line)' }}
                    />
                  ))}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
