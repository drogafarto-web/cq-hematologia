import * as Sentry from '@sentry/react';

/**
 * Inicialização do Sentry. Chamada antes do React montar (em main.tsx).
 *
 * Privacidade (LGPD/RDC 786): Session Replay com `maskAllText` + `maskAllInputs`
 * — texto e inputs são serializados como `*` no replay. Imagens (fotos do
 * Yumizen H550) ficam visíveis pra debug visual de OCR. Operador pode
 * adicionar `data-sentry-unmask` em elementos que devem aparecer (labels
 * fixos do UI, números de versão, etc).
 *
 * Sample rates conservadores no free tier (5k erros / 50 replays / 10k traces):
 * - replaysOnErrorSampleRate=1.0 — sempre captura quando erro acontece
 * - replaysSessionSampleRate=0.05 — 5% das sessões "limpas" pra ter baseline
 * - tracesSampleRate=0.10 — 10% das transactions
 *
 * Em dev (`MODE === 'development'`) Sentry fica **off** pra não poluir issues
 * com bugs locais e não consumir quota.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const env = import.meta.env.MODE;

  if (!dsn || env === 'development') {
    return;
  }

  Sentry.init({
    dsn,
    environment: env,
    release: `hc-quality@${import.meta.env.VITE_APP_VERSION ?? 'unknown'}`,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: false,
        // Network requests — não capturar bodies (podem conter PII)
        networkDetailAllowUrls: [],
      }),
    ],

    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    // Trace propagation pra Cloud Functions southamerica-east1.
    // Hooks distributed tracing entre browser e backend quando o segundo
    // projeto Sentry (hc-quality-functions) for criado.
    tracePropagationTargets: [
      /^https:\/\/southamerica-east1-hmatologia2\.cloudfunctions\.net/,
      /^https:\/\/.*-hmatologia2\.web\.app/,
    ],

    beforeSend(event, hint) {
      const error = hint.originalException;
      // Filtra ruído conhecido que não é bug:
      if (error instanceof Error) {
        const msg = error.message;
        // ResizeObserver: harmless loop notification do browser
        if (/ResizeObserver loop/i.test(msg)) return null;
        // Network errors em mobile offline — esperado em PWA, não é bug
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return null;
        // Firebase quota / permission denied — já tratado em UI
        if (/permission-denied|resource-exhausted/i.test(msg)) return null;
      }
      return event;
    },
  });
}

/**
 * Identifica o usuário no Sentry. Chamado pelo hook `useSentryAuthSync`
 * sempre que o appProfile muda. Erros subsequentes ficam taggeados com
 * `user.id`, `user.email`, e custom tag `labId` pra filtro por cliente.
 */
export function setSentryUser(params: {
  uid: string;
  email: string | null;
  labId: string | null;
  isSuperAdmin: boolean;
}): void {
  Sentry.setUser({
    id: params.uid,
    email: params.email ?? undefined,
  });
  Sentry.setTag('labId', params.labId ?? 'no-lab');
  Sentry.setTag('superAdmin', params.isSuperAdmin ? 'yes' : 'no');
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Breadcrumb estruturado para paths críticos. Aparece na timeline do issue
 * mostrando o que o operador fez nos últimos 30s antes do crash.
 */
export function trackEvent(
  category: 'run' | 'lot' | 'bula' | 'ocr' | 'auth' | 'navigation',
  message: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    data,
  });
}

export { Sentry };
