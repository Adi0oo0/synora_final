import { REGIONS, TRIGGERS, DURATIONS } from '../data/regions.js';
import { screenText } from './redflags.js';

/**
 * Deterministic triage scoring.
 *
 * Determinism is the point: a model that "usually" escalates chest pain is not a
 * safety rail. The language model never decides urgency — it only rewrites the
 * output of this function into plain language. Same input, same band, always.
 * The backend runs the same rules (app/services/triage.py); the two are kept in
 * step by src/test/parity.test.js.
 */

export const BANDS = {
  low: { id: 'low', label: 'Low — keep monitoring', min: 0 },
  moderate: { id: 'moderate', label: 'Moderate — see someone soon', min: 30 },
  immediate: { id: 'immediate', label: 'Immediate care needed', min: 65 },
};

export const BAND_RANK = { low: 0, moderate: 1, immediate: 2 };

export function bandFor(score) {
  if (score >= BANDS.immediate.min) return 'immediate';
  if (score >= BANDS.moderate.min) return 'moderate';
  return 'low';
}

const weightOf = (list, id) => list.find((x) => x.id === id)?.weight ?? 0;

/** Why a single red-flag symptom is treated as an emergency on its own. */
const RED_FLAG_REASONS = {
  droop: 'Facial drooping or slurred speech is a stroke red flag. Call emergency services now — minutes change the outcome.',
  worst_headache: 'A sudden, worst-ever headache needs emergency assessment even if it eases off.',
  radiating: 'Chest pain spreading to the arm or jaw is treated as a possible heart attack until proven otherwise.',
  blood: 'Blood in stool or vomit always needs same-day medical assessment.',
  fainting: 'Fainting or collapse needs urgent in-person assessment.',
};

/** Combination rules that escalate beyond the sum of their parts. */
const ESCALATION_RULES = [
  {
    id: 'cardiac_exertional',
    test: ({ region, symptoms, triggers }) =>
      region === 'chest' && symptoms.includes('pressure') && (symptoms.includes('breath') || triggers.includes('exertion')),
    reason: 'Chest pressure together with breathlessness or exertion is treated as an emergency pattern, not a wait-and-see combination.',
  },
  {
    id: 'cardiac_at_rest',
    test: ({ region, symptoms, triggers, severity }) =>
      region === 'chest' && symptoms.includes('pressure') && triggers.includes('rest') && severity >= 6,
    reason: 'Significant chest pressure occurring at rest needs urgent assessment.',
  },
  {
    id: 'acute_abdomen',
    test: ({ region, symptoms, severity }) => region === 'abdomen' && symptoms.includes('rigid') && severity >= 7,
    reason: 'A rigid, severely painful abdomen needs urgent in-person assessment.',
  },
  {
    id: 'systemic_infection',
    test: ({ region, symptoms, severity }) => region === 'general' && symptoms.includes('fever') && severity >= 8,
    reason: 'High fever with severe illness needs same-day assessment.',
  },
  {
    id: 'red_flag_combo',
    test: ({ symptoms }) => symptoms.includes('weight_loss') && symptoms.includes('night_sweats'),
    reason: 'Unintentional weight loss with night sweats should be reviewed by a clinician promptly.',
  },
];

/**
 * @param {{region: string, symptoms?: string[], triggers?: string[], severity?: number, duration?: string, notes?: string}} input
 * @returns {{score: number, band: string, redFlag: boolean, reasons: string[], rules: string[], breakdown: object}}
 */
export function scoreTriage(input) {
  const { region, symptoms = [], triggers = [], severity = 1, duration = 'days', notes = '' } = input;
  const catalogue = REGIONS[region]?.symptoms ?? [];

  let symptomScore = 0;
  let redFlag = false;
  const reasons = [];
  const rules = [];

  for (const s of catalogue) {
    if (!symptoms.includes(s.id)) continue;
    symptomScore += s.weight;
    if (s.redFlag) {
      redFlag = true;
      if (RED_FLAG_REASONS[s.id]) reasons.push(RED_FLAG_REASONS[s.id]);
    }
  }

  const triggerScore = triggers.reduce((sum, id) => sum + weightOf(TRIGGERS, id), 0);
  const durationScore = weightOf(DURATIONS, duration) || 8;
  const severityScore = severity * 3;

  for (const rule of ESCALATION_RULES) {
    if (rule.test({ region, symptoms, triggers, severity })) {
      redFlag = true;
      rules.push(rule.id);
      reasons.push(rule.reason);
    }
  }

  // Free text is screened too: the notes box is where people describe what the
  // tick-boxes could not.
  const text = screenText(notes);
  if (text.triggered) {
    redFlag = true;
    rules.push(...text.categories.map((c) => `text:${c}`));
    reasons.push(...text.reasons);
  }

  const raw = symptomScore + triggerScore + durationScore + severityScore;
  const score = redFlag ? 100 : Math.max(0, Math.min(100, raw));

  return {
    score,
    band: bandFor(score),
    redFlag,
    reasons,
    rules,
    breakdown: { symptomScore, triggerScore, durationScore, severityScore },
  };
}

/**
 * Discussion points, never diagnoses. Wording matters here.
 * Statements about the person's own conditions only appear if they listed them.
 */
