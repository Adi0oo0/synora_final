/**
 * Rolling z-score anomaly detection for wearable streams.
 *
 * Deliberately not a model call: this runs on every sample at the edge of the
 * stream, so it has to be cheap and predictable. Swap the transport for Kafka
 * or Flink and this function is still the decision rule.
 */
export function detectAnomalies(points = [], opts = {}) {
  const { window = 12, threshold = 2.5, minRun = 3 } = opts;
  const out = [];
  let run = [];

  for (let i = window; i < points.length; i += 1) {
    const slice = points.slice(i - window, i).map((p) => p.v);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    const sd = Math.sqrt(variance) || 0.0001;
    const z = (points[i].v - mean) / sd;

    if (Math.abs(z) >= threshold) {
      run.push({ ...points[i], z, mean });
    } else if (run.length) {
      if (run.length >= minRun) out.push(summarise(run));
      run = [];
    }
  }
  if (run.length >= minRun) out.push(summarise(run));
  return out;
}

function summarise(run) {
  const peak = run.reduce((a, b) => (Math.abs(b.z) > Math.abs(a.z) ? b : a));
  const delta = peak.v - peak.mean;
  return {
    startIndex: run[0].t,
    endIndex: run[run.length - 1].t,
    samples: run.length,
    peakValue: Math.round(peak.v * 10) / 10,
    baseline: Math.round(peak.mean * 10) / 10,
    delta: Math.round(delta * 10) / 10,
    z: Math.round(Math.abs(peak.z) * 10) / 10,
    direction: delta >= 0 ? 'above' : 'below',
  };
}

/** Human sentence for a detection. Kept out of the UI so it can be tested. */
export function describeAnomaly(stream, a) {
  const sign = a.direction === 'above' ? '+' : '';
  return `${sign}${a.delta} ${stream.unit} ${a.direction} baseline for ${a.samples} samples (z ${a.z}).`;
}

/** Anomalies are signals, not verdicts. This decides how loudly to say it. */
export function anomalySeverity(a) {
  if (a.z >= 4 || a.samples >= 10) return 'warn';
  if (a.z >= 3) return 'caution';
  return 'info';
}
