import { describe, expect, it } from 'vitest';
import { scoreTriage, bandFor, considerationsFor, routeQuery } from '../lib/triage.js';

const base = { region: 'chest', symptoms: [], triggers: [], severity: 4, duration: 'days' };

describe('triage scoring', () => {
  it('is deterministic across repeated calls', () => {
    const input = { ...base, symptoms: ['burn'], triggers: ['meals'] };
    const runs = Array.from({ length: 25 }, () => scoreTriage(input));
    const first = JSON.stringify(runs[0]);
    expect(runs.every((r) => JSON.stringify(r) === first)).toBe(true);
  });

  it('keeps mild reflux in the low band', () => {
    const r = scoreTriage({ ...base, symptoms: ['burn'], triggers: ['meals'], severity: 3 });
    expect(r.band).toBe('low');
    expect(r.redFlag).toBe(false);
  });

  it('escalates chest pressure with breathlessness to immediate', () => {
    const r = scoreTriage({ ...base, symptoms: ['pressure', 'breath'] });
    expect(r.redFlag).toBe(true);
    expect(r.score).toBe(100);
    expect(r.band).toBe('immediate');
  });

  it('escalates chest pressure on exertion even without breathlessness', () => {
    const r = scoreTriage({ ...base, symptoms: ['pressure'], triggers: ['exertion'] });
    expect(r.band).toBe('immediate');
  });

  it('treats stroke signs as immediate at any severity', () => {
    const r = scoreTriage({ region: 'head', symptoms: ['droop'], triggers: [], severity: 1, duration: 'today' });
    expect(r.band).toBe('immediate');
  });

  it('never exceeds the 0-100 range', () => {
    const r = scoreTriage({
      region: 'joints',
      symptoms: ['knee', 'stiff', 'swell', 'range', 'numb'],
      triggers: ['exertion', 'meals', 'lying', 'stress', 'cold', 'night'],
      severity: 10,
      duration: 'longer',
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('maps band boundaries exactly', () => {
    expect(bandFor(29)).toBe('low');
    expect(bandFor(30)).toBe('moderate');
    expect(bandFor(64)).toBe('moderate');
    expect(bandFor(65)).toBe('immediate');
  });

  it('always returns at least one consideration', () => {
    const input = { ...base, symptoms: ['cough'] };
    const findings = considerationsFor(input, scoreTriage(input));
    expect(findings.length).toBeGreaterThan(0);
  });
});

describe('query routing', () => {
  it('sends symptom words to triage', () => {
    expect(routeQuery('chest pain when I climb stairs')).toBe('/triage');
  });
  it('sends food words to nutrition', () => {
    expect(routeQuery('instant ramen sodium')).toBe('/nutrition');
  });
  it('returns null when nothing matches', () => {
    expect(routeQuery('zzzz')).toBe(null);
  });
});
