import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StrictMode } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { initSentry } from './lib/sentry';
import { initFirebasePerformance } from './lib/firebase-performance';
import { initWebVitals } from './lib/web-vitals';

/**
 * --- Contrato PWA / Service Worker (cliente) — não alterar manifest/precache aqui ---
 * (1) `virtual:pwa-register` + `registerSW({ immediate: true })` — registro no mesmo bundle do app,
 *     para o novo SW ser pedido de imediato e não depender só do script injetado no HTML.
 * (2) `registerType: 'autoUpdate'` em `vite.config.ts` — atualização automática estável em produção.
 * (3) `workbox.skipWaiting: true` em `vite.config.ts` — após install OK, o novo SW não fica preso em "waiting".
 * (4) `workbox.clientsClaim: true` em `vite.config.ts` — o SW ativo assume as abas/clientes na hora.
 * (5) `selfDestroying` só por env no build (`vite.config.ts`), nunca fixo; one-shot documentado lá.
 */
registerSW({ immediate: true });

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
