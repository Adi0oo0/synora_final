import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setTokenGetter } from '../lib/api.js';
import * as cloud from '../lib/cloud.js';

const AuthContext = createContext(null);

const FRIENDLY = {
  'auth/invalid-credential': 'That email and password do not match.',
  'auth/wrong-password': 'That email and password do not match.',
  'auth/user-not-found': 'That email and password do not match.',
  'auth/email-already-in-use': 'There is already an account with that email. Try signing in instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before it finished.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection.',
};

export function AuthProvider({ children }) {
  const configured = cloud.cloudConfigured;
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!configured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!configured) return undefined;
    let off = () => {};
    let cancelled = false;
    cloud
      .watchAuth((u) => {
        setUser(u);
        setReady(true);
      })
      .then((unsubscribe) => {
        if (cancelled) unsubscribe();
        else off = unsubscribe;
      })
      .catch(() => setReady(true)); // SDK failed to load: stay local-only
    return () => {
      cancelled = true;
      off();
    };
  }, [configured]);

  useEffect(() => {
    setTokenGetter(user ? cloud.getIdToken : null);
    return () => setTokenGetter(null);
  }, [user]);

  const run = useCallback(async (fn) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(FRIENDLY[e?.code] ?? 'Sign-in did not work. Please try again.');
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      configured,
      ready,
      user,
      error,
      signInGoogle: () => run(cloud.signInWithGoogle),
      signIn: (email, password) => run(() => cloud.signInWithEmail(email, password)),
      register: (email, password) => run(() => cloud.registerWithEmail(email, password)),
      signOut: () => run(cloud.signOutUser),
      deleteAccount: () => run(cloud.deleteAccount),
    }),
    [configured, ready, user, error, run],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
