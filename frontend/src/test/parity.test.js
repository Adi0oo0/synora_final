import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGIONS, TRIGGERS, DURATIONS } from '../data/regions.js';

// The browser and the backend each score a symptom check. If a symptom id, a
// weight or a red-flag mark differs, the server silently scores that symptom as
// zero. This reads the backend's catalogue and fails on any drift.
const file = new URL('../../../backend/app/services/triage.py', import.meta.url);
const py = existsSync(file) ? readFileSync(file, 'utf8') : null;

describe.skipIf(!py)('client and backend triage catalogues agree', () => {
  const symptoms = {};
  const block = py?.match(/SYMPTOMS: dict.*?\n}\n/s)?.[0] ?? '';
  for (const m of block.matchAll(/"(\w+)": \{"w": (\d+), "label": "[^"]*"(, "red": True)?\}/g)) {
    symptoms[m[1]] = { weight: Number(m[2]), red: Boolean(m[3]) };
  }

  it('found the backend catalogue', () => {
    expect(Object.keys(symptoms).length).toBeGreaterThan(20);
  });

  it('has the same symptoms, weights and red flags', () => {
    const client = {};
    for (const r of Object.values(REGIONS)) for (const s of r.symptoms) client[s.id] = { weight: s.weight, red: Boolean(s.redFlag) };
    expect(client).toEqual(symptoms);
  });

  it('has the same regions', () => {
    const regions = [...(block.matchAll(/^ {4}"(\w+)": \{$/gm))].map((m) => m[1]);
    expect(Object.keys(REGIONS).sort()).toEqual(regions.sort());
  });

  it('has the same trigger and duration weights', () => {
    const grab = (name) => Object.fromEntries([...(py.match(new RegExp(`${name} = \\{([^}]*)\\}`, 's'))?.[1] ?? '').matchAll(/"(\w+)": (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(Object.fromEntries(TRIGGERS.map((t) => [t.id, t.weight]))).toEqual(grab('TRIGGERS'));
    expect(Object.fromEntries(DURATIONS.map((d) => [d.id, d.weight]))).toEqual(grab('DURATIONS'));
  });
});
