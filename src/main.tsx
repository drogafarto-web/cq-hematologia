import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StrictMode } from 'react';
import { initSentry } from './lib/sentry';
import { initFirebasePerformance } from './lib/firebase-performance';
import { initWebVitals } from './lib/web-vitals';

initSentry();
initFirebasePerformance();
initWebVitals();

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  document.body.innerHTML = '<h1>ERRO: A tag raiz div#root não foi encontrada no index.html!</h1>';
}
