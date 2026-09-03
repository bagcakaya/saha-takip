import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { registerServiceWorker } from './registerServiceWorker';
import { OneSignalService } from './services/oneSignalService';

// Register PWA Service Worker for offline support and background push notifications
registerServiceWorker();

// Initialize OneSignal Web Push
OneSignalService.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
