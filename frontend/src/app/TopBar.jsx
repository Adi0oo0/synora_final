import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Button, IconButton } from '../components/Primitives.jsx';
import { routeQuery } from '../lib/triage.js';
import { useHealth } from '../state/HealthContext.jsx';

export default function TopBar({ title, onMenu, onEmergency, onNotifications, notificationCount = 0 }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { todayLog, profile } = useHealth();

  function submit(e) {
    e.preventDefault();
    const to = routeQuery(query);
    if (to) navigate(`${to}?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="topbar">
      <div className="row-tight">
        <IconButton icon="menu" label="Open navigation" className="hide-lg" onClick={onMenu} />
        <div className="topbar__crumb hide-sm">
          <b>{title}</b>
          <span className="tiny">
            {profile.name ? `${profile.name} · ` : ''}
            {todayLog ? `feeling ${todayLog.mood.toLowerCase()}, ${todayLog.severity}/10` : 'no check-in yet today'}
          </span>
        </div>
      </div>

      <form className="search" role="search" onSubmit={submit}>
        <label className="sr-only" htmlFor="global-search">
          Search symptoms, conditions or food interactions
        </label>
        <Icon name="search" size={20} />
        <input
          id="global-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symptoms, conditions, or food interactions…"
          autoComplete="off"
        />
      </form>

      <div className="row-tight">
        <Button variant="alarm" icon="alert" onClick={onEmergency}>
          <span className="hide-sm">Symptom urgency check</span>
          <span className="sr-only">Open symptom urgency check</span>
        </Button>
        <IconButton
          icon="bell"
          label={notificationCount ? `Notifications, ${notificationCount} needing attention` : 'Notifications'}
          count={notificationCount}
          onClick={onNotifications}
        />
        <span className="face face--me hide-md" aria-hidden="true">
          <Icon name="user" size={24} />
        </span>
      </div>
    </header>
  );
}
