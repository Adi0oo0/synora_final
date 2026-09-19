import { describe, expect, it } from 'vitest';
import { detectAnomalies, anomalySeverity } from '../lib/anomaly.js';

const flat = Array.from({ length: 40 }, (_, t) => ({ t, v: 70 + Math.sin(t) * 0.5 }));

describe('rolling z-score detector', () => {
  it('finds nothing in a steady stream', () => {
    expect(detectAnomalies(flat, { window: 10, threshold: 2.5, minRun: 3 })).toHaveLength(0);
  });

  it('catches a sustained rise', () => {
    const spiked = flat.map((p, i) => (i > 25 ? { ...p, v: p.v + 14 } : p));
    const found = detectAnomalies(spiked, { window: 10, threshold: 2.5, minRun: 3 });
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].direction).toBe('above');
  });

  it('ignores a single blip below the minimum run', () => {
    const blip = flat.map((p, i) => (i === 30 ? { ...p, v: p.v + 20 } : p));
    expect(detectAnomalies(blip, { window: 10, threshold: 2.5, minRun: 3 })).toHaveLength(0);
  });

  it('grades severity by z and duration', () => {
    expect(anomalySeverity({ z: 4.5, samples: 4 })).toBe('warn');
    expect(anomalySeverity({ z: 3.1, samples: 4 })).toBe('caution');
    expect(anomalySeverity({ z: 2.6, samples: 3 })).toBe('info');
  });
});
