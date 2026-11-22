import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the installed app (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator && import.meta.env.VITE_USE_EMULATORS !== 'true' && import.meta.env.VITE_PREVIEW !== 'true') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
