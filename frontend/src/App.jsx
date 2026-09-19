import { Routes, Route } from 'react-router-dom';
import AppLayout from './app/AppLayout.jsx';
import ErrorBoundary from './app/ErrorBoundary.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Chat from './pages/Chat.jsx';
import Triage from './pages/Triage.jsx';
import Nutrition from './pages/Nutrition.jsx';
import Vitals from './pages/Vitals.jsx';
import CareTeam from './pages/CareTeam.jsx';
import Library from './pages/Library.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="triage" element={<Triage />} />
          <Route path="nutrition" element={<Nutrition />} />
          <Route path="vitals" element={<Vitals />} />
          <Route path="care" element={<CareTeam />} />
          <Route path="library" element={<Library />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
