import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { PreferencesProvider } from './state/PreferencesContext.jsx';
import { HealthProvider } from './state/HealthContext.jsx';
import './styles/base.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PreferencesProvider>
      <HealthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HealthProvider>
    </PreferencesProvider>
  </StrictMode>,
);
