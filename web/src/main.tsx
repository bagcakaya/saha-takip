import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.tsx';
import { registerServiceWorker } from './registerServiceWorker';
import { OneSignalService } from './services/oneSignalService';

// Register PWA Service Worker for offline support and background push notifications
registerServiceWorker();

// Initialize OneSignal Web Push
OneSignalService.init();

// Mark app as mounted for index.html white-screen recovery watchdog
(window as unknown as { __SAHA_TAKIP_MOUNTED__?: boolean }).__SAHA_TAKIP_MOUNTED__ = true;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
