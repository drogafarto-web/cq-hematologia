/**
 * ct_commitLeitura — sign-and-write atomic de leitura manual de temperatura.
 *
 * Substitui a geração client-side em `useSaveLeitura.ts` (CT-01).
 *
 * Responsabilidades:
 *   1. Valida claim + membership (assertCtAccess).
 *   2. Re-lê equipamento server-side (fonte da verdade de limites — client
 *      não pode forjar limites para disfarçar leitura fora dos limites).
 *   3. Deriva `foraDosLimites` aplicando RN-01.
 *   4. Gera `LogicalSignature` server-side com `uid` e `Timestamp.now()`.
 *   5. writeBatch atômico: leitura + NC (se fora) + marca previsão (se
 *      `leituraPrevistaId` fornecido).
 *   6. Retorna IDs.
 *
 * RN-02: como esta callable SÓ é usada para origem='manual', a assinatura é
 * sempre gerada. Leituras IoT continuam via `registrarLeituraIoT` HTTP endpoint.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { writeAuditLog } from '../../shared/audit/writeAuditLog';
import { generateCtSignatureServer, type LogicalSignature } from './signatureCanonical';
import {
  assertCtAccess,
  CommitLeituraInputSchema,
  ctCollection,
  ensureCtLabRoot,
} from './validators';

interface CommitLeituraResult {
  ok: true;
  leituraId: string;
  ncId: string | null;
  foraDosLimites: boolean;
  violado: 'max' | 'min' | 'umidade' | null;
}

interface Limites {
  temperaturaMin: number;
  temperaturaMax: number;
  umidadeMin?: number;
  umidadeMax?: number;
}

function avaliarForaDosLimites(
  temperaturaAtual: number,
  umidade: number | undefined,
  limites: Limites,
): { fora: boolean; violado: 'max' | 'min' | 'umidade' | null } {
  if (temperaturaAtual > limites.temperaturaMax) return { fora: true, violado: 'max' };
  if (temperaturaAtual < limites.temperaturaMin) return { fora: true, violado: 'min' };
  if (
    umidade !== undefined &&
    ((limites.umidadeMax !== undefined && umidade > limites.umidadeMax) ||
      (limites.umidadeMin !== undefined && umidade < limites.umidadeMin))
  ) {
    return { fora: true, violado: 'umidade' };
  }
  return { fora: false, violado: null };
}

export const ct_commitLeitura = onCall<unknown, Promise<CommitLeituraResult>>(
  {},
  async (request) => {
    const parsed = CommitLeituraInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertCtAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    await ensureCtLabRoot(db, input.labId);

    // 1. Server lê equipamento (limites confiáveis)
    const equipRef = ctCollection(db, input.labId, 'equipamentos').doc(input.equipamentoId);
    const equipSnap = await equipRef.get();
    if (!equipSnap.exists || equipSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Equipamento não encontrado ou arquivado.');
    }
    const limites = equipSnap.data()?.['limites'] as Limites | undefined;
    if (!limites) {
      throw new HttpsError('failed-precondition', 'Equipamento sem limites configurados.');
    }

    // 2. Deriva foraDosLimites (RN-01)
    const avaliacao = avaliarForaDosLimites(input.temperaturaAtual, input.umidade, limites);

    // 3. Gera assinaturas server-side
    const nowTs = admin.firestore.Timestamp.now();
    const dataHoraTs = admin.firestore.Timestamp.fromMillis(input.dataHoraMillis);

    const leiturasCol = ctCollection(db, input.labId, 'leituras');
    const leituraRef = leiturasCol.doc();

    const assinaturaLeitura: LogicalSignature = generateCtSignatureServer(
      uid,
      {
        equipamentoId: input.equipamentoId,
        dataHora: dataHoraTs.toMillis(),
        temperaturaAtual: input.temperaturaAtual,
        temperaturaMax: input.temperaturaMax,
        temperaturaMin: input.temperaturaMin,
        ...(input.umidade !== undefined && { umidade: input.umidade }),
      },
      nowTs,
    );

    // 4. writeBatch atômico
    const batch = db.batch();
    batch.set(leituraRef, {
      labId: input.labId,
      equipamentoId: input.equipamentoId,
      dataHora: dataHoraTs,
      turno: input.turno,
      temperaturaAtual: input.temperaturaAtual,
      umidade: input.umidade ?? null,
      temperaturaMax: input.temperaturaMax,
      temperaturaMin: input.temperaturaMin,
      foraDosLimites: avaliacao.fora,
      origem: 'manual',
      dispositivoIoTId: null,
      status: input.status,
      justificativaPerdida: input.justificativaPerdida ?? null,
      assinatura: assinaturaLeitura,
      observacao: input.observacao ?? null,
      deletadoEm: null,
    });

    let ncId: string | null = null;
    if (avaliacao.fora && avaliacao.violado !== null) {
      const ncRef = ctCollection(db, input.labId, 'ncs').doc();
      ncId = ncRef.id;
      const assinaturaNC: LogicalSignature = generateCtSignatureServer(
        uid,
        {
          equipamentoId: input.equipamentoId,
          leituraId: leituraRef.id,
          autoNC: 1,
          violado: avaliacao.violado,
        },
        nowTs,
      );
      batch.set(ncRef, {
        labId: input.labId,
        leituraId: leituraRef.id,
        equipamentoId: input.equipamentoId,
        temperaturaRegistrada: input.temperaturaAtual,
        limiteViolado: avaliacao.violado,
        descricao: `Leitura fora dos limites (${avaliacao.violado}). Valor: ${input.temperaturaAtual}.`,
        acaoImediata: 'Ação imediata pendente de registro pelo responsável.',
        acaoCorretiva: null,
        responsavelAcao: uid,
        dataAbertura: nowTs,
        dataResolucao: null,
        status: 'aberta',
        assinatura: assinaturaNC,
        deletadoEm: null,
      });
    }

    if (input.leituraPrevistaId) {
      const previstaRef = ctCollection(db, input.labId, 'leituras-previstas').doc(
        input.leituraPrevistaId,
      );
      // Update silencioso: se previsão não existir, apenas continua (IoT pode ter marcado).
      const previstaSnap = await previstaRef.get();
      if (previstaSnap.exists) {
        batch.update(previstaRef, {
          status: 'realizada',
          leituraId: leituraRef.id,
        });
      }
    }

    await batch.commit();

    // Audit — best-effort with retry + fallback
    await writeAuditLog({
      action: 'CT_COMMIT_LEITURA',
      callerUid: uid,
      labId: input.labId,
      payload: {
        equipamentoId: input.equipamentoId,
        leituraId: leituraRef.id,
        ncId,
        foraDosLimites: avaliacao.fora,
      },
    });

    return {
      ok: true,
      leituraId: leituraRef.id,
      ncId,
      foraDosLimites: avaliacao.fora,
      violado: avaliacao.violado,
    };
  },
);
