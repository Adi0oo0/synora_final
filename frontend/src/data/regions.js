// Symptom catalogue. `weight` feeds the deterministic triage score;
// `redFlag: true` short-circuits straight to emergency framing.
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
      { id: 'worstheadache', label: 'Worst headache of my life, sudden', weight: 100, redFlag: true },
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
      { id: 'palps', label: 'Racing or skipping beats', weight: 18 },
      { id: 'burn', label: 'Burning behind the breastbone', weight: 8 },
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
      { id: 'bloat', label: 'Bloated after eating', weight: 6 },
      { id: 'upper', label: 'Pain under the ribs', weight: 18 },
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
      { id: 'knee', label: 'Knee pain on stairs', weight: 8 },
      { id: 'stiff', label: 'Morning stiffness', weight: 8 },
      { id: 'swell', label: 'Swollen or warm to touch', weight: 16 },
      { id: 'range', label: "Can't bend it fully", weight: 10 },
      { id: 'numb', label: 'Numbness or pins and needles', weight: 18 },
    ],
  },
};

export const REGION_IDS = Object.keys(REGIONS);

export const TRIGGERS = [
  { id: 'exertion', label: 'Physical exertion', weight: 14 },
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
