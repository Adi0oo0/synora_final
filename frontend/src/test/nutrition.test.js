import { describe, expect, it } from 'vitest';
import { analyseFood, macroSplit, dayTotals, searchFoods, worstLevel } from '../lib/nutrition.js';
import { FOODS, FOOD_BY_ID } from '../data/foods.js';

const targets = { sodiumMg: 1500 };
const conditions = ['t2d', 'gerd', 'htn'];

describe('condition-aware food scoring', () => {
  it('warns on sodium for hypertension', () => {
    const impacts = analyseFood(FOOD_BY_ID['instant-ramen'], conditions, targets);
    const htn = impacts.find((i) => i.conditionId === 'htn');
    expect(htn.level).toBe('warn');
  });

  it('passes a low-GI, low-sodium food on every condition', () => {
    const impacts = analyseFood(FOOD_BY_ID.edamame, conditions, targets);
    expect(impacts.every((i) => i.level === 'good')).toBe(true);
  });

  it('flags high GI for diabetes even when calories are low', () => {
    const impacts = analyseFood(FOOD_BY_ID['white-rice'], conditions, targets);
    expect(impacts.find((i) => i.conditionId === 't2d').level).toBe('warn');
  });

  it('only scores conditions that are actually on the profile', () => {
    expect(analyseFood(FOOD_BY_ID.banana, ['t2d'], targets)).toHaveLength(1);
    expect(analyseFood(FOOD_BY_ID.banana, [], targets)).toHaveLength(0);
  });

  it('reports the worst level across impacts', () => {
    expect(worstLevel([{ level: 'good' }, { level: 'caution' }, { level: 'warn' }])).toBe('warn');
    expect(worstLevel([{ level: 'good' }, { level: 'good' }])).toBe('good');
  });
});

describe('macros and totals', () => {
  it('splits macros to roughly 100 percent', () => {
    const sum = macroSplit(FOOD_BY_ID.bento).reduce((a, m) => a + m.pct, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2);
  });

  it('adds up a day of meals', () => {
    const totals = dayTotals([{ foodId: 'banana' }, { foodId: 'miso-soup' }], FOOD_BY_ID);
    expect(totals.kcal).toBe(189);
    expect(totals.sodium).toBe(901);
  });

  it('ignores unknown food ids rather than throwing', () => {
    expect(dayTotals([{ foodId: 'nope' }], FOOD_BY_ID).kcal).toBe(0);
  });
});

describe('search', () => {
  it('ranks exact-ish matches first', () => {
    expect(searchFoods('ramen', FOODS)[0].id).toBe('instant-ramen');
  });
  it('returns nothing for an empty query', () => {
    expect(searchFoods('  ', FOODS)).toHaveLength(0);
  });
});
