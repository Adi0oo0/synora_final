import { useState } from 'react';
import { Card, Chip } from '../components/Primitives.jsx';
import Icon from '../components/Icon.jsx';
import { ARTICLES, PREVENTIVE } from '../data/articles.js';
import { CONDITIONS } from '../data/profile.js';
import { useHealth } from '../state/HealthContext.jsx';

export default function Library() {
  const { conditionIds } = useHealth();
  const [filter, setFilter] = useState('all');

  const relevant = (list) => list.filter((x) => conditionIds.includes(x.conditionId));
  const articles = relevant(ARTICLES).filter((a) => filter === 'all' || a.conditionId === filter);
  const tasks = relevant(PREVENTIVE);

  return (
    <div className="page">
      <header className="page__head">
        <h1>Preventive care</h1>
        <p className="lead">
          Filtered to the conditions on your profile. Nothing generic, nothing for conditions you do not
          have.
        </p>
      </header>

      <section className="section">
        <div className="section__head">
          <h2>What's due</h2>
          <span className="tiny">{tasks.filter((t) => t.status === 'late').length} overdue</span>
        </div>
        <Card tone="flat">
          <ul className="rows">
            {tasks.map((t) => (
              <li key={t.id}>
                <div>
                  <b className="serif" style={{ fontSize: 'var(--text-md)' }}>{t.task}</b>
                  <div className="tiny">{CONDITIONS[t.conditionId]?.label}</div>
                </div>
                <span className={`pill pill--${t.status}`}>{t.due}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Worth reading</h2>
          <ul className="chips">
            <Chip pressed={filter === 'all'} onClick={() => setFilter('all')}>Everything</Chip>
            {conditionIds.map((id) => (
              <Chip key={id} pressed={filter === id} onClick={() => setFilter(id)}>
                {CONDITIONS[id]?.short ?? id}
              </Chip>
            ))}
          </ul>
        </div>

        <div className="grid grid--3">
          {articles.map((a) => (
            <Card key={a.id} as="article" tone="sunken">
              <div className="stack-3">
                <Icon name="book" size={26} />
                <h3>{a.title}</h3>
                <div className="row-tight">
                  <span className="pill pill--plain">{CONDITIONS[a.conditionId]?.short}</span>
                  <span className="tiny">{a.kind} · {a.minutes} min read</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
        {!articles.length && <p className="small">Nothing filed under that condition yet.</p>}
      </section>
    </div>
  );
}
