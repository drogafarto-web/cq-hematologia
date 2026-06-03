/**
 * Relatório único de acesso CEQ: Auth + claims + membership + leitura unary da coleção CEQ.
 * Seguro para colar em ticket de suporte (revisar se não incluir dados sensíveis além do necessário).
 */

import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { debugAuthState } from '../../../shared/firebase/debugAuthState';
import { debugFirestoreConnection } from '../../../shared/firebase/debugFirestoreConnection';
import type { FirestoreUnaryProbeResult } from '../../../shared/firebase/firestoreTransportDiagnostics';

export type CeqAccessValidationReport = {
  generatedAtIso: string;
  labId: string;
  auth: Awaited<ReturnType<typeof debugAuthState>>;
  firestoreMember: Awaited<ReturnType<typeof debugFirestoreConnection>>;
  unaryParticipacoes: FirestoreUnaryProbeResult;
  notes: string[];
};

async function probeParticipacoesUnary(
  db: Firestore,
  labId: string,
): Promise<FirestoreUnaryProbeResult> {
  const q = query(
    collection(db, 'labs', labId, 'ceq-participacoes'),
    where('ativo', '==', true),
    where('deletadoEm', '==', null),
    limit(5),
  );
  try {
    const snap = await getDocs(q);
    return { status: 'ok', docCount: snap.size };
  } catch (e: unknown) {
    if (e instanceof FirebaseError) {
      return { status: 'error', code: e.code, message: e.message };
    }
    return {
      status: 'error',
      code: 'unknown',
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Executa diagnóstico completo (chama getIdTokenResult(true)).
 */
export async function validateCeqAccess(params: {
  auth: Auth;
  db: Firestore;
  labId: string;
}): Promise<CeqAccessValidationReport> {
  const { auth, db, labId } = params;
  const notes: string[] = [];

  const authReport = await debugAuthState(auth, true);
  if (!authReport.uid) {
    notes.push('Nenhum utilizador autenticado.');
    return {
      generatedAtIso: new Date().toISOString(),
      labId,
      auth: authReport,
      firestoreMember: {
        labId,
        memberPath: `labs/${labId}/members/(no-uid)`,
        memberDocExists: false,
        memberReadCode: 'skipped',
      },
      unaryParticipacoes: { status: 'error', code: 'skipped', message: 'no auth' },
      notes,
    };
  }

  const firestoreMember = await debugFirestoreConnection(db, labId, authReport.uid);
  const unaryParticipacoes = await probeParticipacoesUnary(db, labId);

  if (authReport.modulesCeq !== true) {
    notes.push('Claim modules.ceq não é true no token — RBAC pode bloquear mesmo com membership.');
  }
  if (!firestoreMember.memberDocExists && firestoreMember.memberReadCode === null) {
    notes.push('Documento de membro não encontrado (labs/.../members/{uid}).');
  }
  if (firestoreMember.memberReadCode !== null) {
    notes.push(`Leitura do doc de membro falhou com código: ${firestoreMember.memberReadCode}.`);
  }
  if (unaryParticipacoes.status === 'error') {
    notes.push(
      `Leitura unary CEQ falhou (${unaryParticipacoes.code}) — regras ou rede; comparar com erro do listener.`,
    );
  }
  if (unaryParticipacoes.status === 'ok' && authReport.modulesCeq === true) {
    notes.push(
      'Token com CEQ e leitura unary OK: se o listener falhar, suspeite de bloqueio WebChannel/extensão.',
    );
  }

  return {
    generatedAtIso: new Date().toISOString(),
    labId,
    auth: authReport,
    firestoreMember,
    unaryParticipacoes,
    notes,
  };
}

export function stringifyCeqAccessReport(r: CeqAccessValidationReport): string {
  return JSON.stringify(r, null, 2);
}
