import { CONDITIONS } from '../data/profile.js';

/**
 * Condition-aware food scoring.
 * Profile conditions override generic wellness advice — a low-calorie ramen is
 * still the wrong call at 1,720 mg of sodium for someone with hypertension.
 */

const REFLUX_TAGS = ['fatty', 'fried', 'spicy', 'caffeine', 'acidic'];

function diabetesImpact(food) {
  if (food.gi >= 70)
    return { level: 'warn', text: `High glycaemic index (${food.gi}). Expect a sharp rise — pair it with protein or split the portion.` };
  if (food.gi >= 56)
    return { level: 'caution', text: `Mid-range glycaemic index (${food.gi}). Fibre or protein alongside will flatten the curve.` };
  return { level: 'good', text: `Low glycaemic index (${food.gi}). A steadier response.` };
}

function hypertensionImpact(food, target = 1500) {
  const pct = Math.round((food.sodium / target) * 100);
  if (food.sodium >= 800)
    return { level: 'warn', text: `High sodium: ${food.sodium} mg is ${pct}% of your ${target} mg day in one serving.` };
  if (food.sodium >= 400)
    return { level: 'caution', text: `Moderate sodium: ${food.sodium} mg, ${pct}% of your daily room.` };
  return { level: 'good', text: `Low sodium: ${food.sodium} mg, comfortable against your target.` };
}

function refluxImpact(food) {
  const hits = (food.tags || []).filter((t) => REFLUX_TAGS.includes(t));
  if (hits.length >= 2 || food.fat >= 30)
    return { level: 'warn', text: `Rich${hits.length ? ' and ' + hits.join(' and ') : ''}. A common reflux trigger — keep it more than three hours from bed.` };
  if (hits.length === 1)
    return { level: 'caution', text: `Mildly reflux-prone (${hits[0]}). Fine earlier in the day, riskier at night.` };
  return { level: 'good', text: 'Unlikely to set off reflux.' };
}

const BY_CONDITION = {
  t2d: diabetesImpact,
  htn: hypertensionImpact,
  gerd: refluxImpact,
};

/** @returns {{conditionId: string, label: string, level: 'good'|'caution'|'warn', text: string}[]} */
export function analyseFood(food, conditionIds = [], targets = {}) {
  if (!food) return [];
  return conditionIds
    .filter((id) => BY_CONDITION[id])
    .map((id) => ({
      conditionId: id,
      label: CONDITIONS[id]?.label ?? id,
      ...BY_CONDITION[id](food, id === 'htn' ? targets.sodiumMg : undefined),
    }));
}

export function worstLevel(impacts = []) {
  if (impacts.some((i) => i.level === 'warn')) return 'warn';
  if (impacts.some((i) => i.level === 'caution')) return 'caution';
  return 'good';
}

export function macroSplit(food) {
  const carbKcal = food.carbs * 4;
  const proteinKcal = food.protein * 4;
  const fatKcal = food.fat * 9;
  const total = carbKcal + proteinKcal + fatKcal || 1;
  return [
    { key: 'carbs', label: 'Carbs', grams: food.carbs, pct: Math.round((carbKcal / total) * 100), color: 'var(--sand)' },
    { key: 'protein', label: 'Protein', grams: food.protein, pct: Math.round((proteinKcal / total) * 100), color: 'var(--sage)' },
    { key: 'fat', label: 'Fat', grams: food.fat, pct: Math.round((fatKcal / total) * 100), color: 'var(--tea)' },
  ];
}

export function dayTotals(meals = [], foodById = {}) {
  return meals.reduce(
    (acc, m) => {
      const f = foodById[m.foodId];
      if (!f) return acc;
      acc.kcal += f.kcal;
      acc.carbs += f.carbs;
      acc.protein += f.protein;
      acc.fat += f.fat;
      acc.sodium += f.sodium;
      return acc;
    },
    { kcal: 0, carbs: 0, protein: 0, fat: 0, sodium: 0 },
  );
}

export function searchFoods(query, foods) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return foods
    .map((f) => {
      const name = f.name.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (q.split(' ').some((w) => w.length > 2 && name.includes(w))) score = 30;
      return { food: f, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.food);
}
