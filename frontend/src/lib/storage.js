import { DEFAULT_TARGETS } from '../data/conditions.js';
import { DETECTOR_DEFAULTS } from '../data/metrics.js';

/**
 * The person's data, and nothing else. A brand-new state is empty: no sample
 * profile, no seeded meals, no generated readings. Everything in here was
 * entered by the person using the app.
 */
export const STATE_VERSION = 2;

export const LIMITS = { logs: 400, meals: 800, triage: 150, vitals: 3000, removed: 500 };

export const makeId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function emptyState() {
  return {
    version: STATE_VERSION,
    profile: {
      name: '',
      age: null,
      city: '',
      conditionIds: [],
      targets: { ...DEFAULT_TARGETS },
      onboarded: false,
      updatedAt: null,
    },
    logs: [], // { date, mood, severity, savedAt } — one per day
    meals: [], // { id, at, label, food }
    triage: [], // symptom checks, oldest first
    vitals: [], // { id, at, metric, value, value2?, note? }
    medications: [], // { id, name, dose, schedule, dosesPerDay, conditionId, taken: { [date]: n } }
    contacts: [], // { id, name, role, phone }
    preventive: {}, // { [taskId]: { lastDone: 'YYYY-MM-DD', updatedAt } }
    settings: { detector: { ...DETECTOR_DEFAULTS } },
    acknowledged: [], // anomaly keys the person has dismissed
    removed: {}, // tombstones { [id]: iso } so deletions survive a sync merge
    updatedAt: null,
  };
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const list = (x, keep) => (Array.isArray(x) ? x.filter((i) => isObj(i) && keep(i)) : []);
const hasId = (i) => typeof i.id === 'string' && i.id;
const num = (v, fallback = null) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : fallback);

