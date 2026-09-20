// @vitest-environment jsdom
/* global HTMLDialogElement, Element */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Sign-in is faked; the "server" is an in-memory account store behind fetch.
let pushAuth;
vi.mock('../lib/cloud.js', () => ({
  cloudConfigured: true,
  watchAuth: async (cb) => {
    pushAuth = cb;
    cb(null);
    return () => {};
  },
  getIdToken: async () => 'token',
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  registerWithEmail: async () => {},
  signOutUser: async () => pushAuth(null),
  deleteAccount: async () => {},
}));

const { default: App } = await import('../App.jsx');
const { AuthProvider } = await import('../state/AuthContext.jsx');
const { HealthProvider } = await import('../state/HealthContext.jsx');
const { PreferencesProvider } = await import('../state/PreferencesContext.jsx');
const { emptyState } = await import('../lib/storage.js');

let account; // what the server holds for the signed-in person (JSON string or null)
let calls;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ||= function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close ||= function close() { this.open = false; };
  Element.prototype.scrollIntoView ||= () => {};
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function serve(initial = null) {
  account = initial;
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const path = String(url);
    calls.push(`${init.method ?? 'GET'} ${path}`);
    if (path.endsWith('/api/me/state') && (init.method ?? 'GET') === 'GET') return { ok: true, json: async () => ({ state: account ? JSON.parse(account) : null }) };
    if (path.endsWith('/api/me/state') && init.method === 'PUT') { account = JSON.stringify(JSON.parse(init.body).state); return { ok: true, json: async () => ({ saved: true }) }; }
    throw new TypeError('offline');
  }));
}

const meal = (id, name) => ({ id, at: new Date().toISOString(), label: '', food: { name, kcal: 100, carbs: 5, sodium: 10 } });
const blankDone = () => ({ ...emptyState(), profile: { ...emptyState().profile, onboarded: true, name: 'Asha' } });

function mount() {
  return render(
    <PreferencesProvider><AuthProvider><HealthProvider><MemoryRouter initialEntries={['/nutrition']}><App /></MemoryRouter></HealthProvider></AuthProvider></PreferencesProvider>,
  );
}

describe('account sync', () => {
  it('brings this device\'s data into the account on sign-in, merges the account copy, and pushes the result', async () => {
    const device = { ...blankDone(), meals: [meal('m_device', 'Poha')], updatedAt: '2026-09-20T09:00:00.000Z' };
    localStorage.setItem('zenhealth.state.v2.guest', JSON.stringify(device));
    serve(JSON.stringify({ ...blankDone(), meals: [meal('m_cloud', 'Idli')], updatedAt: '2026-09-19T09:00:00.000Z' }));
    mount();
    await screen.findByText(/what's on the plate/i);

    await act(async () => pushAuth({ uid: 'u1', email: 'a@x.in', name: 'Asha' }));

    await waitFor(() => {
      const pushed = JSON.parse(account);
      expect(pushed.meals.map((m) => m.food.name).sort()).toEqual(['Idli', 'Poha']);
    });
    expect(await screen.findByText('Poha (as entered)'.replace(' (as entered)', ''), { exact: false })).toBeTruthy();
    // The guest copy moved into the account; the device no longer holds it as "guest".
    expect(localStorage.getItem('zenhealth.state.v2.guest')).toBeNull();
    expect(JSON.parse(localStorage.getItem('zenhealth.state.v2.u1')).meals).toHaveLength(2);
  });

  it('does not push when nothing differs from the account copy', async () => {
    const same = { ...blankDone(), meals: [meal('m1', 'Poha')], updatedAt: '2026-09-20T09:00:00.000Z' };
    localStorage.setItem('zenhealth.state.v2.guest', JSON.stringify(same));
    serve(JSON.stringify(same));
    mount();
    await screen.findByText(/what's on the plate/i);
    await act(async () => pushAuth({ uid: 'u1', email: 'a@x.in' }));
    await waitFor(() => expect(calls).toContain('GET /api/me/state'));
    await new Promise((r) => setTimeout(r, 300));
    expect(calls.filter((c) => c.startsWith('PUT'))).toHaveLength(0);
  });

  it('keeps working on this device when the server has no account storage', async () => {
    localStorage.setItem('zenhealth.state.v2.guest', JSON.stringify(blankDone()));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, text: async () => 'not configured' })));
    mount();
    await screen.findByText(/what's on the plate/i);
    await act(async () => pushAuth({ uid: 'u1' }));
    const user = userEvent.setup();
    await user.click(await screen.findByText(/enter a food by hand/i));
    await user.type(screen.getByLabelText('Name'), 'Upma');
    await user.type(screen.getByLabelText(/calories/i), '200');
    await user.click(screen.getByRole('button', { name: /use this food/i }));
    await user.click(await screen.findByRole('button', { name: /add to today/i }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('zenhealth.state.v2.u1')).meals).toHaveLength(1));
  });

  it('on sign-out keeps the only copy if the account never confirmed it', async () => {
    localStorage.setItem('zenhealth.state.v2.guest', JSON.stringify({ ...blankDone(), meals: [meal('m1', 'Poha')] }));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    mount();
    await screen.findByText(/what's on the plate/i);
    await act(async () => pushAuth({ uid: 'u1' }));
    await waitFor(() => expect(localStorage.getItem('zenhealth.state.v2.u1')).toBeTruthy());
    await act(async () => pushAuth(null));
    expect(JSON.parse(localStorage.getItem('zenhealth.state.v2.u1')).meals).toHaveLength(1);
  });

  it('on sign-out wipes the account cache from the device once the account holds it', async () => {
    const data = { ...blankDone(), meals: [meal('m1', 'Poha')], updatedAt: '2026-09-20T09:00:00.000Z' };
    localStorage.setItem('zenhealth.state.v2.guest', JSON.stringify(data));
    serve(null);
    mount();
    await screen.findByText(/what's on the plate/i);
    await act(async () => pushAuth({ uid: 'u1' }));
    await waitFor(() => expect(account).toBeTruthy());
    await new Promise((r) => setTimeout(r, 100));
    await act(async () => pushAuth(null));
    expect(localStorage.getItem('zenhealth.state.v2.u1')).toBeNull();
    expect(JSON.parse(account).meals).toHaveLength(1); // still safe on the account
  });
});
