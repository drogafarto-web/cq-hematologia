/**
 * Heurísticas para separar falha de transporte (WebChannel / extensões / rede)
 * de falhas reais de RBAC no Firestore — especialmente relevante quando o DevTools
 * mostra net::ERR_BLOCKED_BY_CLIENT em .../Listen/channel.
 */

import { FirebaseError } from 'firebase/app';

export type FirestoreListenerFailureCategory =
  | 'rbac'
  | 'transport_suspected'
  | 'auth_token'
  | 'network'
  | 'unknown';

export type FirestoreUnaryProbeResult =
  | { status: 'ok'; docCount: number }
  | { status: 'error'; code: string; message: string };

function isFirebaseError(err: unknown): err is FirebaseError {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as FirebaseError).code === 'string';
}

/** Códigos frequentes quando o canal de streaming é interrompido ou bloqueado. */
const TRANSPORT_LIKE_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'cancelled',
  'aborted',
  'resource-exhausted',
  'failed-precondition',
  'unknown',
  'internal',
]);

/**
 * Brave expõe navigator.brave.isBrave() — útil só como sinal fraco (não prova bloqueio).
 */
export async function detectLikelyBraveBrowser(): Promise<boolean> {
  const nav = globalThis.navigator as Navigator & {
    brave?: { isBrave?: () => Promise<boolean> };
  };
  try {
    const fn = nav.brave?.isBrave;
    if (typeof fn !== 'function') return false;
    return await fn.call(nav.brave);
  } catch {
    return false;
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function classifyFirestoreListenerError(params: {
  err: unknown;
  /** Resultado de um getDocs/getDoc na mesma regra de leitura (RPC unary). */
  unaryProbe: FirestoreUnaryProbeResult | null;
  /** Se o token já contém modules.ceq === true (após getIdTokenResult). */
  tokenClaimsCeqTrue: boolean | null;
}): { category: FirestoreListenerFailureCategory; technicalCode: string; technicalMessage: string } {
  const { err, unaryProbe, tokenClaimsCeqTrue } = params;

  const technicalCode = isFirebaseError(err) ? err.code : 'non-firebase-error';
  const technicalMessage = isFirebaseError(err)
    ? err.message
    : err instanceof Error
      ? err.message
      : String(err);

  if (isFirebaseError(err) && (err.code === 'auth/user-token-expired' || err.code === 'auth/invalid-user-token')) {
    return { category: 'auth_token', technicalCode, technicalMessage };
  }

  if (!isOnline()) {
    return { category: 'network', technicalCode, technicalMessage };
  }

  if (isFirebaseError(err) && TRANSPORT_LIKE_CODES.has(err.code)) {
    return { category: 'transport_suspected', technicalCode, technicalMessage };
  }

  if (isFirebaseError(err) && err.code === 'permission-denied') {
    if (unaryProbe?.status === 'ok') {
      // Mesmas rules: leitura pontual OK → listener com permission-denied é altamente suspeito
      // de estado de transporte/streaming ou corrida; não orientar só como RBAC.
      return { category: 'transport_suspected', technicalCode, technicalMessage };
    }
    if (unaryProbe?.status === 'error' && TRANSPORT_LIKE_CODES.has(unaryProbe.code)) {
      return { category: 'transport_suspected', technicalCode, technicalMessage };
    }
    if (tokenClaimsCeqTrue === false) {
      return { category: 'rbac', technicalCode, technicalMessage };
    }
    if (unaryProbe?.status === 'error' && unaryProbe.code === 'permission-denied') {
      return { category: 'rbac', technicalCode, technicalMessage };
    }
    return { category: 'rbac', technicalCode, technicalMessage };
  }

  return { category: 'unknown', technicalCode, technicalMessage };
}

export function formatCeqUserFacingError(params: {
  category: FirestoreListenerFailureCategory;
  /** i18n-ready slug; UI pode mapear. */
}): { title: string; body: string; copySlug: string } {
  const { category } = params;
  switch (category) {
    case 'transport_suspected':
      return {
        title: 'CEQ: tempo real possivelmente bloqueado no navegador',
        body:
          'O Firestore usa um canal de streaming (Listen/WebChannel). Bloqueadores de anúncios, ' +
          'Brave Shields ou extensões de privacidade podem bloquear firestore.googleapis.com e ' +
          'gerar erros semelhantes a “permissão negada”. Tente desativar o bloqueio para este site, ' +
          'outra janela anónima sem extensões, ou outro navegador. Os dados podem ser atualizados ' +
          'em modo degradado (polling) enquanto isso.',
        copySlug: 'ceq.transport_suspected',
      };
    case 'auth_token':
      return {
        title: 'CEQ: sessão expirada',
        body: 'Faça logout e login novamente para renovar o token de autenticação.',
        copySlug: 'ceq.auth_token',
      };
    case 'network':
      return {
        title: 'CEQ: sem conexão',
        body: 'Verifique a rede e tente novamente.',
        copySlug: 'ceq.network',
      };
    case 'rbac':
      return {
        title: 'CEQ: permissão negada (RBAC)',
        body:
          'O token ou a associação ao laboratório não autoriza leitura CEQ. Faça logout e login ' +
          'para atualizar claims; confira claim modules.ceq e o documento em labs/…/members.',
        copySlug: 'ceq.rbac',
      };
    default:
      return {
        title: 'CEQ: erro ao carregar dados',
        body: 'Não foi possível classificar a falha. Veja o relatório de diagnóstico ou o console.',
        copySlug: 'ceq.unknown',
      };
  }
}
