import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PROFILE } from '../data/profile.js';
import { SEED_MEALS } from '../data/foods.js';

const KEY = 'zenhealth.session.v1';

const HealthContext = createContext(null);

const INITIAL = {
  conditionIds: PROFILE.conditionIds,
  log: { mood: 'Steady', severity: 4, savedAt: null },
  meals: SEED_MEALS,
  triage: null,
  callback: null,
  acknowledgedAnomalies: [],
};

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    return saved ? { ...INITIAL, ...saved } : INITIAL;
  } catch {
    return INITIAL;
  }
}

export function HealthProvider({ children }) {
  const [state, setState] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* non-fatal */
    }
  }, [state]);

  const patch = useCallback((next) => setState((s) => ({ ...s, ...next })), []);

  const api = useMemo(
    () => ({
      ...state,
      profile: PROFILE,
      patch,
      saveLog: (log) => patch({ log: { ...log, savedAt: new Date().toISOString() } }),
      setTriage: (triage) => patch({ triage }),
      addMeal: (meal) =>
        setState((s) => ({ ...s, meals: [...s.meals, { id: `m${Date.now()}`, ...meal }] })),
      removeMeal: (id) => setState((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) })),
      toggleCondition: (id) =>
        setState((s) => ({
          ...s,
          conditionIds: s.conditionIds.includes(id)
            ? s.conditionIds.filter((c) => c !== id)
            : [...s.conditionIds, id],
        })),
      requestCallback: (clinicianId) =>
        patch({ callback: { clinicianId, at: new Date().toISOString(), etaMinutes: 3 } }),
      acknowledgeAnomaly: (id) =>
        setState((s) => ({ ...s, acknowledgedAnomalies: [...new Set([...s.acknowledgedAnomalies, id])] })),
      resetSession: () => setState(INITIAL),
    }),
    [state, patch],
  );

  return <HealthContext.Provider value={api}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside HealthProvider');
  return ctx;
}
