// @vitest-environment jsdom
/* global HTMLDialogElement, Element */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../state/AuthContext.jsx';
import { HealthProvider } from '../state/HealthContext.jsx';
import { PreferencesProvider } from '../state/PreferencesContext.jsx';

beforeAll(() => {
  // <dialog> is not implemented in jsdom.
  HTMLDialogElement.prototype.showModal ||= function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close ||= function close() { this.open = false; };
  Element.prototype.scrollIntoView ||= () => {};
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// The backend is "down": every /api call fails, like running with no server.
const offline = () => vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));

function mount(path = '/') {
  return render(
    <PreferencesProvider>
      <AuthProvider>
        <HealthProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </HealthProvider>
      </AuthProvider>
    </PreferencesProvider>,
  );
}

const savedState = () => JSON.parse(localStorage.getItem('zenhealth.state.v2.guest') || 'null');

describe('a first-time visitor', () => {
  it('sees onboarding, and a dashboard with none of the old sample content', async () => {
    offline();
    const user = userEvent.setup();
    mount();
    expect(screen.getByRole('heading', { name: /welcome/i })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(await screen.findByText(/nothing is filled in for you/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Haruki|Osaka|Dr\. Sato|Metformin|06:40|five months overdue/i);
    expect(savedState().profile.onboarded).toBe(true);
  });

  it('keeps their answers and conditions across a reload', async () => {
    offline();
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText(/what should we call you/i), 'Asha');
    await user.click(screen.getByRole('button', { name: 'Type 2 diabetes' }));
    await user.click(screen.getByRole('button', { name: /get started/i }));
    expect(await screen.findByRole('heading', { name: /asha/i })).toBeTruthy();

    cleanup();
    mount();
    expect(await screen.findByRole('heading', { name: /asha/i })).toBeTruthy();
    expect(savedState().profile.conditionIds).toEqual(['t2d']);
  });
});

describe('the symptom check', () => {
  async function toTriage() {
    offline();
    const user = userEvent.setup();
    mount('/triage');
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    return user;
  }

  it('is disabled until something is entered, then scores and saves the result', async () => {
    const user = await toTriage();
    const run = await screen.findByRole('button', { name: /check my symptoms/i });
    expect(run.disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Burning behind the breastbone' }));
    await user.click(screen.getByRole('button', { name: 'After meals' }));
    fireEvent.change(screen.getByLabelText(/severity at its worst/i), { target: { value: '3' } });
    expect(run.disabled).toBe(false);
    await user.click(run);

    expect(await screen.findByText(/what the check found/i)).toBeTruthy();
    expect(screen.getAllByText(/Low — keep monitoring/i).length).toBeGreaterThan(0);
    // Server is unreachable: the on-device result still stands, and says so.
    expect(await screen.findByText(/could not be reached/i)).toBeTruthy();
    expect(savedState().triage).toHaveLength(1);
    expect(savedState().triage[0].band).toBe('low');
  });

  it('escalates emergency wording typed into the notes, offline', async () => {
    const user = await toTriage();
    await user.click(await screen.findByRole('button', { name: 'Burning behind the breastbone' }));
    await user.type(screen.getByLabelText(/anything else worth saying/i), 'crushing chest pain going into my jaw');
    await user.click(screen.getByRole('button', { name: /check my symptoms/i }));
    expect(await screen.findByText(/Get emergency care now/i)).toBeTruthy();
    expect(savedState().triage[0].band).toBe('immediate');
  });

  it('upgrades the band when the server sees something the browser did not', async () => {
    offline();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ band: 'moderate', score: 45, red_flag: false, findings: [{ text: 'server says see someone', warn: true }], summary: 'Plain words.', citations: [], breakdown: { symptoms: 8, triggers: 4, duration: 8, severity: 12 } }),
    })));
    const user = userEvent.setup();
    mount('/triage');
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    await user.click(await screen.findByRole('button', { name: 'Burning behind the breastbone' }));
    await user.click(screen.getByRole('button', { name: /check my symptoms/i }));
    await waitFor(() => expect(savedState().triage[0].band).toBe('moderate'));
    expect(await screen.findByText('Plain words.')).toBeTruthy();
  });

  it('shows earlier checks and lets the person delete one', async () => {
    const user = await toTriage();
    await user.click(await screen.findByRole('button', { name: 'Burning behind the breastbone' }));
    await user.click(screen.getByRole('button', { name: /check my symptoms/i }));
    const history = (await screen.findByText(/your earlier checks/i)).closest('section');
    await user.click(within(history).getByRole('button', { name: /delete the check/i }));
    await waitFor(() => expect(savedState().triage).toHaveLength(0));
  });
});

describe('logging real data', () => {
  it('saves a reading, rejects a typo, and shows it back', async () => {
    offline();
    const user = userEvent.setup();
    mount('/vitals');
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    await user.selectOptions(await screen.findByLabelText(/what did you measure/i), 'hr');

    await user.type(screen.getByLabelText(/^value/i), '7');
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(await screen.findByText(/check for a typo/i)).toBeTruthy();
    expect(savedState().vitals).toHaveLength(0);

    await user.clear(screen.getByLabelText(/^value/i));
    await user.type(screen.getByLabelText(/^value/i), '72');
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    await waitFor(() => expect(savedState().vitals).toHaveLength(1));
    expect(savedState().vitals[0]).toMatchObject({ metric: 'hr', value: 72 });
  });

  it('logs a hand-entered meal with its own numbers and totals it for today', async () => {
    offline();
    const user = userEvent.setup();
    mount('/nutrition');
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    await user.click(await screen.findByText(/enter a food by hand/i));
    await user.type(screen.getByLabelText('Name'), 'Dal and rice');
    await user.type(screen.getByLabelText(/calories/i), '450');
    await user.type(screen.getByLabelText(/sodium/i), '600');
    await user.click(screen.getByRole('button', { name: /use this food/i }));
    await user.click(await screen.findByRole('button', { name: /add to today/i }));
    await waitFor(() => expect(savedState().meals).toHaveLength(1));
    expect(savedState().meals[0].food).toMatchObject({ name: 'Dal and rice', kcal: 450, sodium: 600, source: 'manual' });
    expect(screen.getAllByText(/450/).length).toBeGreaterThan(0);
  });

  it('tracks a medicine dose for today', async () => {
    offline();
    const user = userEvent.setup();
    mount('/care');
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    await user.type(await screen.findByLabelText('Name', { selector: '#m-name' }), 'Metformin');
    await user.click(screen.getByRole('button', { name: /add medicine/i }));
    await user.click(await screen.findByRole('button', { name: /took a dose/i }));
    await waitFor(() => {
      const med = savedState().medications[0];
      expect(Object.values(med.taken)).toEqual([1]);
    });
  });
});
