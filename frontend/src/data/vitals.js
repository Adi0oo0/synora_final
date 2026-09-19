// Synthetic wearable stream. Replace `fetchStream` with your Kafka/Flink tap —
// the anomaly detector in src/lib/anomaly.js only needs {t, v} pairs.
function series(base, spread, count, spikeAt, spikeBy, seed = 7) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, (_, i) => {
    const drift = Math.sin(i / 6) * spread * 0.4;
    const noise = (rand() - 0.5) * spread;
    let v = base + drift + noise;
    if (spikeAt != null && i >= spikeAt) v += spikeBy * Math.min(1, (i - spikeAt + 1) / 4);
    return { t: i, v: Math.round(v * 10) / 10 };
  });
}

export const STREAMS = [
  {
    id: 'hr',
    label: 'Heart rate',
    unit: 'bpm',
    baseline: 74,
    icon: 'pulse',
    points: series(74, 5, 48, 38, 13),
  },
  {
    id: 'hrv',
    label: 'Heart rate variability',
    unit: 'ms',
    baseline: 46,
    icon: 'wave',
    points: series(46, 7, 48, null, 0, 19),
  },
  {
    id: 'spo2',
    label: 'Blood oxygen',
    unit: '%',
    baseline: 97,
    icon: 'drop',
    points: series(97, 1.2, 48, null, 0, 31),
  },
  {
    id: 'glucose',
    label: 'Interstitial glucose',
    unit: 'mg/dL',
    baseline: 118,
    icon: 'flame',
    points: series(118, 12, 48, 30, 42, 53),
  },
];

export const STREAM_BY_ID = Object.fromEntries(STREAMS.map((s) => [s.id, s]));

export const DETECTOR_DEFAULTS = { window: 12, threshold: 2.5, minRun: 3 };
