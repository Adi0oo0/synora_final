import { describe, expect, it } from 'vitest';
import { emptyState, isBlank, mergeStates, readLocal, sanitizeState, stableStringify, trimState, writeLocal, LIMITS } from '../lib/storage.js';

const fakeStorage = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
};
const meal = (id, at = '2026-09-20T08:00:00.000Z') => ({ id, at, label: '', food: { name: id, kcal: 100, carbs: 10, sodium: 50 } });

describe('a new person starts with nothing', () => {
  it('has no profile, meals, readings or history', () => {
    const s = emptyState();
    expect(isBlank(s)).toBe(true);
    expect(s.profile.name).toBe('');
    expect(s.profile.conditionIds).toEqual([]);
    for (const k of ['logs', 'meals', 'triage', 'vitals', 'medications', 'contacts']) expect(s[k]).toEqual([]);
  });

  it('reads an empty state when nothing was saved or the data is corrupt', () => {
    const st = fakeStorage();
    expect(isBlank(readLocal('u1', st))).toBe(true);
    st.setItem('zenhealth.state.v2.u1', '{not json');
    expect(isBlank(readLocal('u1', st))).toBe(true);
  });
});

describe('saving and loading', () => {
  it('round-trips what was entered', () => {
    const st = fakeStorage();
    const s = { ...emptyState(), meals: [meal('a')], profile: { ...emptyState().profile, name: 'Asha', onboarded: true } };
    expect(writeLocal('u1', s, st)).toBe(true);
    const back = readLocal('u1', st);
    expect(back.meals).toHaveLength(1);
    expect(back.profile.name).toBe('Asha');
  });

  it('keeps one person\'s data away from another\'s', () => {
    const st = fakeStorage();
    writeLocal('alice', { ...emptyState(), meals: [meal('a')] }, st);
    expect(readLocal('bob', st).meals).toEqual([]);
    expect(readLocal(null, st).meals).toEqual([]);
  });

  it('reports a refused write instead of pretending', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(writeLocal('u', emptyState(), full)).toBe(false);
  });

  it('drops malformed entries but keeps good ones', () => {
    const s = sanitizeState({ meals: [meal('ok'), { id: 'bad' }, null, 'x'], vitals: [{ id: 'v', metric: 'hr', value: 'abc', at: 'x' }] });
    expect(s.meals.map((m) => m.id)).toEqual(['ok']);
    expect(s.vitals).toEqual([]);
  });

  it('caps a list at its limit, keeping the newest', () => {
    const many = Array.from({ length: LIMITS.triage + 5 }, (_, i) => ({ id: `t${i}`, at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`, input: {} }));
    expect(trimState({ ...emptyState(), triage: many }).triage).toHaveLength(LIMITS.triage);
    expect(trimState({ ...emptyState(), triage: many }).triage.at(-1).id).toBe(`t${many.length - 1}`);
  });
});

describe('merging this device with the account copy', () => {
  it('unions entries by id without duplicating', () => {
    const a = { ...emptyState(), meals: [meal('1'), meal('2', '2026-09-20T09:00:00.000Z')] };
    const b = { ...emptyState(), meals: [meal('2', '2026-09-20T09:00:00.000Z'), meal('3', '2026-09-20T10:00:00.000Z')] };
    expect(mergeStates(a, b).meals.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('keeps a deletion made on either side', () => {
    const a = { ...emptyState(), meals: [meal('1')], removed: {} };
    const b = { ...emptyState(), meals: [], removed: { 1: '2026-09-20T12:00:00.000Z' } };
    expect(mergeStates(a, b).meals).toEqual([]);
    expect(mergeStates(b, a).meals).toEqual([]);
  });

  it('keeps the newer save for a day\'s check-in', () => {
    const a = { ...emptyState(), logs: [{ date: '2026-09-20', mood: 'Low', severity: 7, savedAt: '2026-09-20T08:00:00Z' }] };
    const b = { ...emptyState(), logs: [{ date: '2026-09-20', mood: 'Bright', severity: 2, savedAt: '2026-09-20T18:00:00Z' }] };
    expect(mergeStates(a, b).logs).toEqual([b.logs[0]]);
  });

  it('never loses a dose that was logged on another device', () => {
    const med = (n) => ({ id: 'm', name: 'X', dose: '', schedule: '', dosesPerDay: 2, taken: { '2026-09-20': n } });
    expect(mergeStates({ ...emptyState(), medications: [med(1)] }, { ...emptyState(), medications: [med(2)] }).medications[0].taken['2026-09-20']).toBe(2);
  });

  it('is order-independent and idempotent for lists', () => {
    const a = { ...emptyState(), meals: [meal('1')] };
    const b = { ...emptyState(), meals: [meal('2', '2026-09-20T09:00:00.000Z')] };
    expect(stableStringify(mergeStates(a, b).meals)).toBe(stableStringify(mergeStates(b, a).meals));
    const once = mergeStates(a, b);
    expect(stableStringify(mergeStates(once, b))).toBe(stableStringify(once));
  });

  it('never blanks a filled-in profile by merging an empty one', () => {
    const filled = { ...emptyState(), profile: { ...emptyState().profile, name: 'Asha', conditionIds: ['htn'], onboarded: true } };
    expect(mergeStates(emptyState(), filled).profile.name).toBe('Asha');
    expect(mergeStates(filled, emptyState()).profile.conditionIds).toEqual(['htn']);
  });

  it('treats a finished onboarding on either side as finished', () => {
    const done = { ...emptyState(), profile: { ...emptyState().profile, onboarded: true, updatedAt: '2026-01-01T00:00:00Z' } };
    const blank = { ...emptyState(), profile: { ...emptyState().profile, name: 'Later', updatedAt: '2026-06-01T00:00:00Z' } };
    expect(mergeStates(done, blank).profile.onboarded).toBe(true);
  });
});
