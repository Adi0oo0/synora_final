import { useState } from 'react';
import { Button, Chip, Card, SafetyStrip } from '../components/Primitives.jsx';
import Icon from '../components/Icon.jsx';
import AccountCard from '../components/AccountCard.jsx';
import { CONDITIONS, ALL_CONDITION_IDS, DEFAULT_TARGETS } from '../data/conditions.js';
import { useHealth } from '../state/HealthContext.jsx';

/** First run. Everything is optional: the app is usable with nothing filled in. */
export default function Onboarding() {
  const { completeOnboarding } = useHealth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [conditionIds, setConditionIds] = useState([]);
  const [sodiumMg, setSodiumMg] = useState(DEFAULT_TARGETS.sodiumMg);

  const toggle = (id) => setConditionIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  function finish(e) {
    e?.preventDefault();
    completeOnboarding({
      name: name.trim(),
      age: age === '' ? null : Number(age),
      conditionIds,
      targets: { sodiumMg: Number(sodiumMg) || DEFAULT_TARGETS.sodiumMg },
    });
  }

  return (
    <main className="onboard" id="main">
      <header className="stack-3">
        <Icon name="leafheart" size={48} strokeWidth={1.5} />
        <h1>Welcome to ZenHealth</h1>
        <p className="lead">
          Tell it a little about you and every page starts from your own picture. Nothing here is required, and you can change any of it later.
        </p>
        <SafetyStrip>Guidance only — not a diagnosis. For an emergency, call your local emergency number.</SafetyStrip>
      </header>

      <form className="stack-6" onSubmit={finish}>
        <Card title="About you">
          <div className="formrow">
            <div className="field">
              <label htmlFor="ob-name">What should we call you?</label>
              <input id="ob-name" type="text" value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ob-age">Age (optional)</label>
              <input id="ob-age" type="number" min="1" max="120" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card title="Conditions you manage" subtitle="These shape the nutrition verdicts, reading list and check-ups. Pick none if none apply.">
          <ul className="chips">
            {ALL_CONDITION_IDS.map((id) => (
              <Chip key={id} pressed={conditionIds.includes(id)} onClick={() => toggle(id)}>{CONDITIONS[id].label}</Chip>
            ))}
          </ul>
          {conditionIds.includes('htn') && (
            <div className="field">
              <label htmlFor="ob-sodium">Daily sodium limit (mg)</label>
              <input id="ob-sodium" type="number" min="500" max="5000" step="50" value={sodiumMg} onChange={(e) => setSodiumMg(e.target.value)} />
              <span className="tiny">1,500 mg is a common target for high blood pressure. Use the number your clinician gave you.</span>
            </div>
          )}
        </Card>

        <div className="row">
          <Button type="submit" variant="solid" size="lg">Get started</Button>
          <Button variant="ghost" onClick={() => finish()}>Skip for now</Button>
        </div>
      </form>

      <AccountCard />
      <p className="tiny">Your entries are saved in this browser as you go. Sign in (if offered above) to keep them on your account as well.</p>
    </main>
  );
}
