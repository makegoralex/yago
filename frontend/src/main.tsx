import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ToastProvider } from './providers/ToastProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { unregisterLegacyServiceWorkers } from './lib/unregisterLegacyServiceWorkers';
import { logClientEvent } from './lib/observability';
import { initDebug } from './lib/initDebug';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

const bootStartAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
logClientEvent('app_boot_start', { bootStartAt });
initDebug.start('app_load');

void unregisterLegacyServiceWorkers();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);

requestAnimationFrame(() => {
  const bootDurationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - bootStartAt;
  initDebug.end('app_load', { bootDurationMs });
  logClientEvent('app_boot_ready', {
    bootDurationMs,
    kpi: 'median_app_boot_time',
  });
});
