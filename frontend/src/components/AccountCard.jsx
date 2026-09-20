import { useState } from 'react';
import { Card, Button, Alert } from './Primitives.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useHealth } from '../state/HealthContext.jsx';
import { dateTimeLabel } from '../lib/dates.js';

const STATUS = {
  syncing: 'Syncing…',
  ok: 'Up to date',
  unavailable: 'Saved on this device — the server has no account storage switched on.',
  error: 'Saved on this device — could not reach the server. It will retry.',
};

/** Sign-in and sync status. Renders nothing unless Firebase is configured. */
export default function AccountCard({ compact = false }) {
  const { configured, ready, user, error, signInGoogle, signIn, register, signOut } = useAuth();
  const { persistence } = useHealth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!configured) return null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await (mode === 'signin' ? signIn : register)(email.trim(), password);
    setBusy(false);
  }

  async function leave() {
    setBusy(true);
    await persistence.syncNow(); // last chance to push, before the token goes
    await signOut();
    setBusy(false);
  }

  if (!ready) return <p className="small">Checking sign-in…</p>;

  if (user) {
    const { sync } = persistence;
    return (
      <Card title="Your account" subtitle={user.email ?? user.name ?? 'Signed in'}>
        <div className="stack-3">
          <p className="small">
            {STATUS[sync.status] ?? ''}
            {sync.status === 'ok' && sync.at ? ` · last synced ${dateTimeLabel(sync.at)}` : ''}
          </p>
          <div className="row">
            <Button onClick={() => persistence.syncNow()} disabled={busy || sync.status === 'syncing'}>Sync now</Button>
            <Button variant="ghost" onClick={leave} disabled={busy}>Sign out</Button>
          </div>
        </div>
      </Card>
    );
  }

  const body = (
    <div className="stack-4">
      <p className="small">
        Signing in keeps your log on your account so it follows you between devices. Without it, everything stays in this browser.
      </p>
      <Button variant="solid" onClick={signInGoogle} disabled={busy}>Continue with Google</Button>
      <form className="stack-3" onSubmit={submit}>
        <div className="field">
          <label htmlFor="acct-email">Email</label>
          <input id="acct-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="acct-pass">Password</label>
          <input id="acct-pass" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        {error && <Alert tone="crimson" icon="alert">{error}</Alert>}
        <div className="row">
          <Button type="submit" variant="solid" disabled={busy}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
          <Button variant="ghost" onClick={() => setMode(mode === 'signin' ? 'register' : 'signin')}>
            {mode === 'signin' ? 'I need an account' : 'I already have one'}
          </Button>
        </div>
      </form>
    </div>
  );

  return compact ? body : <Card title="Sign in to sync" subtitle="Optional">{body}</Card>;
}
