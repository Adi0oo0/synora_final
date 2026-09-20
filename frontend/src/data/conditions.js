// Reference data only: the conditions the app knows how to reason about.
// Nothing here describes a person. Who has which condition is the user's own
// answer, stored in their profile (see state/HealthContext.jsx).
export const CONDITIONS = {
  t2d: {
    id: 't2d',
    label: 'Type 2 diabetes',
    short: 'Diabetes',
    watch: ['glycaemic load', 'foot numbness', 'vision changes'],
  },
  gerd: {
    id: 'gerd',
    label: 'Acid reflux (GERD)',
    short: 'Reflux',
    watch: ['fatty meals', 'late eating', 'lying down after food'],
  },
  htn: {
    id: 'htn',
    label: 'Hypertension',
    short: 'Blood pressure',
    watch: ['sodium', 'alcohol', 'sleep debt'],
  },
};

export const ALL_CONDITION_IDS = Object.keys(CONDITIONS);

// Starting points for the daily targets. The user can change both in Settings.
export const DEFAULT_TARGETS = { sodiumMg: 1500, kcal: 2000 };
