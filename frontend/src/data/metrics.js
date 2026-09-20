// What a person can log on the Vitals page. Ranges are sanity limits that catch
// typos (a glucose of 1180, a heart rate of 7), not clinical thresholds.
export const METRICS = {
  bp: { id: 'bp', label: 'Blood pressure', unit: 'mmHg', icon: 'drop', dual: true, min: 40, max: 280, step: 1, hint: 'Systolic over diastolic, e.g. 128 / 82' },
  hr: { id: 'hr', label: 'Heart rate', unit: 'bpm', icon: 'pulse', min: 20, max: 250, step: 1 },
  glucose: { id: 'glucose', label: 'Blood glucose', unit: 'mg/dL', icon: 'flame', min: 20, max: 800, step: 1 },
  spo2: { id: 'spo2', label: 'Blood oxygen', unit: '%', icon: 'drop', min: 50, max: 100, step: 1 },
  hrv: { id: 'hrv', label: 'Heart rate variability', unit: 'ms', icon: 'wave', min: 1, max: 300, step: 1 },
  weight: { id: 'weight', label: 'Weight', unit: 'kg', icon: 'user', min: 20, max: 400, step: 0.1 },
  hba1c: { id: 'hba1c', label: 'HbA1c', unit: '%', icon: 'flame', min: 3, max: 20, step: 0.1 },
};

export const METRIC_IDS = Object.keys(METRICS);

// Readings arrive when a person takes them, not every few seconds, so the
// defaults look at a week of readings and want two in a row before flagging.
export const DETECTOR_DEFAULTS = { window: 7, threshold: 2.5, minRun: 2 };
