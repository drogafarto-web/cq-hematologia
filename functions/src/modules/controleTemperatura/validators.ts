/**
 * validators.ts (server — controleTemperatura)
 *
 * Guarda de auth/access + schemas Zod para callables do módulo CT.
 *
 * Paridade com EC: mesma forma de `assertEcAccess`, adaptada pro claim
 * `modules['controle-temperatura']`. Mensagem de erro padronizada.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const CT_ACCESS_DENIED_MSG = 'Sem permissão para este módulo — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante (em ordem):
 *   1. Caller autenticado
 *   2. Caller tem claim modules['controle-temperatura'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *
 * Falhas viram `permission-denied` com mensagem padronizada + log
 * `[CT_ACCESS_DENIED]` em Cloud Logging.
 */
export async function assertCtAccess(auth: AuthDataLite | undefined, labId: string): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  if (modulesClaim['controle-temperatura'] !== true) {
    console.error('[CT_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', CT_ACCESS_DENIED_MSG);
  }

  const memberSnap = await admin.firestore().doc(`labs/${labId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[CT_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', CT_ACCESS_DENIED_MSG);
  }
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function ctLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`controleTemperatura/${labId}`);
}

export function ctCollection(
  db: admin.firestore.Firestore,
  labId: string,
  name:
    | 'equipamentos'
    | 'leituras'
    | 'leituras-previstas'
    | 'ncs'
    | 'termometros'
    | 'dispositivos-iot',
) {
  return db.collection(`controleTemperatura/${labId}/${name}`);
}

export async function ensureCtLabRoot(db: admin.firestore.Firestore, labId: string): Promise<void> {
  const ref = ctLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const TurnoSchema = z.enum(['manha', 'tarde', 'noite', 'automatica']);
const StatusLeituraSchema = z.enum(['realizada', 'perdida', 'justificada']);

export const CommitLeituraInputSchema = z.object({
  labId: z.string().min(1),
  equipamentoId: z.string().min(1),
  /** Timestamp serializado como epoch ms — wire transport. */
  dataHoraMillis: z.number().finite(),
  turno: TurnoSchema,
  temperaturaAtual: z.number().finite(),
  umidade: z.number().finite().optional(),
  temperaturaMax: z.number().finite(),
  temperaturaMin: z.number().finite(),
  status: StatusLeituraSchema,
  justificativaPerdida: z.string().max(500).optional(),
  observacao: z.string().max(500).optional(),
  leituraPrevistaId: z.string().optional(),
});

export type CommitLeituraInput = z.infer<typeof CommitLeituraInputSchema>;
