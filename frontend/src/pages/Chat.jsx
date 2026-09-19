import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Card, Button, Chip, Alert, SafetyStrip } from '../components/Primitives.jsx';
import Icon from '../components/Icon.jsx';
import { streamChat } from '../lib/api.js';
import { useHealth } from '../state/HealthContext.jsx';
import { CONDITIONS } from '../data/profile.js';

const STARTERS = [
  'What should I eat before a long walk?',
  'Any tips for sleeping better this week?',
  'Is a dull ache behind my knee worth mentioning to a clinician?',
  'How much sodium is too much in one meal?',
];

let uid = 0;
const nextId = () => `msg_${Date.now()}_${uid++}`;

const ROUTE_LABEL = { wellness: 'wellness', clinical: 'symptom check', admin: 'admin' };

/**
 * Coaching chat. The backend screens for red flags and routes intent before a
 * single token is generated — this page never decides urgency itself, it
 * only renders what the backend already decided (see `route` events) and
 * opens the same emergency screen the rest of the app uses when one fires.
 */
export default function Chat() {
  const { conditionIds } = useHealth();
  const { openEmergency } = useOutletContext();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [useRag, setUseRag] = useState(true);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => streamRef.current?.abort(), []);

  function send(text) {
    const content = (text ?? draft).trim();
    if (!content || streaming) return;

    setError(null);
    setDraft('');

    const userMsg = { id: nextId(), role: 'user', content };
    const assistantId = nextId();
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning: '',
      route: null,
      citations: [],
      pending: true,
    };

    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setStreaming(true);

    const patch = (fn) => setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

    streamRef.current = streamChat(
      {
        messages: history.map(({ role, content }) => ({ role, content })),
        conditionIds,
        thinking,
        useRag,
      },
      {
        onRoute: (route) => {
          patch((m) => ({ ...m, route }));
          if (route.red_flag) openEmergency();
        },
        onCitations: (payload) => patch((m) => ({ ...m, citations: payload.hits ?? [] })),
        onReasoning: (text) => patch((m) => ({ ...m, reasoning: (m.reasoning || '') + text })),
        onContent: (text) => patch((m) => ({ ...m, content: m.content + text, pending: false })),
        onDone: () => {
          patch((m) => ({ ...m, pending: false }));
          setStreaming(false);
        },
        onError: (message) => {
          setError(message);
          patch((m) => ({ ...m, pending: false }));
          setStreaming(false);
        },
      },
    );
  }

  function stop() {
    streamRef.current?.abort();
    setStreaming(false);
    setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false } : m)));
  }

  function onSubmit(e) {
    e.preventDefault();
    send();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>Talk it through</h1>
        <p className="lead">
          A wellness coach that knows your conditions, not a diagnosis. Anything that reads like an
          emergency is screened before a single token is generated and handed straight to the
          emergency screen — the model never gets a chance to talk you out of it.
        </p>
        <SafetyStrip>Coaching only — for anything urgent, use the emergency screen.</SafetyStrip>
      </header>

      <section className="section">
        <Card tone="flat" className="chat">
          <div className="chat__log">
            {messages.length === 0 && (
              <div className="chat__empty">
                <p className="small">
                  Ask about food, sleep, activity, or a pattern worth raising with a clinician.
                </p>
                <ul className="chips">
                  {STARTERS.map((s) => (
                    <Chip key={s} onClick={() => send(s)}>{s}</Chip>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`chat__msg chat__msg--${m.role}`}>
                <span className={`face chat__face${m.role === 'user' ? ' face--me' : ''}`} aria-hidden="true">
                  <Icon name={m.role === 'user' ? 'user' : 'leafheart'} size={20} />
                </span>

                <div className="chat__bubble">
                  {m.role === 'assistant' && m.route && (
                    <span
                      className={`pill pill--${m.route.red_flag ? 'late' : m.route.route === 'wellness' ? 'ok' : 'plain'}`}
                    >
                      {m.route.red_flag ? 'emergency' : ROUTE_LABEL[m.route.route] ?? m.route.route}
                    </span>
                  )}

                  {m.pending && !m.content ? (
                    <p className="chat__typing" aria-label="Thinking">
                      <i /><i /><i />
                    </p>
                  ) : (
                    <p>{m.content}</p>
                  )}

                  {m.role === 'assistant' && m.route?.route === 'clinical' && !m.route.red_flag && !m.pending && (
                    <Link className="btn btn--sage" to="/triage">
                      <Icon name="body" size={16} /> Open the symptom check
                    </Link>
                  )}

                  {m.reasoning && (
                    <details className="chat__reasoning">
                      <summary>Reasoning</summary>
                      <p className="tiny">{m.reasoning}</p>
                    </details>
                  )}

                  {m.citations?.length > 0 && (
                    <ul className="chips">
                      {m.citations.map((c) => (
                        <Chip key={c.id}>{c.title}</Chip>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {error && (
            <Alert tone="crimson" icon="alert" title="Something went wrong">
              {error}
            </Alert>
          )}

          <form className="chat__composer" onSubmit={onSubmit}>
            <div className="between">
              <div className="row-tight">
                <label className="switch">
                  <input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} />
                  <span className="rail" />
                  <span>Show reasoning</span>
                </label>
                <label className="switch">
                  <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} />
                  <span className="rail" />
                  <span>Reference library</span>
                </label>
              </div>
              {conditionIds.length > 0 && (
                <span className="tiny">
                  Weighing: {conditionIds.map((id) => CONDITIONS[id]?.short ?? id).join(', ')}
                </span>
              )}
            </div>

            <div className="row chat__inputrow">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about food, sleep, activity, or something you noticed…"
                maxLength={4000}
                rows={2}
                disabled={streaming}
              />
              {streaming ? (
                <Button type="button" variant="ghost" onClick={stop}>
                  Stop
                </Button>
              ) : (
                <Button type="submit" variant="solid" icon="send" disabled={!draft.trim()}>
                  Send
                </Button>
              )}
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