export function considerationsFor(input, result) {
  const { region, symptoms = [], triggers = [], conditionIds = [] } = input;
  const has = (id) => symptoms.includes(id);
  const trig = (id) => triggers.includes(id);
  const cond = (id) => conditionIds.includes(id);
  const out = result.reasons.map((text) => ({ text, warn: true }));

  if (region === 'chest') {
    if (has('burning') && (trig('meals') || trig('lying')))
      out.push({
        text: cond('gerd')
          ? 'Burning that follows meals or lying down fits the reflux you have listed. Worth raising, not worth panicking over.'
          : 'Burning that follows meals or lying down is often reflux. Worth raising if it keeps coming back.',
      });
    if (has('palpitations'))
      out.push({ text: 'Note when the palpitations happen and, if you have a monitor, your heart rate at the time. That is what a clinician will ask.' });
    if (has('cough') && trig('night'))
      out.push({ text: 'A night cough can be reflux reaching the throat rather than a chest problem. Mention both to the clinician.' });
  }
  if (region === 'abdomen') {
    if (has('upper_pain') && trig('meals'))
      out.push({ text: cond('gerd') ? 'Upper abdominal pain after eating belongs in the same conversation as your reflux.' : 'Upper abdominal pain after eating is worth mentioning to a clinician if it repeats.' });
    if (has('nausea') && has('bloating') && cond('t2d'))
      out.push({ text: 'Nausea with bloating can follow slow stomach emptying, which is more common with long-standing diabetes. Mention the pairing.' });
  }
  if (region === 'head' && (has('dizzy') || has('blurred')))
    out.push({
      text: cond('t2d') || cond('htn')
        ? 'Dizziness and vision changes track with both blood sugar and blood pressure swings. Check both before your next log.'
        : 'Dizziness and vision changes can follow blood pressure or blood sugar swings. If you have a home monitor, check both.',
    });
  if (region === 'joints') {
    if (has('swelling'))
      out.push({ text: 'A hot, swollen joint is worth seeing within a day or two rather than resting and watching.' });
    if (has('numbness'))
      out.push({ text: cond('t2d') ? 'Numbness in the feet or legs sits on the diabetic review checklist. Flag it at your next appointment.' : 'Numbness or pins and needles that keep returning are worth mentioning to a clinician.' });
  }
  if (region === 'general') {
    if (has('fever'))
      out.push({ text: 'A fever that lasts more than a few days, or comes back after settling, is worth a clinician\'s look.' });
    if (has('weight_loss'))
      out.push({ text: 'Weight loss you did not plan is worth raising even when nothing else hurts.' });
  }

  if (!out.length)
    out.push({ text: 'Nothing in this combination matches an escalation rule. Keep logging so the pattern has something to sit against.' });

  return out;
}

export function nextStepFor(band) {
  if (band === 'immediate')
    return {
      title: 'Get emergency care now',
      body: 'Call your local emergency number or go to the nearest emergency department. Do not drive yourself.',
      tone: 'crimson',
    };
  if (band === 'moderate')
    return {
      title: 'Book a consult in the next 24 to 48 hours',
      body: 'Take this summary with you — the Care team page can copy it. Come sooner if anything sharpens or spreads.',
      tone: 'sand',
    };
  return {
    title: 'Self-care and monitoring look reasonable',
    body: 'Log again tonight. Come back sooner if anything sharpens, spreads, or wakes you up.',
    tone: 'sage',
  };
}

/**
 * Folds the backend's answer into a result the browser already scored.
 * The band can only go up: if the server saw something the local rules did not
 * (a wording the text screen missed, say) the result is escalated; it is never
 * softened. The plain-language summary and citations are always taken.
 */
export function mergeServerResult(local, server) {
  const patch = { summary: server.summary ?? null, citations: server.citations ?? [], source: 'server' };
  if ((BAND_RANK[server.band] ?? 0) > (BAND_RANK[local.band] ?? 0)) {
    return {
      ...patch,
      band: server.band,
      score: server.score,
      redFlag: Boolean(server.red_flag),
      findings: server.findings?.length ? server.findings : local.findings,
      breakdown: server.breakdown
        ? {
            symptomScore: server.breakdown.symptoms ?? 0,
            triggerScore: server.breakdown.triggers ?? 0,
            durationScore: server.breakdown.duration ?? 0,
            severityScore: server.breakdown.severity ?? 0,
          }
        : local.breakdown,
    };
  }
  return patch;
}

/** Routes free text to a page. Deterministic, keyword-first, no model call. */
export function routeQuery(text = '') {
  const q = text.toLowerCase().trim();
  if (!q) return null;
  const map = [
    { to: '/triage', keys: ['pain', 'ache', 'headache', 'chest', 'dizzy', 'nausea', 'symptom', 'knee', 'swollen', 'breath'] },
    { to: '/nutrition', keys: ['eat', 'food', 'meal', 'rice', 'ramen', 'sodium', 'carb', 'sugar', 'toast', 'coffee', 'calorie'] },
    { to: '/vitals', keys: ['heart rate', 'hrv', 'glucose', 'sleep', 'anomaly', 'wearable', 'bpm', 'blood pressure', 'weight'] },
    { to: '/care', keys: ['doctor', 'medicine', 'medication', 'pill', 'appointment', 'interaction', 'clinician'] },
    { to: '/library', keys: ['read', 'article', 'screening', 'checkup', 'prevent'] },
  ];
  for (const row of map) if (row.keys.some((k) => q.includes(k))) return row.to;
  return null;
}
