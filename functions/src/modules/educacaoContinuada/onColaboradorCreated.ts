/**
 * ec_onColaboradorCreated — Fase 7 RN-08 server-side.
 *
 * Trigger `onDocumentCreated` em
 * `educacaoContinuada/{labId}/colaboradores/{colaboradorId}`.
 * Ao criar colaborador ativo com cargo X, se existir TrilhaAprendizado ativa
 * para esse cargo e ainda não houver ProgressoTrilha, cria via Admin SDK.
 *
 * Substitui o observer client-side `useAutoStartTrilhasRN08` como caminho
 * primário. Observer fica como fallback (roda em paralelo; idempotência
 * client-side via check de progresso existente; server check duplica a
 * proteção). Observer pode ser removido em sessão futura após 1 sprint
 * estável deste trigger.
 *
 * Vantagens vs observer:
 *   - Elimina race window entre múltiplos admins abrindo a UI ao mesmo tempo
 *   - Cobre colaborador criado enquanto ninguém tem o módulo EC aberto
 *   - Logs auditáveis em `auditLogs/` com action `EC_RN08_TRIGGER_*`
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

interface EtapaTrilhaRaw {
  templateId: string;
  ordem?: number;
  prazoEmDias?: number;
  obrigatoria?: boolean;
}

interface TrilhaRaw {
  ativo: boolean;
  cargo: string;
  etapas: EtapaTrilhaRaw[];
  deletadoEm: admin.firestore.Timestamp | null;
}

export const ec_onColaboradorCreated = onDocumentCreated(
  'educacaoContinuada/{labId}/colaboradores/{colaboradorId}',
  async (event) => {
    const { labId, colaboradorId } = event.params;
    const data = event.data?.data();
    if (!data) return;
    if (data['ativo'] !== true) return;

    const cargoRaw = data['cargo'] as string | undefined;
    if (!cargoRaw || cargoRaw.trim().length === 0) return;
    const cargo = cargoRaw.trim().toLowerCase();

    const db = admin.firestore();

    // Busca trilhas ativas. Filtragem por cargo (case-insensitive) e deletadoEm
    // em memória — volume é baixo (~dezenas de trilhas por lab).
    const trilhasSnap = await db
      .collection(`educacaoContinuada/${labId}/trilhas`)
      .where('ativo', '==', true)
      .get();

    const trilhasAplicaveis = trilhasSnap.docs.filter((d) => {
      const t = d.data() as TrilhaRaw;
      if (t.deletadoEm !== null) return false;
      return (t.cargo ?? '').toLowerCase() === cargo;
    });

    if (trilhasAplicaveis.length === 0) return;

    for (const trilhaDoc of trilhasAplicaveis) {
      const trilha = trilhaDoc.data() as TrilhaRaw;

      // Check idempotência: já existe progresso (colaboradorId, trilhaId)
      // não-deletado? (pode ter sido criado pelo observer client-side)
      const existentesSnap = await db
        .collection(`educacaoContinuada/${labId}/progressosTrilha`)
        .where('colaboradorId', '==', colaboradorId)
        .get();
      const jaTem = existentesSnap.docs.some((p) => {
        const d = p.data();
        return d['trilhaId'] === trilhaDoc.id && d['deletadoEm'] === null;
      });
      if (jaTem) {
        db.collection('auditLogs')
          .add({
            action: 'EC_RN08_TRIGGER_SKIP_EXISTING',
            labId,
            payload: { colaboradorId, trilhaId: trilhaDoc.id },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
        continue;
      }

      const progressoRef = db
        .collection(`educacaoContinuada/${labId}/progressosTrilha`)
        .doc();
      await progressoRef.set({
        labId,
        colaboradorId,
        trilhaId: trilhaDoc.id,
        dataInicio: admin.firestore.Timestamp.now(),
        status: 'em_andamento',
        etapas: trilha.etapas.map((e) => ({
          templateId: e.templateId,
          status: 'pendente',
        })),
        percentualConcluido: 0,
        deletadoEm: null,
      });

      db.collection('auditLogs')
        .add({
          action: 'EC_RN08_TRIGGER_STARTED',
          labId,
          payload: {
            colaboradorId,
            trilhaId: trilhaDoc.id,
            progressoId: progressoRef.id,
            cargo: cargoRaw,
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    }
  },
);
