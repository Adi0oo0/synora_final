import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Chip, Impact, Track, Alert, Stat } from '../components/Primitives.jsx';
import Icon from '../components/Icon.jsx';
import { FOODS } from '../data/foods.js';
import { CONDITIONS } from '../data/conditions.js';
import { analyseFood, macroSplit, searchFoods, worstLevel, scaleFood, dailyTotals } from '../lib/nutrition.js';
import { todayMeals, todayTotals } from '../lib/insights.js';
import { analyseMealPhoto, fileToDataUrl } from '../lib/api.js';
import { localDate, timeLabel, dateLabel } from '../lib/dates.js';
import { useHealth } from '../state/HealthContext.jsx';

const LABELS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const TAGS = ['fatty', 'fried', 'spicy', 'caffeine', 'acidic'];
const BLANK = { name: '', kcal: '', carbs: '', protein: '', fat: '', fibre: '', sodium: '', gi: '', tags: [] };

function defaultLabel() {
  const h = new Date().getHours();
  if (h < 10) return 'Breakfast';
  if (h < 15) return 'Lunch';
  if (h < 21) return 'Dinner';
  return 'Snack';
}

const n = (v) => (v === '' || v == null ? 0 : Number(v));

export default function Nutrition() {
  const { conditionIds, profile, meals, addMeal, removeMeal } = useHealth();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [selected, setSelected] = useState(null);
  const [servings, setServings] = useState(1);
  const [label, setLabel] = useState(defaultLabel);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState(null);
  const [custom, setCustom] = useState(BLANK);
  const [customError, setCustomError] = useState(null);
  const fileRef = useRef(null);

  const targets = profile.targets;
  const matches = useMemo(() => searchFoods(query, FOODS).slice(0, 6), [query]);
  const shown = useMemo(() => (selected ? scaleFood(selected, servings) : null), [selected, servings]);
  const impacts = useMemo(() => analyseFood(shown, conditionIds, targets), [shown, conditionIds, targets]);
  const macros = useMemo(() => (shown ? macroSplit(shown) : []), [shown]);
  const totals = todayTotals(meals);
  const today = todayMeals(meals);
  const sodiumPct = targets.sodiumMg ? Math.round((totals.sodium / targets.sodiumMg) * 100) : 0;
  const headline = worstLevel(impacts);
  const earlier = useMemo(() => dailyTotals(meals, localDate).filter((d) => d.day !== localDate()).slice(0, 7), [meals]);

  function choose(food) {
    setSelected(food);
    setServings(1);
    setScanNote(null);
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    setScanNote(null);
    try {
      const res = await analyseMealPhoto(await fileToDataUrl(file), conditionIds);
      if (res.ok && res.food) {
        choose({ ...res.food, id: 'photo', name: res.food.name || 'Meal from photo', source: 'photo' });
        setScanNote(`Estimated from your photo by the vision model${res.confidence ? ` (confidence ${res.confidence})` : ''}. Portions are a guess — change the servings or correct it by hand if it looks off.`);
      } else {
        setScanNote('The photo could not be analysed — the vision service is not reachable or has no key. Search the food table above or enter the food by hand below.');
      }
    } catch {
      setScanNote('That file could not be read. Try another photo.');
    } finally {
      setScanning(false);
    }
  }

  function submitCustom(e) {
    e.preventDefault();
    if (!custom.name.trim()) return setCustomError('Give the food a name.');
    if (custom.kcal === '' || n(custom.kcal) < 0) return setCustomError('Calories are needed. Enter 0 if it has none.');
    setCustomError(null);
    choose({
      id: 'custom',
      source: 'manual',
      name: custom.name.trim(),
      portion: 'as entered',
      kcal: n(custom.kcal),
      carbs: n(custom.carbs),
      protein: n(custom.protein),
      fat: n(custom.fat),
      fibre: n(custom.fibre),
      sodium: n(custom.sodium),
      gi: custom.gi === '' ? null : n(custom.gi),
      tags: custom.tags,
    });
    setCustom(BLANK);
  }

  function logIt() {
    if (!shown) return;
    const { id, ...rest } = shown;
    addMeal({ ...rest, source: shown.source ?? 'table', foodId: id !== 'photo' && id !== 'custom' ? id : undefined }, { label });
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>What's on the plate?</h1>
        <p className="lead">
          Every food is scored against the conditions you listed, not a generic calorie target. A light meal can still be the wrong call.
        </p>
      </header>

      <section className="section">
        <div className="grid grid--sidebar">
          <div className="stack-6">
            <Card tone="flat">
              <label className="search">
                <span className="sr-only">Search a food</span>
                <Icon name="search" size={20} />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Avocado toast, miso soup, instant ramen…" autoComplete="off" />
              </label>

              {matches.length > 0 && (
                <ul className="chips">
                  {matches.map((f) => (
                    <Chip key={f.id} pressed={selected?.id === f.id} onClick={() => choose(f)}>{f.name}</Chip>
                  ))}
                </ul>
              )}
              {query && matches.length === 0 && (
                <p className="small">Nothing in the built-in food table matches that. Photograph it, or enter it by hand below.</p>
              )}

              <div className="row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
                <Button icon="scan" onClick={() => fileRef.current?.click()} disabled={scanning}>
                  {scanning ? 'Reading the plate…' : 'Photograph a meal'}
                </Button>
                <span className="tiny">Sent to the vision model through your own backend.</span>
              </div>
              {scanNote && <p className="small" role="status">{scanNote}</p>}

              <details>
                <summary className="small" style={{ cursor: 'pointer' }}>Enter a food by hand</summary>
                <form className="stack-4" onSubmit={submitCustom} noValidate style={{ marginTop: 'var(--space-4)' }}>
                  <div className="field">
                    <label htmlFor="c-name">Name</label>
                    <input id="c-name" type="text" value={custom.name} maxLength={80} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
                  </div>
                  <div className="formrow">
                    {[['kcal', 'Calories (kcal)'], ['carbs', 'Carbs (g)'], ['protein', 'Protein (g)'], ['fat', 'Fat (g)'], ['fibre', 'Fibre (g)'], ['sodium', 'Sodium (mg)'], ['gi', 'Glycaemic index (if known)']].map(([key, text]) => (
                      <div className="field" key={key}>
                        <label htmlFor={`c-${key}`}>{text}</label>
                        <input id={`c-${key}`} type="number" min="0" inputMode="decimal" value={custom[key]} onChange={(e) => setCustom({ ...custom, [key]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                  <fieldset className="fieldset" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend>Anything that applies (for reflux scoring)</legend>
                    <ul className="chips">
                      {TAGS.map((t) => (
                        <Chip key={t} pressed={custom.tags.includes(t)} onClick={() => setCustom({ ...custom, tags: custom.tags.includes(t) ? custom.tags.filter((x) => x !== t) : [...custom.tags, t] })}>{t}</Chip>
                      ))}
                    </ul>
                  </fieldset>
                  {customError && <Alert tone="crimson" icon="alert">{customError}</Alert>}
                  <div className="row"><Button type="submit" icon="check">Use this food</Button></div>
                </form>
              </details>
            </Card>

            {shown ? (
              <Card
                title={shown.name}
                subtitle={shown.portion ? `Per ${shown.portion}` : undefined}
                actions={<Button icon="plus" onClick={logIt}>Add to today</Button>}
              >
                <div className="card__body">
                  <div className="formrow">
                    <div className="field">
                      <label htmlFor="servings">Servings</label>
                      <select id="servings" value={servings} onChange={(e) => setServings(Number(e.target.value))}>
                        {[0.5, 1, 1.5, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="meal-label">Meal</label>
                      <select id="meal-label" value={label} onChange={(e) => setLabel(e.target.value)}>
                        {LABELS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid--4">
                    <Stat value={shown.kcal} label="Calories" note="kcal" />
                    <Stat value={shown.gi ?? '—'} label="Glycaemic index" note={shown.gi == null ? 'not recorded' : shown.gi >= 70 ? 'high' : shown.gi >= 56 ? 'medium' : 'low'} tone={shown.gi == null ? undefined : shown.gi >= 70 ? 'crimson' : shown.gi >= 56 ? 'sand' : 'sage'} />
                    <Stat value={`${shown.sodium} mg`} label="Sodium" note={targets.sodiumMg ? `${Math.round((shown.sodium / targets.sodiumMg) * 100)}% of target` : undefined} tone={shown.sodium >= 800 ? 'crimson' : shown.sodium >= 400 ? 'sand' : 'sage'} />
                    <Stat value={`${shown.fibre ?? 0} g`} label="Fibre" note="this serving" />
                  </div>

                  <div className="stack-4">
                    {macros.map((m) => (
                      <div className="macro" key={m.key}>
                        <span>{m.label}</span>
                        <Track pct={m.pct} color={m.color} />
                        <b>{m.grams} g</b>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : (
              <div className="empty">
                <p>Search a food, photograph a plate or enter one by hand to see how it sits with your conditions before you add it to today.</p>
              </div>
            )}
          </div>

          <Card title="Health impact" kanji="食" subtitle="One verdict per condition you listed." tone={headline === 'warn' ? 'focus' : undefined}>
            <div className="stack-3">
              {impacts.map((i) => (
                <div key={i.conditionId} className="stack-2">
                  <span className="tiny">{i.label}</span>
                  <Impact level={i.level}>{i.text}</Impact>
                </div>
              ))}
              {shown && !impacts.length && (
                <p className="small">You have not listed any conditions, so there is nothing specific to weigh this against. Add them in Settings.</p>
              )}
              {!shown && <p className="small">Pick a food to see the verdicts.</p>}
            </div>
            <p className="tiny">Rules live in src/lib/nutrition.js. Swap them for your dietitian's thresholds without touching the interface.</p>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Today's log</h2>
          <span className="small">{totals.kcal.toLocaleString()} kcal · {totals.sodium.toLocaleString()} mg sodium</span>
        </div>

        {targets.sodiumMg > 0 && sodiumPct >= 80 && (
          <Alert tone={sodiumPct >= 100 ? 'crimson' : 'sand'} icon="drop" title={`Sodium at ${sodiumPct}% of your daily target`}>
            {sodiumPct >= 100 ? 'You are over the target you set.' : 'You are close to the target you set.'} Soups, broths and sauces usually carry most of it.
          </Alert>
        )}

        <Card tone="flat">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Time</th><th>Food</th><th>Calories</th><th>Carbs</th><th>Sodium</th><th><span className="sr-only">Remove</span></th></tr>
              </thead>
              <tbody>
                {today.map((m) => (
                  <tr key={m.id}>
                    <td>{timeLabel(m.at)}{m.label ? ` · ${m.label}` : ''}</td>
                    <td>{m.food.name}{m.food.portion ? ` (${m.food.portion})` : ''}</td>
                    <td>{m.food.kcal}</td>
                    <td>{m.food.carbs} g</td>
                    <td>{m.food.sodium} mg</td>
                    <td>
                      <button type="button" className="chip__x" onClick={() => removeMeal(m.id)} aria-label={`Remove ${m.food.name}`}>
                        <Icon name="close" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!today.length && (
                  <tr><td colSpan={6}><p className="small">Nothing logged yet today. Pick a food above and add it.</p></td></tr>
                )}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>Running total</td><td>{totals.kcal.toLocaleString()}</td><td>{totals.carbs} g</td><td>{totals.sodium.toLocaleString()} mg</td><td /></tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </section>

      {earlier.length > 0 && (
        <section className="section">
          <div className="section__head"><h2>Earlier days</h2></div>
          <Card tone="flat">
            <ul className="rows">
              {earlier.map((d) => (
                <li key={d.day}>
                  <div>
                    <b className="serif" style={{ fontSize: 'var(--text-md)' }}>{dateLabel(`${d.day}T12:00:00`)}</b>
                    <div className="tiny">{d.count} entr{d.count === 1 ? 'y' : 'ies'}</div>
                  </div>
                  <span className="small">{d.kcal.toLocaleString()} kcal · {d.sodium.toLocaleString()} mg sodium</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {conditionIds.length > 0 && (
        <section className="section">
          <div className="section__head"><h2>What your conditions watch for</h2></div>
          <div className="grid grid--3">
            {conditionIds.map((id) => (
              <Card key={id} as="article" tone="sunken" title={CONDITIONS[id]?.label}>
                <ul className="chips">
                  {(CONDITIONS[id]?.watch ?? []).map((w) => <Chip key={w}>{w}</Chip>)}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