/** Accepts anything that came out of storage, the network or a file and returns a valid state. */
export function sanitizeState(raw) {
  const base = emptyState();
  if (!isObj(raw)) return base;

  const p = isObj(raw.profile) ? raw.profile : {};
  const t = isObj(p.targets) ? p.targets : {};
  const d = isObj(raw.settings?.detector) ? raw.settings.detector : {};

  return {
    ...base,
    profile: {
      name: String(p.name ?? '').slice(0, 80),
      age: num(p.age),
      city: String(p.city ?? '').slice(0, 80),
      conditionIds: Array.isArray(p.conditionIds) ? [...new Set(p.conditionIds.filter((c) => typeof c === 'string'))] : [],
      targets: {
        sodiumMg: num(t.sodiumMg, DEFAULT_TARGETS.sodiumMg),
        kcal: num(t.kcal, DEFAULT_TARGETS.kcal),
      },
      onboarded: Boolean(p.onboarded),
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : null,
    },
    logs: list(raw.logs, (l) => typeof l.date === 'string'),
    meals: list(raw.meals, (m) => hasId(m) && isObj(m.food) && typeof m.at === 'string'),
    triage: list(raw.triage, (x) => hasId(x) && isObj(x.input) && typeof x.at === 'string'),
    vitals: list(raw.vitals, (v) => hasId(v) && typeof v.metric === 'string' && Number.isFinite(Number(v.value)) && typeof v.at === 'string'),
    medications: list(raw.medications, hasId).map((m) => ({ ...m, taken: isObj(m.taken) ? m.taken : {} })),
    contacts: list(raw.contacts, hasId),
    preventive: isObj(raw.preventive) ? raw.preventive : {},
    settings: {
      detector: {
        window: num(d.window, DETECTOR_DEFAULTS.window),
        threshold: num(d.threshold, DETECTOR_DEFAULTS.threshold),
        minRun: num(d.minRun, DETECTOR_DEFAULTS.minRun),
      },
    },
    acknowledged: Array.isArray(raw.acknowledged) ? raw.acknowledged.filter((k) => typeof k === 'string') : [],
    removed: isObj(raw.removed) ? raw.removed : {},
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
}

const byAt = (a, b) => String(a.at).localeCompare(String(b.at));
const newer = (a, b, field = 'updatedAt') => (String(b?.[field] ?? '') > String(a?.[field] ?? '') ? b : a);

function unionById(a, b, removed) {
  const map = new Map();
  for (const item of [...a, ...b]) {
    if (removed[item.id]) continue;
    map.set(item.id, map.has(item.id) ? newer(map.get(item.id), item) : item);
  }
  return [...map.values()];
}

/** Keeps the newest entries when a list outgrows its cap. */
export function trimState(state) {
  const tail = (xs, n) => (xs.length > n ? xs.slice(xs.length - n) : xs);
  const removedIds = Object.keys(state.removed);
  const removed =
    removedIds.length > LIMITS.removed
      ? Object.fromEntries(Object.entries(state.removed).sort((x, y) => String(x[1]).localeCompare(String(y[1]))).slice(-LIMITS.removed))
      : state.removed;
  return {
    ...state,
    logs: tail(state.logs, LIMITS.logs),
    meals: tail(state.meals, LIMITS.meals),
    triage: tail(state.triage, LIMITS.triage),
    vitals: tail(state.vitals, LIMITS.vitals),
    removed,
  };
}

/**
 * Combines two copies of one person's data (this device and the account copy).
 * Lists are unioned by id, per-day records keep the newer save, and anything
 * the person deleted on either side stays deleted.
 */
export function mergeStates(a, b) {
  const x = sanitizeState(a);
  const y = sanitizeState(b);
  const removed = { ...x.removed, ...y.removed };

  const logs = new Map();
  for (const l of [...x.logs, ...y.logs]) {
    const cur = logs.get(l.date);
    logs.set(l.date, !cur || String(l.savedAt ?? '') > String(cur.savedAt ?? '') ? l : cur);
  }

  const meds = new Map();
  for (const m of [...x.medications, ...y.medications]) {
    if (removed[m.id]) continue;
    const cur = meds.get(m.id);
    if (!cur) {
      meds.set(m.id, m);
      continue;
    }
    const taken = { ...cur.taken };
    for (const [day, n] of Object.entries(m.taken)) taken[day] = Math.max(taken[day] ?? 0, n);
    meds.set(m.id, { ...newer(cur, m), taken });
  }

  const preventive = { ...x.preventive };
  for (const [id, entry] of Object.entries(y.preventive)) {
    preventive[id] = preventive[id] ? newer(preventive[id], entry) : entry;
  }

  const primary = String(y.updatedAt ?? '') > String(x.updatedAt ?? '') ? y : x;
  const profile = (() => {
    // Newer edit wins. With no timestamp on either side (a profile that was only
    // ever filled in on one device), the one that holds more information wins,
    // so merging an empty copy can never blank out a real one.
    const weight = (p) => (p.name ? 1 : 0) + (p.age != null ? 1 : 0) + (p.city ? 1 : 0) + p.conditionIds.length;
    const [xt, yt] = [String(x.profile.updatedAt ?? ''), String(y.profile.updatedAt ?? '')];
    const winner = xt !== yt ? (yt > xt ? y.profile : x.profile) : weight(y.profile) > weight(x.profile) ? y.profile : x.profile;
    const loser = winner === x.profile ? y.profile : x.profile;
    return { ...winner, onboarded: winner.onboarded || loser.onboarded };
  })();

  return trimState({
    ...primary,
    version: STATE_VERSION,
    profile,
    logs: [...logs.values()].sort((p, q) => p.date.localeCompare(q.date)),
    meals: unionById(x.meals, y.meals, removed).sort(byAt),
    triage: unionById(x.triage, y.triage, removed).sort(byAt),
    vitals: unionById(x.vitals, y.vitals, removed).sort(byAt),
    medications: [...meds.values()],
    contacts: unionById(x.contacts, y.contacts, removed),
    preventive,
    acknowledged: [...new Set([...x.acknowledged, ...y.acknowledged])],
    removed,
    updatedAt: [x.updatedAt, y.updatedAt].filter(Boolean).sort().pop() ?? null,
  });
}

/** JSON with sorted keys, so two equal states always serialise identically. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObj(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** True when nothing has ever been entered. */
export function isBlank(state) {
  const s = sanitizeState(state);
  return (
    !s.profile.onboarded &&
    !s.profile.name &&
    !s.profile.conditionIds.length &&
    !s.logs.length &&
    !s.meals.length &&
    !s.triage.length &&
    !s.vitals.length &&
    !s.medications.length &&
    !s.contacts.length &&
    !Object.keys(s.preventive).length
  );
}

// ── browser storage ────────────────────────────────────────────────────────
// One key per account, plus one for someone who has not signed in, so two
// people sharing a browser never see each other's data.
const PREFIX = 'zenhealth.state.v2';
export const stateKey = (uid) => `${PREFIX}.${uid || 'guest'}`;

export function readLocal(uid, storage = globalThis.localStorage) {
  try {
    return sanitizeState(JSON.parse(storage.getItem(stateKey(uid)) || 'null'));
  } catch {
    return emptyState();
  }
}

/** @returns {boolean} false when the browser refused the write (quota, private mode). */
export function writeLocal(uid, state, storage = globalThis.localStorage) {
  try {
    storage.setItem(stateKey(uid), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearLocal(uid, storage = globalThis.localStorage) {
  try {
    storage.removeItem(stateKey(uid));
  } catch {
    /* nothing to clear */
  }
}

/** The v1 session held sample data from earlier builds. It is not migrated. */
export function dropLegacySession(storage = globalThis.localStorage) {
  try {
    storage.removeItem('zenhealth.session.v1');
  } catch {
    /* ignore */
  }
}
