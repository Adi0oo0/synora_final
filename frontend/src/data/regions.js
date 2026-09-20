// Symptom catalogue. The ids, weights and red-flag marks mirror the backend's
// catalogue in backend/app/services/triage.py exactly — src/test/parity.test.js
// fails if the two drift, because an id the server does not know is silently
// scored as zero there.
export const REGIONS = {
  head: {
    id: 'head',
    label: 'Head',
    node: { x: 50, y: 11 },
    labelPos: { x: 50, y: 3 },
    symptoms: [
      { id: 'headache', label: 'Headache', weight: 8 },
      { id: 'dizzy', label: 'Dizziness', weight: 12 },
      { id: 'blurred', label: 'Blurred vision', weight: 16 },
      { id: 'light', label: 'Light hurts my eyes', weight: 8 },
      { id: 'droop', label: 'Face drooping or slurred speech', weight: 100, redFlag: true },
      { id: 'worst_headache', label: 'Worst headache of my life, sudden', weight: 100, redFlag: true },
    ],
  },
  chest: {
    id: 'chest',
    label: 'Chest',
    node: { x: 50, y: 31 },
    labelPos: { x: 17, y: 31 },
    symptoms: [
      { id: 'pressure', label: 'Pressure or tightness', weight: 34 },
      { id: 'breath', label: 'Short of breath', weight: 30 },
      { id: 'palpitations', label: 'Racing or skipping beats', weight: 18 },
      { id: 'burning', label: 'Burning behind the breastbone', weight: 8 },
      { id: 'cough', label: "Cough that won't settle", weight: 8 },
      { id: 'radiating', label: 'Pain spreading to arm or jaw', weight: 100, redFlag: true },
    ],
  },
  abdomen: {
    id: 'abdomen',
    label: 'Abdomen',
    node: { x: 50, y: 44 },
    labelPos: { x: 84, y: 44 },
    symptoms: [
      { id: 'nausea', label: 'Nausea', weight: 10 },
      { id: 'bloating', label: 'Bloated after eating', weight: 6 },
      { id: 'upper_pain', label: 'Pain under the ribs', weight: 18 },
      { id: 'reflux', label: 'Reflux when lying down', weight: 8 },
      { id: 'rigid', label: 'Belly hard and painful to touch', weight: 34 },
      { id: 'blood', label: 'Blood in stool or vomit', weight: 100, redFlag: true },
    ],
  },
  joints: {
    id: 'joints',
    label: 'Joints',
    node: { x: 37, y: 74 },
    labelPos: { x: 14, y: 74 },
    symptoms: [
      { id: 'knee_pain', label: 'Joint pain on movement', weight: 8 },
      { id: 'stiffness', label: 'Morning stiffness', weight: 8 },
      { id: 'swelling', label: 'Swollen or warm to touch', weight: 16 },
      { id: 'range', label: "Can't bend it fully", weight: 10 },
      { id: 'numbness', label: 'Numbness or pins and needles', weight: 18 },
    ],
  },
  // Not on the body map: whole-body symptoms are picked from the chips.
  general: {
    id: 'general',
    label: 'Whole body',
    symptoms: [
      { id: 'fever', label: 'Fever', weight: 16 },
      { id: 'fatigue', label: 'Unusual tiredness', weight: 8 },
      { id: 'weight_loss', label: 'Weight loss without trying', weight: 22 },
      { id: 'night_sweats', label: 'Night sweats', weight: 18 },
      { id: 'fainting', label: 'Fainting or collapse', weight: 100, redFlag: true },
    ],
  },
};

export const REGION_IDS = Object.keys(REGIONS);
export const MAP_REGION_IDS = REGION_IDS.filter((id) => REGIONS[id].node);

export const TRIGGERS = [
  { id: 'exertion', label: 'Physical exertion', weight: 14 },
  { id: 'rest', label: 'Happens at rest', weight: 10 },
  { id: 'meals', label: 'After meals', weight: 4 },
  { id: 'lying', label: 'Lying down', weight: 4 },
  { id: 'stress', label: 'Stress', weight: 5 },
  { id: 'cold', label: 'Cold air', weight: 2 },
  { id: 'night', label: 'Wakes me at night', weight: 8 },
];

export const DURATIONS = [
  { id: 'today', label: 'Less than a day', weight: 4 },
  { id: 'days', label: '1 to 3 days', weight: 8 },
  { id: 'week', label: '4 to 7 days', weight: 12 },
  { id: 'longer', label: 'More than a week', weight: 16 },
];

export const RED_FLAG_SCREEN = [
  'Chest pain or pressure that spreads to the arm, jaw or back',
  'Too breathless to finish a sentence',
  'Sudden weakness, drooping face or slurred speech',
  'Fainting, or bleeding that will not stop',
  'The worst headache of my life, starting suddenly',
  'A new inability to move or feel a limb',
];
