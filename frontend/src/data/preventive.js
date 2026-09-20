// Commonly recommended check-ups per condition. Intervals are typical, not
// personal: the page says so, and the person's clinician always wins.
// `auto` ties a task to a vitals metric so logging a reading counts as doing it.
export const PREVENTIVE = [
  { id: 'hba1c', task: 'HbA1c blood test', conditionId: 't2d', everyDays: 90, auto: 'hba1c', note: 'Usually every 3 to 6 months.' },
  { id: 'eye', task: 'Diabetic eye screening', conditionId: 't2d', everyDays: 365, note: 'Usually once a year.' },
  { id: 'foot', task: 'Foot examination', conditionId: 't2d', everyDays: 365, note: 'Usually once a year, sooner if you notice numbness or sores.' },
  { id: 'kidney', task: 'Kidney panel (eGFR and urine albumin)', conditionId: 't2d', everyDays: 365, note: 'Usually once a year.' },
  { id: 'bp', task: 'Blood pressure reading', conditionId: 'htn', everyDays: 7, auto: 'bp', note: 'A weekly reading gives your clinician a trend to work with.' },
  { id: 'lipids', task: 'Cholesterol panel', conditionId: 'htn', everyDays: 365, note: 'Usually once a year.' },
  { id: 'ppi-review', task: 'Review long-term reflux medication with a clinician', conditionId: 'gerd', everyDays: 365, note: 'Worth revisiting at least yearly.' },
];
