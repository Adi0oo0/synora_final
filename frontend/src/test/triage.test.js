import { describe, expect, it } from 'vitest';
import { scoreTriage, bandFor, considerationsFor, routeQuery, mergeServerResult } from '../lib/triage.js';

const base = { region: 'chest', symptoms: [], triggers: [], severity: 4, duration: 'days' };

describe('triage scoring', () => {
  it('is deterministic across repeated calls', () => {
    const input = { ...base, symptoms: ['burning'], triggers: ['meals'] };
    const runs = Array.from({ length: 25 }, () => scoreTriage(input));
    const first = JSON.stringify(runs[0]);
    expect(runs.every((r) => JSON.stringify(r) === first)).toBe(true);
  });

  it('keeps mild reflux in the low band', () => {
    const r = scoreTriage({ ...base, symptoms: ['burning'], triggers: ['meals'], severity: 3 });
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
      symptoms: ['knee_pain', 'stiffness', 'swelling', 'range', 'numbness'],
      triggers: ['exertion', 'rest', 'meals', 'lying', 'stress', 'cold', 'night'],
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

describe('what the browser now does that it used to skip', () => {
  it('escalates emergency wording in the notes even with mild boxes ticked', () => {
    const r = scoreTriage({ ...base, symptoms: ['burning'], notes: 'crushing chest pain since this morning' });
    expect(r.band).toBe('immediate');
    expect(r.rules).toContain('text:cardiac');
  });

  it('scores a check that has only notes and no ticked symptoms', () => {
    const r = scoreTriage({ ...base, symptoms: [], notes: 'my face is drooping on one side' });
    expect(r.band).toBe('immediate');
  });

  it('fires the at-rest chest rule and the general-region rules the server has', () => {
    expect(scoreTriage({ ...base, symptoms: ['pressure'], triggers: ['rest'], severity: 7 }).rules).toContain('cardiac_at_rest');
    expect(scoreTriage({ region: 'general', symptoms: ['weight_loss', 'night_sweats'], triggers: [], severity: 3, duration: 'longer' }).band).toBe('immediate');
    expect(scoreTriage({ region: 'general', symptoms: ['fever'], triggers: [], severity: 9, duration: 'today' }).band).toBe('immediate');
  });

  it('says why a single red-flag symptom escalates', () => {
    const r = scoreTriage({ region: 'abdomen', symptoms: ['blood'], triggers: [], severity: 1, duration: 'today' });
    expect(r.reasons.join(' ')).toMatch(/same-day/i);
  });

  it('does not claim a condition the person never listed', () => {
    const input = { ...base, symptoms: ['burning'], triggers: ['meals'] };
    const plain = considerationsFor(input, scoreTriage(input)).map((f) => f.text).join(' ');
    expect(plain).not.toMatch(/you have listed/);
    const withGerd = considerationsFor({ ...input, conditionIds: ['gerd'] }, scoreTriage(input)).map((f) => f.text).join(' ');
    expect(withGerd).toMatch(/you have listed/);
  });
});

describe('reconciling the server answer', () => {
  const local = { band: 'low', score: 20, redFlag: false, findings: [{ text: 'local' }], breakdown: { symptomScore: 1 } };

  it('never softens: a lower or equal server band only adds the summary', () => {
    const p = mergeServerResult({ ...local, band: 'moderate', score: 40 }, { band: 'low', score: 10, summary: 'ok', citations: [{ id: 'a' }] });
    expect(p.band).toBeUndefined();
    expect(p.summary).toBe('ok');
  });

  it('escalates when the server saw something the browser did not', () => {
    const p = mergeServerResult(local, { band: 'immediate', score: 100, red_flag: true, findings: [{ text: 'server', warn: true }], breakdown: { symptoms: 5, triggers: 0, duration: 8, severity: 12 } });
    expect(p.band).toBe('immediate');
    expect(p.redFlag).toBe(true);
    expect(p.findings[0].text).toBe('server');
    expect(p.breakdown.severityScore).toBe(12);
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
