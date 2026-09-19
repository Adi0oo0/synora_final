import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'zenhealth.prefs.v1';
const DEFAULTS = { theme: 'system', contrast: 'normal', motion: 'full', textScale: 'comfortable' };

const PreferencesContext = createContext(null);

function read() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(read);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', prefs.theme);
    root.setAttribute('data-contrast', prefs.contrast);
    root.setAttribute('data-motion', prefs.motion);
    root.setAttribute('data-text', prefs.textScale);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage blocked — preferences stay for this session only */
    }
  }, [prefs]);

  const set = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  const reset = useCallback(() => setPrefs({ ...DEFAULTS }), []);

  const value = useMemo(() => ({ prefs, set, reset }), [prefs, set, reset]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
