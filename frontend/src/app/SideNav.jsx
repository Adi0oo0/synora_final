import { NavLink } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useHealth } from '../state/HealthContext.jsx';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/chat', label: 'Coach chat', icon: 'chat' },
  { to: '/triage', label: 'Symptom triage', icon: 'body' },
  { to: '/nutrition', label: 'Nutrition', icon: 'bowl' },
  { to: '/vitals', label: 'Vitals & anomalies', icon: 'pulse' },
  { to: '/care', label: 'Care team', icon: 'steth' },
  { to: '/library', label: 'Preventive care', icon: 'book' },
  { to: '/settings', label: 'Profile & display', icon: 'gear' },
];

export default function SideNav({ open, onNavigate }) {
  const { triage } = useHealth();

  return (
    <nav className="sidenav" data-open={open} aria-label="Main">
      <div className="brand">
        <Icon name="leafheart" size={44} className="brand__mark" strokeWidth={1.5} />
        <div>
          <div className="brand__name">ZenHealth</div>
          <span className="brand__badge">
            <i className="dot dot--live" /> Profile active
          </span>
        </div>
      </div>

      <ul className="navlist">
        {LINKS.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} end={l.end} className="navlink" onClick={onNavigate}>
              <Icon name={l.icon} size={22} />
              <span>{l.label}</span>
              {l.to === '/triage' && triage?.band === 'immediate' ? (
                <span className="navlink__count" aria-label="urgent">!</span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="nav-foot">
        <p className="tiny">
          Sample profile and synthetic sensor data. Not a medical record, not a diagnosis.
        </p>
      </div>
    </nav>
  );
}
