// Sample profile. Swap for your own fetch once the record service exists —
// nothing downstream reads anything but this shape.
export const CONDITIONS = {
  't2d': {
    id: 't2d',
    label: 'Type 2 diabetes',
    short: 'Diabetes',
    since: '2019',
    watch: ['glycaemic load', 'foot numbness', 'vision changes'],
  },
  'gerd': {
    id: 'gerd',
    label: 'Acid reflux (GERD)',
    short: 'Reflux',
    since: '2021',
    watch: ['fatty meals', 'late eating', 'lying down after food'],
  },
  'htn': {
    id: 'htn',
    label: 'Hypertension',
    short: 'Blood pressure',
    since: '2022',
    watch: ['sodium', 'alcohol', 'sleep debt'],
  },
};

export const ALL_CONDITION_IDS = Object.keys(CONDITIONS);

export const PROFILE = {
  name: 'Haruki Maeda',
  shortName: 'Haruki',
  age: 42,
  city: 'Osaka',
  loggingSince: 'March 2026',
  conditionIds: ['t2d', 'gerd', 'htn'],
  targets: {
    sodiumMg: 1500,
    carbsG: 210,
    kcal: 2100,
  },
  vitals: {
    hba1c: '6.8%',
    bp: '134/86',
    restingHr: 74,
    weightKg: 78.4,
  },
};

export const MEDICATIONS = [
  {
    id: 'metformin',
    name: 'Metformin',
    dose: '500 mg',
    schedule: 'With breakfast and dinner',
    dosesPerDay: 2,
    takenToday: 1,
    condition: 't2d',
  },
  {
    id: 'omeprazole',
    name: 'Omeprazole',
    dose: '20 mg',
    schedule: '30 minutes before breakfast',
    dosesPerDay: 1,
    takenToday: 1,
    condition: 'gerd',
  },
  {
    id: 'lisinopril',
    name: 'Lisinopril',
    dose: '10 mg',
    schedule: 'Morning',
    dosesPerDay: 1,
    takenToday: 1,
    condition: 'htn',
  },
];

export const INTERACTIONS = [
  {
    id: 'nsaid-acei',
    severity: 'review',
    title: 'Ibuprofen alongside lisinopril',
    detail:
      'You logged ibuprofen twice last week. Anti-inflammatories can blunt blood pressure medicines and add strain on the kidneys. Nothing to change on your own — ask your pharmacist or Dr. Sato which painkiller suits you.',
  },
];

export const CLINICIANS = [
  { id: 'sato', name: 'Dr. Aya Sato', specialty: 'Internal medicine', status: 'online', wait: '3 mins' },
  { id: 'alvarez', name: 'Dr. Leonel Alvarez', specialty: 'Endocrinology', status: 'soon', wait: '12 mins' },
  { id: 'nurse', name: 'Nurse line', specialty: 'Open around the clock', status: 'online', wait: '1 min' },
];
