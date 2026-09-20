/**
 * Optional sign-in, via Firebase Authentication. Nothing loads unless the
 * VITE_FIREBASE_* variables are set (see .env.example), so without them the
 * app is simply local-first and this module is inert.
 *
 * These values identify your Firebase project; they are not secrets, and the
 * backend verifies every ID token itself before touching anyone's data.
 */
const env = import.meta.env ?? {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const cloudConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let loading = null;
function load() {
  if (!loading) {
    loading = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([app, auth]) => {
      const instance = app.getApps().length ? app.getApp() : app.initializeApp(config);
      return { auth: auth.getAuth(instance), api: auth };
    });
  }
  return loading;
}

/** Calls back with { uid, email, name } or null. Returns an unsubscribe function. */
export async function watchAuth(callback) {
  const { auth, api } = await load();
  return api.onAuthStateChanged(auth, (u) => callback(u ? { uid: u.uid, email: u.email, name: u.displayName } : null));
}

export async function getIdToken() {
  const { auth } = await load();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export async function signInWithGoogle() {
  const { auth, api } = await load();
  await api.signInWithPopup(auth, new api.GoogleAuthProvider());
}

export async function signInWithEmail(email, password) {
  const { auth, api } = await load();
  await api.signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email, password) {
  const { auth, api } = await load();
  await api.createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  const { auth, api } = await load();
  await api.signOut(auth);
}

export async function deleteAccount() {
  const { auth, api } = await load();
  if (auth.currentUser) await api.deleteUser(auth.currentUser);
}
