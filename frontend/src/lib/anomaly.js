/**
 * Rolling z-score anomaly detection over a series of readings.
 *
 * Deliberately not a model call: it has to be cheap and predictable, and the
 * same readings must always give the same answer.
 *
 * Two details matter with real data:
 *  - While a run is open the baseline is frozen at the moment it opened.
 *    Without that, the anomalous readings drag the rolling mean and spread
 *    towards themselves and a genuine sustained shift stops looking unusual
 *    after two samples.
 *  - The spread has a floor of 2% of the mean, so a stretch of identical
 *    readings (blood pressure typed in as 120/80 five days running) does not
 *    make a one-point change look like an emergency.
 */
const SD_FLOOR = 0.02;

export function detectAnomalies(points = [], opts = {}) {
  const { window = 12, threshold = 2.5, minRun = 3 } = opts;
  const out = [];
  let run = [];
  let frozen = null;
  const maxRun = window * 2; // a shift that lasts this long is the new normal

  const close = () => {
    if (run.length >= minRun) out.push(summarise(run));
    run = [];
    frozen = null;
  };

  for (let i = window; i < points.length; i += 1) {
    let mean;
    let sd;
    if (frozen) {
      ({ mean, sd } = frozen);
    } else {
      const slice = points.slice(i - window, i).map((p) => p.v);
      mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
      sd = Math.max(Math.sqrt(variance), Math.abs(mean) * SD_FLOOR, 0.0001);
    }
    const z = (points[i].v - mean) / sd;

    if (Math.abs(z) >= threshold) {
      if (!run.length) frozen = { mean, sd };
      run.push({ ...points[i], z, mean });
      if (run.length >= maxRun) close();
    } else if (run.length) {
      close();
    }
  }
  close();
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
  return `${sign}${a.delta} ${stream.unit} ${a.direction} baseline across ${a.samples} reading${a.samples === 1 ? '' : 's'} (z ${a.z}).`;
}

/** Anomalies are signals, not verdicts. This decides how loudly to say it. */
export function anomalySeverity(a) {
  if (a.z >= 4 || a.samples >= 10) return 'warn';
  if (a.z >= 3) return 'caution';
  return 'info';
}
