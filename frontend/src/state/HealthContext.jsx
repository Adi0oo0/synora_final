import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { DETECTOR_DEFAULTS } from '../data/metrics.js';
import { deleteRemoteData, getRemoteState, putRemoteState } from '../lib/api.js';
import { localDate } from '../lib/dates.js';
import {
  clearLocal,
  dropLegacySession,
  emptyState,
  isBlank,
  makeId,
  mergeStates,
  readLocal,
  sanitizeState,
  stableStringify,
  stateKey,
  trimState,
  writeLocal,
} from '../lib/storage.js';

/**
 * Everything the person enters lives here, and only what they enter.
 *
 * Saving is local-first: every change is written to this browser straight away,
 * so nothing is lost if the network is down or nobody has signed in. When they
 * do sign in (optional), the same data is merged with their account copy and
 * kept in step, so it follows them between devices.
 */
const HealthContext = createContext(null);
const PUSH_DELAY_MS = 1500;

export function HealthProvider({ children }) {
  const { user, ready } = useAuth();
  const uid = user?.uid ?? null;

  // `owner` says whose data `data` is, so a sign-in can never write one
  // person's state under another person's key.
  const [store, setStore] = useState(() => {
    dropLegacySession();
    return { owner: null, data: readLocal(null) };
  });
  const [storageOk, setStorageOk] = useState(true);
  const [sync, setSync] = useState({ status: 'off', at: null, error: null });

  const storeRef = useRef(store);
  storeRef.current = store;
  const lastWritten = useRef(null);
  const pulledFor = useRef(undefined); // uid whose account copy has been merged in
  const syncing = useRef(false);
  const queued = useRef(false); // a change landed while a sync was in flight
  const unavailable = useRef(false); // the server has no account storage: stop retrying
  const syncedSnapshot = useRef(null); // the data as last confirmed on the account

  const setData = useCallback((fn) => {
    setStore((s) => ({ ...s, data: trimState({ ...fn(s.data), updatedAt: new Date().toISOString() }) }));
  }, []);

  // ── keep this browser's copy current ────────────────────────────────────
  useEffect(() => {
    const text = stableStringify(store.data);
    const key = `${store.owner}:${text}`;
    if (lastWritten.current === key) return;
    lastWritten.current = key;
    setStorageOk(writeLocal(store.owner, store.data));
  }, [store]);

  // Another tab changed this person's data: pick it up.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== stateKey(storeRef.current.owner) || !e.newValue) return;
      try {
        const next = sanitizeState(JSON.parse(e.newValue));
        if (stableStringify(next) === stableStringify(storeRef.current.data)) return;
        lastWritten.current = `${storeRef.current.owner}:${stableStringify(next)}`;
        setStore((s) => ({ ...s, data: next }));
      } catch {
        /* ignore malformed writes */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── account sync ────────────────────────────────────────────────────────
  /** Pull, merge, and push only if the merge differs from the account copy. */
  const syncNow = useCallback(async (force = false) => {
    const { owner } = storeRef.current;
    if (!owner || (unavailable.current && !force)) return;
    if (syncing.current) {
      queued.current = true;
      return;
    }
    syncing.current = true;
    unavailable.current = false;
    setSync((s) => ({ ...s, status: 'syncing' }));
    try {
      const remote = await getRemoteState();
      if (!remote.ok) {
        unavailable.current = remote.unavailable;
        setSync({ status: remote.unavailable ? 'unavailable' : 'error', at: null, error: remote.error });
        return;
      }
      const local = storeRef.current.data;
      const merged = remote.state ? mergeStates(local, remote.state) : local;
      pulledFor.current = owner;

      if (stableStringify(merged) !== stableStringify(local) && storeRef.current.owner === owner) {
        setStore((s) => (s.owner === owner ? { ...s, data: merged } : s));
      }
      if (!remote.state || stableStringify(merged) !== stableStringify(sanitizeState(remote.state))) {
        const put = await putRemoteState(merged);
        if (!put.ok) {
          unavailable.current = put.unavailable;
          setSync({ status: put.unavailable ? 'unavailable' : 'error', at: null, error: put.error });
          return;
        }
      }
      syncedSnapshot.current = stableStringify(merged);
      setSync({ status: 'ok', at: new Date().toISOString(), error: null });
    } finally {
      syncing.current = false;
      if (queued.current) {
        queued.current = false;
        syncNow();
      }
    }
  }, []);

  // Signing in or out swaps whose data is on screen.
  useEffect(() => {
    if (!ready) return;
    const current = storeRef.current;
    if (current.owner === uid) return;

    if (uid) {
      // This device's guest data comes with the person into their account.
      const guest = current.owner === null ? current.data : readLocal(null);
      const merged = mergeStates(readLocal(uid), guest);
      if (!isBlank(guest)) clearLocal(null);
      pulledFor.current = undefined;
      setStore({ owner: uid, data: merged });
      setSync({ status: 'syncing', at: null, error: null });
    } else {
      // Signed out: nothing of the account stays behind on a shared device —
      // unless the account never confirmed a copy, in which case this browser
      // holds the only one and it is kept for the next sign-in.
      if (syncedSnapshot.current === stableStringify(current.data)) clearLocal(current.owner);
      syncedSnapshot.current = null;
      pulledFor.current = undefined;
      setStore({ owner: null, data: readLocal(null) });
      setSync({ status: 'off', at: null, error: null });
    }
  }, [uid, ready]);

  // First sync after sign-in, then debounced pushes after each change.
  useEffect(() => {
    if (!store.owner) return undefined;
    const first = pulledFor.current !== store.owner;
    const timer = setTimeout(syncNow, first ? 0 : PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [store, syncNow]);

  // Coming back to the tab picks up changes made on another device.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && storeRef.current.owner) syncNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncNow]);

  // ── actions ─────────────────────────────────────────────────────────────
  const actions = useMemo(() => {
    const remove = (key, id) =>
      setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id), removed: { ...d.removed, [id]: new Date().toISOString() } }));

    return {
      updateProfile: (patch) =>
        setData((d) => ({ ...d, profile: { ...d.profile, ...patch, targets: { ...d.profile.targets, ...(patch.targets ?? {}) }, updatedAt: new Date().toISOString() } })),
      completeOnboarding: (patch) =>
        setData((d) => ({ ...d, profile: { ...d.profile, ...patch, targets: { ...d.profile.targets, ...(patch.targets ?? {}) }, onboarded: true, updatedAt: new Date().toISOString() } })),
      toggleCondition: (id) =>
        setData((d) => {
          const has = d.profile.conditionIds.includes(id);
          const conditionIds = has ? d.profile.conditionIds.filter((c) => c !== id) : [...d.profile.conditionIds, id];
          return { ...d, profile: { ...d.profile, conditionIds, updatedAt: new Date().toISOString() } };
        }),

      saveLog: ({ mood, severity }) =>
        setData((d) => {
          const date = localDate();
          const entry = { date, mood, severity, savedAt: new Date().toISOString() };
          return { ...d, logs: [...d.logs.filter((l) => l.date !== date), entry] };
        }),

      addMeal: (food, { at = new Date().toISOString(), label = '' } = {}) => {
        const id = makeId('meal');
        setData((d) => ({ ...d, meals: [...d.meals, { id, at, label, food }] }));
        return id;
      },
      removeMeal: (id) => remove('meals', id),

      addTriage: (entry) => setData((d) => ({ ...d, triage: [...d.triage, entry] })),
      updateTriage: (id, patch) => setData((d) => ({ ...d, triage: d.triage.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTriage: (id) => remove('triage', id),

      addVital: ({ metric, value, value2 = null, at = new Date().toISOString(), note = '' }) =>
        setData((d) => ({ ...d, vitals: [...d.vitals, { id: makeId('vit'), metric, value: Number(value), value2: value2 == null ? null : Number(value2), at, note }] })),
      removeVital: (id) => remove('vitals', id),

      addMedication: (med) =>
        setData((d) => ({ ...d, medications: [...d.medications, { id: makeId('med'), taken: {}, dosesPerDay: 1, ...med }] })),
      removeMedication: (id) => remove('medications', id),
      markDose: (id, delta = 1) =>
        setData((d) => {
          const day = localDate();
          return {
            ...d,
            medications: d.medications.map((m) => {
              if (m.id !== id) return m;
              const next = Math.max(0, Math.min(m.dosesPerDay, (m.taken[day] ?? 0) + delta));
              return { ...m, taken: { ...m.taken, [day]: next }, updatedAt: new Date().toISOString() };
            }),
          };
        }),

      addContact: (contact) => setData((d) => ({ ...d, contacts: [...d.contacts, { id: makeId('care'), ...contact }] })),
      removeContact: (id) => remove('contacts', id),

      setPreventiveDone: (taskId, lastDone) =>
        setData((d) => {
          const preventive = { ...d.preventive };
          if (lastDone) preventive[taskId] = { lastDone, updatedAt: new Date().toISOString() };
          else delete preventive[taskId];
          return { ...d, preventive };
        }),

      setDetector: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, detector: { ...d.settings.detector, ...patch } } })),
      resetDetector: () => setData((d) => ({ ...d, settings: { ...d.settings, detector: { ...DETECTOR_DEFAULTS } } })),
      acknowledgeAnomaly: (key) => setData((d) => ({ ...d, acknowledged: [...new Set([...d.acknowledged, key])] })),

      /** Replaces everything with a file's contents, or merges into what is here. */
      importData: (raw, { merge = true } = {}) =>
        setData((d) => (merge ? mergeStates(d, raw) : sanitizeState(raw))),
    };
  }, [setData]);

  /** Erases this person's data here and, if signed in, from their account. */
  const eraseEverything = useCallback(async () => {
    const { owner } = storeRef.current;
    let remoteOk = true;
    if (owner) remoteOk = (await deleteRemoteData()).ok;
    clearLocal(owner);
    lastWritten.current = null;
    setStore((s) => ({ ...s, data: emptyState() }));
    return { remoteOk };
  }, []);

  const value = useMemo(() => {
    const d = store.data;
    return {
      ...d,
      conditionIds: d.profile.conditionIds,
      profile: d.profile,
      latestTriage: d.triage.at(-1) ?? null,
      todayLog: d.logs.find((l) => l.date === localDate()) ?? null,
      ...actions,
      eraseEverything,
      exportData: () => JSON.stringify({ app: 'zenhealth', exportedAt: new Date().toISOString(), state: d }, null, 2),
      persistence: { local: storageOk, sync, syncNow: () => syncNow(true), signedIn: Boolean(store.owner) },
      state: d,
    };
  }, [store, actions, eraseEverything, storageOk, sync, syncNow]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside HealthProvider');
  return ctx;
}
