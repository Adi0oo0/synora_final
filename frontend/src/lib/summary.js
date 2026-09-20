import { CONDITIONS } from '../data/conditions.js';
import { METRICS } from '../data/metrics.js';
import { REGIONS, TRIGGERS, DURATIONS } from '../data/regions.js';
import { BANDS } from './triage.js';
import { dateTimeLabel } from './dates.js';
import { findAnomalies, latestReading } from './insights.js';

const label = (list, id) => list.find((x) => x.id === id)?.label ?? id;

/** Plain-text hand-over for a clinician, built only from what the person has entered. */
export function buildClinicianSummary(state) {
  const { profile } = state;
  const lines = [];
  const who = [profile.name, profile.age ? `${profile.age} years` : null].filter(Boolean).join(', ');
  lines.push(`Health summary${who ? ` — ${who}` : ''}`);
  lines.push(`Prepared ${dateTimeLabel(new Date().toISOString())}. Self-reported, not a medical record.`);
  lines.push('');

  lines.push('Conditions');
  lines.push(profile.conditionIds.length ? profile.conditionIds.map((id) => `- ${CONDITIONS[id]?.label ?? id}`).join('\n') : '- None listed');
  lines.push('');

  lines.push('Medicines');
  lines.push(state.medications.length ? state.medications.map((m) => `- ${m.name} ${m.dose}${m.schedule ? `, ${m.schedule}` : ''}`).join('\n') : '- None listed');
  lines.push('');

  const check = state.triage.at(-1);
  lines.push('Latest symptom check');
  if (check) {
    const region = REGIONS[check.input.region];
    const symptoms = check.input.symptoms.map((id) => region?.symptoms.find((s) => s.id === id)?.label ?? id);
    lines.push(`- ${dateTimeLabel(check.at)} · ${region?.label ?? check.input.region} · ${BANDS[check.band].label} (score ${check.score}/100)`);
    lines.push(`- Symptoms: ${symptoms.join(', ') || 'none ticked'}`);
    lines.push(`- Severity ${check.input.severity}/10, duration: ${label(DURATIONS, check.input.duration)}`);
    if (check.input.triggers.length) lines.push(`- Set off by: ${check.input.triggers.map((t) => label(TRIGGERS, t)).join(', ')}`);
    if (check.input.notes) lines.push(`- In their words: "${check.input.notes}"`);
  } else {
    lines.push('- None recorded');
  }
  lines.push('');

  lines.push('Latest readings');
  const readings = Object.values(METRICS)
    .map((m) => ({ m, r: latestReading(state.vitals, m.id) }))
    .filter((x) => x.r);
  lines.push(
    readings.length
      ? readings.map(({ m, r }) => `- ${m.label}: ${m.dual && r.v2 != null ? `${r.v}/${r.v2}` : r.v} ${m.unit} (${dateTimeLabel(r.at)})`).join('\n')
      : '- None logged',
  );

  const flagged = findAnomalies(state.vitals, state.settings.detector).slice(0, 5);
  if (flagged.length) {
    lines.push('');
    lines.push('Unusual windows in their readings');
    for (const f of flagged) {
      const m = METRICS[f.metric];
      lines.push(`- ${m.label}: ${f.anomaly.delta >= 0 ? '+' : ''}${f.anomaly.delta} ${m.unit} vs baseline, ${dateTimeLabel(f.startAt)}`);
    }
  }
  return lines.join('\n');
}
