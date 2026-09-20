import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Alert, Chip } from '../components/Primitives.jsx';
import Gauge from '../components/Gauge.jsx';
import Icon from '../components/Icon.jsx';
import { CONDITIONS } from '../data/conditions.js';
import { buildClinicianSummary } from '../lib/summary.js';
import { localDate, dateTimeLabel } from '../lib/dates.js';
import { useHealth } from '../state/HealthContext.jsx';

const BLANK_MED = { name: '', dose: '', schedule: '', dosesPerDay: 1, conditionId: '' };
const BLANK_CONTACT = { name: '', role: '', phone: '' };

export default function CareTeam() {
  const health = useHealth();
  const { latestTriage: triage, medications, contacts, conditionIds, addMedication, removeMedication, markDose, addContact, removeContact, state } = health;

  const [med, setMed] = useState(BLANK_MED);
  const [contact, setContact] = useState(BLANK_CONTACT);
  const [copied, setCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const day = localDate();
  const summary = useMemo(() => (showSummary ? buildClinicianSummary(state) : ''), [showSummary, state]);

  function submitMed(e) {
    e.preventDefault();
    if (!med.name.trim()) return;
    addMedication({
      name: med.name.trim(),
      dose: med.dose.trim(),
      schedule: med.schedule.trim(),
      dosesPerDay: Math.max(1, Math.min(12, Number(med.dosesPerDay) || 1)),
      conditionId: med.conditionId || undefined,
    });
    setMed(BLANK_MED);
  }

  function submitContact(e) {
    e.preventDefault();
    if (!contact.name.trim()) return;
    addContact({ name: contact.name.trim(), role: contact.role.trim(), phone: contact.phone.trim() });
    setContact(BLANK_CONTACT);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>Care team</h1>
        <p className="lead">
          Your medicines, the people who look after you, and a one-page summary you can hand to a clinician — built only from what you have entered.
        </p>
      </header>

      <section className="section">
        <div className="grid grid--aside">
          <Card title="Current urgency" kanji="安全">
            {triage ? (
              <Gauge score={triage.score} band={triage.band} note={`From your check on ${dateTimeLabel(triage.at)}.`} />
            ) : (
              <p className="small">No symptom check yet. <Link to="/triage">Run one</Link> and the result shows here.</p>
            )}
          </Card>

          <Card title="Summary for a clinician" subtitle="Conditions, medicines, your latest symptom check and readings on one page.">
            <div className="row">
              <Button variant="solid" icon="book" onClick={() => setShowSummary((v) => !v)}>
                {showSummary ? 'Hide summary' : 'Prepare summary'}
              </Button>
              {showSummary && <Button onClick={copy}>{copied ? 'Copied' : 'Copy text'}</Button>}
              {showSummary && <Button variant="ghost" onClick={() => window.print()}>Print</Button>}
            </div>
            {showSummary && <pre className="pre" tabIndex={0} aria-label="Clinician summary">{summary}</pre>}
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Medicines</h2>
          <span className="tiny">Tap a dose when you take it. The count starts again each day.</span>
        </div>

        {medications.length === 0 && (
          <div className="empty">
            <p>No medicines listed. Add what you take so today's doses can be tracked and the summary for your clinician is complete.</p>
          </div>
        )}

        <div className="grid grid--3">
          {medications.map((m) => {
            const taken = m.taken[day] ?? 0;
            return (
              <Card key={m.id} as="article" title={`${m.name}${m.dose ? ` ${m.dose}` : ''}`} subtitle={m.schedule || undefined}>
                <div className="stack-3">
                  <div className="between">
                    {m.conditionId ? <Chip variant="cond">{CONDITIONS[m.conditionId]?.short ?? m.conditionId}</Chip> : <span />}
                    <span className="row-tight" aria-label={`${taken} of ${m.dosesPerDay} doses taken today`}>
                      {Array.from({ length: m.dosesPerDay }, (_, i) => (
                        <i key={i} className="dot" style={{ width: 12, height: 12, background: i < taken ? 'var(--sage)' : 'var(--line)' }} />
                      ))}
                    </span>
                  </div>
                  <div className="row">
                    <Button icon="check" onClick={() => markDose(m.id, 1)} disabled={taken >= m.dosesPerDay}>Took a dose</Button>
                    <Button variant="ghost" onClick={() => markDose(m.id, -1)} disabled={taken <= 0}>Undo</Button>
                    <Button variant="ghost" onClick={() => removeMedication(m.id)} aria-label={`Remove ${m.name}`}>Remove</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card tone="flat" title="Add a medicine">
          <form className="stack-4" onSubmit={submitMed}>
            <div className="formrow">
              <div className="field">
                <label htmlFor="m-name">Name</label>
                <input id="m-name" type="text" value={med.name} maxLength={80} onChange={(e) => setMed({ ...med, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="m-dose">Dose</label>
                <input id="m-dose" type="text" value={med.dose} maxLength={40} placeholder="500 mg" onChange={(e) => setMed({ ...med, dose: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="m-sched">When</label>
                <input id="m-sched" type="text" value={med.schedule} maxLength={80} placeholder="With breakfast and dinner" onChange={(e) => setMed({ ...med, schedule: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="m-per">Doses a day</label>
                <input id="m-per" type="number" min="1" max="12" value={med.dosesPerDay} onChange={(e) => setMed({ ...med, dosesPerDay: e.target.value })} />
              </div>
              {conditionIds.length > 0 && (
                <div className="field">
                  <label htmlFor="m-cond">For (optional)</label>
                  <select id="m-cond" value={med.conditionId} onChange={(e) => setMed({ ...med, conditionId: e.target.value })}>
                    <option value="">—</option>
                    {conditionIds.map((id) => <option key={id} value={id}>{CONDITIONS[id]?.label ?? id}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="row"><Button type="submit" icon="plus">Add medicine</Button></div>
          </form>
        </Card>
        <Alert tone="sage" icon="info" title="Interactions">
          This app does not check medicines against each other. Ask a pharmacist or your clinician before starting or combining anything, including over-the-counter painkillers.
        </Alert>
      </section>

      <section className="section">
        <div className="section__head"><h2>Your care contacts</h2></div>
        {contacts.length > 0 && (
          <Card tone="flat">
            <ul className="rows">
              {contacts.map((c) => (
                <li key={c.id}>
                  <div className="row-tight">
                    <span className="face"><Icon name="steth" size={22} /></span>
                    <div>
                      <b className="serif" style={{ fontSize: 'var(--text-md)' }}>{c.name}</b>
                      <div className="tiny">{c.role}</div>
                    </div>
                  </div>
                  <div className="row-tight">
                    {c.phone && <a className="btn" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>Call {c.phone}</a>}
                    <Button variant="ghost" onClick={() => removeContact(c.id)} aria-label={`Remove ${c.name}`}>Remove</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card tone="flat" title="Add a contact" subtitle="Your GP, a specialist, a pharmacy, someone who should know.">
          <form className="stack-4" onSubmit={submitContact}>
            <div className="formrow">
              <div className="field">
                <label htmlFor="c-name">Name</label>
                <input id="c-name" type="text" value={contact.name} maxLength={80} onChange={(e) => setContact({ ...contact, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="c-role">Role</label>
                <input id="c-role" type="text" value={contact.role} maxLength={80} placeholder="GP, endocrinologist, pharmacy…" onChange={(e) => setContact({ ...contact, role: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="c-phone">Phone</label>
                <input id="c-phone" type="tel" value={contact.phone} maxLength={30} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </div>
            </div>
            <div className="row"><Button type="submit" icon="plus">Add contact</Button></div>
          </form>
        </Card>
      </section>
    </div>
  );
}
