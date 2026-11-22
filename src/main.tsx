import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { RegelwerkProvider } from './regelwerk/RegelwerkContext';
import { RegelwerkTor } from './app/RegelwerkTor';

// Start ohne Netz: Service Worker speichert die App-Dateien (public/sw.js); nur im gebauten Editor, Fehler sind egal
// (etwa in einer Vorschau, die keine Service Worker erlaubt).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const adressen = [location.href.split('#')[0], ...performance.getEntriesByType('resource').map((x) => x.name)];
        reg.active?.postMessage({ art: 'speichern', adressen });
      })
      .catch(() => {});
  });
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <RegelwerkProvider>
        <RegelwerkTor>
          <App />
        </RegelwerkTor>
      </RegelwerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
