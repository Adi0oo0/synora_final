import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SideNav from './SideNav.jsx';
import TopBar from './TopBar.jsx';
import EmergencyDialog from './EmergencyDialog.jsx';
import NotificationsDialog from './NotificationsDialog.jsx';
import Icon from '../components/Icon.jsx';

const TITLES = {
  '/': 'Dashboard',
  '/chat': 'Coach chat',
  '/triage': 'Symptom triage',
  '/nutrition': 'Nutrition',
  '/vitals': 'Vitals & anomalies',
  '/care': 'Care team',
  '/library': 'Preventive care',
  '/settings': 'Profile & display',
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [notifications, setNotifications] = useState(false);

  useEffect(() => {
    setNavOpen(false);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to main content</a>

      <SideNav open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="canvas">
        <TopBar
          title={TITLES[pathname] ?? 'ZenHealth'}
          onMenu={() => setNavOpen(true)}
          onEmergency={() => setEmergency(true)}
          onNotifications={() => setNotifications(true)}
        />

        <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
          <Outlet context={{ openEmergency: () => setEmergency(true) }} />
        </main>

        <footer className="footnote">
          <div className="alert alert--crimson">
            <div className="alert__head">
              <Icon name="alert" size={22} />
              <div>
                <h3>In an emergency, call your local emergency number immediately.</h3>
                <p>
                  ZenHealth does not diagnose, prescribe, or replace a clinician. Everything here is
                  triage guidance built from what you logged, and this build runs on sample data.
                </p>
              </div>
            </div>
          </div>
          <p className="tiny">ZenHealth prototype · triage rules are deterministic and open in src/lib/triage.js</p>
        </footer>
      </div>

      <EmergencyDialog open={emergency} onClose={() => setEmergency(false)} />
      <NotificationsDialog open={notifications} onClose={() => setNotifications(false)} />
    </div>
  );
}
