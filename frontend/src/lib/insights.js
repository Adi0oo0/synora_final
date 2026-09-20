import { METRICS, DETECTOR_DEFAULTS } from '../data/metrics.js';
import { PREVENTIVE } from '../data/preventive.js';
import { detectAnomalies, anomalySeverity } from './anomaly.js';
import { dayTotals } from './nutrition.js';
import { addDays, daysBetween, isToday, localDate } from './dates.js';

/** A metric's readings, oldest first, as { t, v, at, id } — the shape the detector reads. */
export function seriesFor(vitals, metric) {
  return vitals
    .filter((v) => v.metric === metric)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .map((v, t) => ({ t, v: Number(v.value), v2: v.value2 == null ? null : Number(v.value2), at: v.at, id: v.id }));
}

export const latestReading = (vitals, metric) => seriesFor(vitals, metric).at(-1) ?? null;

export const anomalyKey = (metric, startAt) => `${metric}:${startAt}`;

/** Every flagged window across the person's own readings, newest first. */
export function findAnomalies(vitals, settings = DETECTOR_DEFAULTS) {
  const found = [];
  for (const metric of Object.keys(METRICS)) {
    const points = seriesFor(vitals, metric);
    for (const a of detectAnomalies(points, settings)) {
      const startAt = points[a.startIndex].at;
      found.push({
        metric,
        anomaly: a,
        severity: anomalySeverity(a),
        startAt,
        endAt: points[a.endIndex].at,
        key: anomalyKey(metric, startAt),
      });
    }
  }
  return found.sort((a, b) => String(b.endAt).localeCompare(String(a.endAt)));
}

export const todayMeals = (meals) => meals.filter((m) => isToday(m.at));
export const todayTotals = (meals) => dayTotals(todayMeals(meals));

/** Status of one recommended check-up, given what the person has told us and logged. */
export function preventiveStatus(template, state, today = localDate()) {
  let lastDone = state.preventive[template.id]?.lastDone ?? null;
  if (template.auto) {
    const r = latestReading(state.vitals, template.auto);
    const logged = r ? localDate(r.at) : null;
    if (logged && (!lastDone || logged > lastDone)) lastDone = logged;
  }
  if (!lastDone) return { status: 'unset', label: 'Tell us when you last had it', lastDone: null, dueOn: null };

  const dueOn = addDays(lastDone, template.everyDays);
  const left = daysBetween(today, dueOn);
  if (left < 0) return { status: 'late', label: `overdue by ${describeDays(-left)}`, lastDone, dueOn };
  if (left <= 30) return { status: 'soon', label: left === 0 ? 'due today' : `due in ${describeDays(left)}`, lastDone, dueOn };
  return { status: 'ok', label: `next due ${dueOn}`, lastDone, dueOn };
}

function describeDays(n) {
  if (n < 14) return `${n} day${n === 1 ? '' : 's'}`;
  if (n < 60) return `${Math.round(n / 7)} weeks`;
  return `${Math.round(n / 30)} months`;
}

export function preventiveFor(state) {
  return PREVENTIVE.filter((t) => state.profile.conditionIds.includes(t.conditionId)).map((t) => ({
    ...t,
    ...preventiveStatus(t, state),
  }));
}

/**
 * Things that deserve a look, derived from what the person has logged. Nothing
 * is stored: if the data changes, so does the list.
 * @returns {{id: string, warn: boolean, text: string, to: string}[]}
 */
export function buildNotifications(state, now = new Date()) {
  const out = [];
  const cutoff = new Date(now.getTime() - 14 * 86400000).toISOString();

  for (const f of findAnomalies(state.vitals, state.settings.detector)) {
    if (state.acknowledged.includes(f.key) || f.endAt < cutoff || f.severity === 'info') continue;
    const m = METRICS[f.metric];
    out.push({
      id: `anomaly:${f.key}`,
      warn: f.severity === 'warn',
      to: '/vitals',
      text: `${m.label} ran ${Math.abs(f.anomaly.delta)} ${m.unit} ${f.anomaly.direction} your recent baseline across ${f.anomaly.samples} readings.`,
    });
  }

  const last = state.triage.at(-1);
  if (last && last.band !== 'low' && now - new Date(last.at) < 48 * 3600000) {
    out.push({
      id: `triage:${last.id}`,
      warn: last.band === 'immediate',
      to: '/triage',
      text:
        last.band === 'immediate'
          ? 'Your last symptom check came back as needing immediate care.'
          : 'Your last symptom check suggested seeing someone within a day or two.',
    });
  }

  const totals = todayTotals(state.meals);
  const target = state.profile.targets.sodiumMg;
  if (target && totals.sodium >= target) {
    out.push({ id: 'sodium', warn: false, to: '/nutrition', text: `Sodium today is ${totals.sodium.toLocaleString()} mg against a ${target.toLocaleString()} mg target.` });
  }

  const late = preventiveFor(state).filter((t) => t.status === 'late');
  if (late.length) {
    out.push({ id: 'preventive', warn: false, to: '/library', text: `${late.length} check-up${late.length > 1 ? 's are' : ' is'} overdue: ${late.map((t) => t.task).join(', ')}.` });
  }
  return out;
}
