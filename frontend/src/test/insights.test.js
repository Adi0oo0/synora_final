import { describe, expect, it } from 'vitest';
import { emptyState } from '../lib/storage.js';
import { buildNotifications, findAnomalies, preventiveFor, seriesFor } from '../lib/insights.js';
import { screenText } from '../lib/redflags.js';
import { buildClinicianSummary } from '../lib/summary.js';

const reading = (i, value, metric = 'hr') => ({ id: `v${metric}${i}`, metric, value, at: new Date(2026, 8, 1 + i, 8).toISOString() });
const steady = (n) => Array.from({ length: n }, (_, i) => reading(i, 70 + (i % 2)));

describe('anomalies come only from the person\'s own readings', () => {
  it('finds nothing with no readings, and nothing before there is a baseline', () => {
    expect(findAnomalies([])).toEqual([]);
    expect(findAnomalies(steady(4))).toEqual([]);
  });

  it('flags a sustained rise in their own history', () => {
    const vitals = [...steady(9), reading(9, 98), reading(10, 99), reading(11, 100)];
    const found = findAnomalies(vitals, { window: 7, threshold: 2.5, minRun: 2 });
    expect(found).toHaveLength(1);
    expect(found[0].anomaly.direction).toBe('above');
    expect(found[0].key).toContain('hr:');
  });

  it('does not treat a one-point change from identical readings as an emergency', () => {
    const vitals = [...Array.from({ length: 9 }, (_, i) => reading(i, 120)), reading(9, 121), reading(10, 121)];
    expect(findAnomalies(vitals, { window: 7, threshold: 2.5, minRun: 2 })).toEqual([]);
  });

  it('orders a series by time whatever order it was entered in', () => {
    const s = seriesFor([reading(2, 3), reading(0, 1), reading(1, 2)], 'hr');
    expect(s.map((p) => p.v)).toEqual([1, 2, 3]);
  });
});

describe('notifications reflect the data, not a script', () => {
  it('is empty for a new person', () => {
    expect(buildNotifications(emptyState())).toEqual([]);
  });

  it('reports an unacknowledged anomaly, then goes quiet once dismissed', () => {
    const vitals = [...steady(9), reading(9, 98), reading(10, 99), reading(11, 100)];
    const state = { ...emptyState(), vitals };
    const now = new Date(2026, 8, 13);
    const first = buildNotifications(state, now);
    expect(first.some((n) => n.id.startsWith('anomaly:'))).toBe(true);
    const key = findAnomalies(vitals, state.settings.detector)[0].key;
    expect(buildNotifications({ ...state, acknowledged: [key] }, now).some((n) => n.id.startsWith('anomaly:'))).toBe(false);
  });

  it('flags sodium over the person\'s own target', () => {
    const at = new Date().toISOString();
    const state = { ...emptyState(), meals: [{ id: 'm', at, label: '', food: { name: 'Ramen', kcal: 480, carbs: 60, sodium: 1800 } }] };
    state.profile.targets.sodiumMg = 1500;
    expect(buildNotifications(state).some((n) => n.id === 'sodium')).toBe(true);
  });
});

describe('check-ups are worked out from dates the person gave', () => {
  const withCondition = (extra = {}) => ({ ...emptyState(), profile: { ...emptyState().profile, conditionIds: ['t2d'] }, ...extra });

  it('shows nothing due for someone with no conditions', () => {
    expect(preventiveFor(emptyState())).toEqual([]);
  });

  it('asks rather than guesses when no date is known', () => {
    expect(preventiveFor(withCondition()).every((t) => t.status === 'unset')).toBe(true);
  });

  it('marks an old date overdue and a recent one fine', () => {
    const rows = preventiveFor(withCondition({ preventive: { eye: { lastDone: '2020-01-01' }, foot: { lastDone: new Date().toISOString().slice(0, 10) } } }));
    expect(rows.find((t) => t.id === 'eye').status).toBe('late');
    expect(rows.find((t) => t.id === 'foot').status).toBe('ok');
  });

  it('counts a logged HbA1c as the test being done', () => {
    const at = new Date().toISOString();
    const rows = preventiveFor(withCondition({ vitals: [{ id: 'h', metric: 'hba1c', value: 6.5, at }] }));
    expect(rows.find((t) => t.id === 'hba1c').status).toBe('ok');
  });
});

describe('free-text red flags', () => {
  it.each(['I have chest pain spreading to my arm', 'my face is drooping', 'coughing up blood', 'worst headache of my life'])('catches "%s"', (t) => {
    expect(screenText(t).triggered).toBe(true);
  });
  it('leaves ordinary text alone', () => {
    expect(screenText('mild ache in my knee after stairs').triggered).toBe(false);
  });
});

describe('clinician summary', () => {
  it('only contains what was entered', () => {
    const text = buildClinicianSummary(emptyState());
    expect(text).toMatch(/None listed/);
    expect(text).toMatch(/None recorded/);
    expect(text).toMatch(/None logged/);
    expect(text).not.toMatch(/Haruki|Sato|metformin/i);
  });
});
