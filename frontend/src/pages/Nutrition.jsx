import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Chip, Impact, Track, Alert, Stat } from '../components/Primitives.jsx';
import Icon from '../components/Icon.jsx';
import { FOODS, FOOD_BY_ID } from '../data/foods.js';
import { CONDITIONS } from '../data/profile.js';
import { analyseFood, macroSplit, dayTotals, searchFoods, worstLevel } from '../lib/nutrition.js';
import { analyseMealPhoto, fileToDataUrl } from '../lib/api.js';
import { useHealth } from '../state/HealthContext.jsx';

export default function Nutrition() {
  const { conditionIds, profile, meals, addMeal, removeMeal } = useHealth();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [selected, setSelected] = useState(FOOD_BY_ID['avocado-toast']);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState(null);
  const fileRef = useRef(null);

  const matches = useMemo(() => searchFoods(query, FOODS).slice(0, 6), [query]);
  const impacts = useMemo(
    () => analyseFood(selected, conditionIds, profile.targets),
    [selected, conditionIds, profile.targets],
  );
  const macros = useMemo(() => (selected ? macroSplit(selected) : []), [selected]);
  const totals = dayTotals(meals, FOOD_BY_ID);
  const sodiumPct = Math.round((totals.sodium / profile.targets.sodiumMg) * 100);
  const headline = worstLevel(impacts);

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanNote(null);
    const dataUrl = await fileToDataUrl(file);
    const res = await analyseMealPhoto(dataUrl, conditionIds);
    setScanning(false);
    if (res.ok && res.food) {
      setSelected({ ...res.food, id: 'photo', name: res.food.name || 'Meal from photo' });
      setScanNote(`Estimated from your photo by the vision model${res.confidence ? ` (confidence ${res.confidence})` : ''}. Portions are a guess — correct them if they look off.`);
    } else {
      setSelected(FOOD_BY_ID.bento);
      setScanNote('The vision service is not reachable, so this is the offline sample instead. Start the backend with an NVIDIA key to analyse real photos.');
    }
    e.target.value = '';
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>What's on the plate?</h1>
        <p className="lead">
          Every food is scored against the conditions on your profile, not a generic calorie target. A
          light meal can still be the wrong call.
        </p>
      </header>

      <section className="section">
        <div className="grid grid--sidebar">
          <div className="stack-6">
            <Card tone="flat">
              <label className="search">
                <span className="sr-only">Search a food</span>
                <Icon name="search" size={20} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Avocado toast, miso soup, instant ramen…"
                  autoComplete="off"
                />
              </label>

              {matches.length > 0 && (
                <ul className="chips">
                  {matches.map((f) => (
                    <Chip key={f.id} pressed={selected?.id === f.id} onClick={() => setSelected(f)}>
                      {f.name}
                    </Chip>
                  ))}
                </ul>
              )}
              {query && matches.length === 0 && (
                <p className="small">
                  Nothing in the offline table matches that. A photo gives a better estimate than a guess.
                </p>
              )}

              <div className="row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
                <Button icon="scan" onClick={() => fileRef.current?.click()} disabled={scanning}>
                  {scanning ? 'Reading the plate…' : 'Photograph a meal'}
                </Button>
                <span className="tiny">Sent to the vision model through your own backend.</span>
              </div>
              {scanNote && <p className="small">{scanNote}</p>}
            </Card>

            {selected && (
              <Card
                title={selected.name}
                subtitle={selected.portion ? `Per ${selected.portion}` : undefined}
                actions={
                  <Button
                    icon="plus"
                    onClick={() =>
                      addMeal({
                        foodId: FOOD_BY_ID[selected.id] ? selected.id : 'bento',
                        at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        label: 'Logged',
                      })
                    }
                  >
                    Add to today
                  </Button>
                }
              >
                <div className="card__body">
                  <div className="grid grid--4">
                    <Stat value={selected.kcal} label="Calories" note="kcal" />
                    <Stat value={selected.gi} label="Glycaemic index" note={selected.gi >= 70 ? 'high' : selected.gi >= 56 ? 'medium' : 'low'} tone={selected.gi >= 70 ? 'crimson' : selected.gi >= 56 ? 'sand' : 'sage'} />
                    <Stat value={`${selected.sodium} mg`} label="Sodium" note={`${Math.round((selected.sodium / profile.targets.sodiumMg) * 100)}% of target`} tone={selected.sodium >= 800 ? 'crimson' : selected.sodium >= 400 ? 'sand' : 'sage'} />
                    <Stat value={`${selected.fibre ?? 0} g`} label="Fibre" note="per serving" />
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
            )}
          </div>

          <Card
            title="Health impact"
            kanji="食"
            subtitle="One verdict per active condition."
            tone={headline === 'warn' ? 'focus' : undefined}
          >
            <div className="stack-3">
              {impacts.map((i) => (
                <div key={i.conditionId} className="stack-2">
                  <span className="tiny">{i.label}</span>
                  <Impact level={i.level}>{i.text}</Impact>
                </div>
              ))}
              {!impacts.length && (
                <p className="small">No conditions on file, so there is nothing specific to weigh this against.</p>
              )}
            </div>
            <p className="tiny">
              Rules live in src/lib/nutrition.js. Swap them for your dietitian's thresholds without
              touching the interface.
            </p>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Today's log</h2>
          <span className="small">
            {totals.kcal.toLocaleString()} kcal · {totals.sodium.toLocaleString()} mg sodium
          </span>
        </div>

        {sodiumPct >= 80 && (
          <Alert tone={sodiumPct >= 100 ? 'crimson' : 'sand'} icon="drop" title={`Sodium at ${sodiumPct}% of your daily target`}>
            Broth is doing most of the damage. Leaving half a bowl of udon broth behind saves roughly
            600 mg on its own.
          </Alert>
        )}

        <Card tone="flat">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Food</th>
                  <th>Calories</th>
                  <th>Carbs</th>
                  <th>Sodium</th>
                  <th><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {meals.map((m) => {
                  const f = FOOD_BY_ID[m.foodId];
                  if (!f) return null;
                  return (
                    <tr key={m.id}>
                      <td>{m.at}</td>
                      <td>{f.name}</td>
                      <td>{f.kcal}</td>
                      <td>{f.carbs} g</td>
                      <td>{f.sodium} mg</td>
                      <td>
                        <button type="button" className="chip__x" onClick={() => removeMeal(m.id)} aria-label={`Remove ${f.name}`}>
                          <Icon name="close" size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!meals.length && (
                  <tr>
                    <td colSpan={6}>
                      <p className="small">Nothing logged yet today. Search a food above and add it.</p>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Running total</td>
                  <td>{totals.kcal.toLocaleString()}</td>
                  <td>{totals.carbs} g</td>
                  <td>{totals.sodium.toLocaleString()} mg</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>What your conditions watch for</h2>
        </div>
        <div className="grid grid--3">
          {conditionIds.map((id) => (
            <Card key={id} as="article" tone="sunken" title={CONDITIONS[id]?.label}>
              <ul className="chips">
                {(CONDITIONS[id]?.watch ?? []).map((w) => (
                  <Chip key={w}>{w}</Chip>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
