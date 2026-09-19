export const ARTICLES = [
  { id: 'a1', title: 'Reading a glycaemic index label without the guesswork', conditionId: 't2d', minutes: 6, kind: 'Guide' },
  { id: 'a2', title: 'A gentle walk after dinner, and what it does to blood sugar', conditionId: 't2d', minutes: 7, kind: 'Protocol' },
  { id: 'a3', title: 'Foot checks that take ninety seconds', conditionId: 't2d', minutes: 4, kind: 'Checklist' },
  { id: 'a4', title: 'Evening meals and reflux: timing beats restriction', conditionId: 'gerd', minutes: 4, kind: 'Guide' },
  { id: 'a5', title: 'Sleeping on an incline when nothing else has worked', conditionId: 'gerd', minutes: 3, kind: 'Protocol' },
  { id: 'a6', title: 'Most of the salt is in the broth, not the bowl', conditionId: 'htn', minutes: 5, kind: 'Guide' },
  { id: 'a7', title: 'Home blood pressure readings your doctor can actually use', conditionId: 'htn', minutes: 5, kind: 'Checklist' },
];

export const PREVENTIVE = [
  { id: 'p1', task: 'HbA1c blood test', conditionId: 't2d', status: 'soon', due: 'due in 3 weeks' },
  { id: 'p2', task: 'Home blood pressure log', conditionId: 'htn', status: 'ok', due: 'on track' },
  { id: 'p3', task: 'Diabetic eye screening', conditionId: 't2d', status: 'late', due: '5 months overdue' },
  { id: 'p4', task: 'Annual kidney panel', conditionId: 'htn', status: 'ok', due: 'booked 12 Oct' },
  { id: 'p5', task: 'Upper endoscopy review', conditionId: 'gerd', status: 'soon', due: 'discuss at next visit' },
];
