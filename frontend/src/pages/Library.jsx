import { useEffect, useMemo, useState } from 'react';
import { Card, Chip, Button } from '../components/Primitives.jsx';
import { CONDITIONS } from '../data/conditions.js';
import { preventiveFor } from '../lib/insights.js';
import { searchLibrary } from '../lib/api.js';
import { localDate } from '../lib/dates.js';
import { useHealth } from '../state/HealthContext.jsx';

// What to look up in the reference library for each condition.
const TOPIC = {
  t2d: 'type 2 diabetes glycaemic index blood sugar',
  gerd: 'reflux triggers meals',
  htn: 'sodium blood pressure',
};

const excerpt = (text, n = 260) => (text.length > n ? `${text.slice(0, n).replace(/\s+\S*$/, '')}…` : text);
const uniqueByTitle = (hits) => [...new Map(hits.map((h) => [h.title, h])).values()];

export default function Library() {
  const { state, conditionIds, setPreventiveDone } = useHealth();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [hits, setHits] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | offline

  const tasks = useMemo(() => preventiveFor(state), [state]);
  const late = tasks.filter((t) => t.status === 'late').length;

  // Reading list: the reference library, searched for the person's conditions
  // (or for whatever they type).
  const topic = submitted || (filter === 'all' ? conditionIds.map((id) => TOPIC[id]).filter(Boolean).join(' ') : TOPIC[filter]);
  useEffect(() => {
    if (!topic) {
      setHits([]);
      setStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    searchLibrary(topic, 8).then((res) => {
      if (cancelled) return;
      setHits(uniqueByTitle(res.hits ?? []));
      setStatus(res.ok ? 'ok' : 'offline');
    });
    return () => {
      cancelled = true;
    };
  }, [topic]);

  const today = localDate();

  return (
    <div className="page">
      <header className="page__head">
        <h1>Preventive care</h1>
        <p className="lead">
          Check-ups that usually go with the conditions you listed, and reading from the reference library. Intervals are typical ones —
          your clinician's advice always comes first.
        </p>
      </header>

      <section className="section">
        <div className="section__head">
          <h2>Check-ups</h2>
          <span className="tiny">{tasks.length ? `${late} overdue` : ''}</span>
        </div>

        {tasks.length === 0 ? (
          <div className="empty">
            <p>
              {conditionIds.length
                ? 'None of the conditions you listed have suggested check-ups yet.'
                : 'Add a condition in Settings and the check-ups that usually go with it appear here, with a place to record when you last had each one.'}
            </p>
          </div>
        ) : (
          <Card tone="flat">
            <ul className="rows">
              {tasks.map((t) => (
                <li key={t.id}>
                  <div>
                    <b className="serif" style={{ fontSize: 'var(--text-md)' }}>{t.task}</b>
                    <div className="tiny">{CONDITIONS[t.conditionId]?.label} · {t.note}</div>
                    {t.auto && <div className="tiny">Counts automatically when you log this on Vitals.</div>}
                  </div>
                  <div className="row-tight">
                    <span className={`pill pill--${t.status === 'unset' ? 'plain' : t.status}`}>{t.label}</span>
                    <div className="field">
                      <label className="sr-only" htmlFor={`done-${t.id}`}>Last done: {t.task}</label>
                      <input
                        id={`done-${t.id}`}
                        type="date"
                        max={today}
                        value={state.preventive[t.id]?.lastDone ?? ''}
                        onChange={(e) => setPreventiveDone(t.id, e.target.value)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Worth reading</h2>
          {conditionIds.length > 0 && !submitted && (
            <ul className="chips">
              <Chip pressed={filter === 'all'} onClick={() => setFilter('all')}>Everything</Chip>
              {conditionIds.map((id) => (
                <Chip key={id} pressed={filter === id} onClick={() => setFilter(id)}>{CONDITIONS[id]?.short ?? id}</Chip>
              ))}
            </ul>
          )}
        </div>

        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <label className="search" style={{ flex: 1 }}>
            <span className="sr-only">Search the reference library</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the library: salt, reflux at night, walking after meals…" />
          </label>
          <Button type="submit">Search</Button>
          {submitted && <Button variant="ghost" onClick={() => { setSubmitted(''); setQuery(''); }}>Clear</Button>}
        </form>

        {status === 'loading' && <p className="small">Searching the library…</p>}
        {status === 'offline' && (
          <div className="empty">
            <p>The reference library lives on your backend and it could not be reached. Start it and this list fills in.</p>
          </div>
        )}
        {status === 'idle' && !topic && (
          <div className="empty"><p>Add a condition in Settings, or search for a topic above.</p></div>
        )}
        {status === 'ok' && hits.length === 0 && <p className="small">Nothing in the library matched that.</p>}

        <div className="grid grid--3">
          {hits.map((h) => (
            <Card key={h.id} as="article" tone="sunken">
              <div className="stack-3">
                <h3>{h.title}</h3>
                <p className="small">{excerpt(h.text)}</p>
                <span className="tiny">{h.source}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
