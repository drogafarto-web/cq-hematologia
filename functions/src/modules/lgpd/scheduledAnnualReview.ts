/**
 * lgpd_scheduledAnnualReview — Fase 0 scheduled (07:00 America/Sao_Paulo).
 *
 * Diariamente a cada 07:00 BRT, varre todos os labs e busca documentos LGPD
 * obrigatórios (POL-LGPD-001, IT-LGPD-DPIA-001) onde:
 *   - status = 'vigente'
 *   - proximaRevisao <= hoje
 *
 * Para cada match, escreve uma notificação em `/labs/{labId}/notifications/`
 * com tipo 'lgpd-revisao-vencida' para alertar o gestor da qualidade.
 * Idempotente por chave `${codigo}-${proximaRevisao}` — evita duplicatas
 * através de janelas de transição de fuso horário (BRT/BRST).
 *
 * Referência: Plan 00-02 — Task 6
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const DOCUMENTOS_LGPD = ['POL-LGPD-001', 'IT-LGPD-DPIA-001'];

export const lgpd_scheduledAnnualReview = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    retryCount: 2,
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Meia-noite para comparação

    let totalProcessados = 0;
    let totalNotificacoes = 0;

    try {
      // Itera todos os labs via collectionGroup em sgq-documentos
      const docsSnap = await db.collectionGroup('sgq-documentos')
        .where('status', '==', 'vigente')
        .where('codigo', 'in', DOCUMENTOS_LGPD)
        .get();

      // Agrupa por labId para evitar iterações redundantes
      const docsByLab = new Map<string, admin.firestore.DocumentSnapshot[]>();

      for (const doc of docsSnap.docs) {
        const data = doc.data();
        const labId = data['labId'] as string | undefined;
        if (!labId) continue;

        if (!docsByLab.has(labId)) {
          docsByLab.set(labId, []);
        }
        docsByLab.get(labId)!.push(doc);
      }

      // Processa por lab
      for (const [labId, docs] of docsByLab.entries()) {
        for (const doc of docs) {
          const data = doc.data();
          if (!data) continue;

          const codigo = data.codigo as string | undefined;
          if (!codigo) continue;

          const proximaRevisaoTs = data.proximaRevisao as Timestamp | undefined;
          if (!proximaRevisaoTs) continue;

          const proximaRevisaoDate = proximaRevisaoTs.toDate();
          proximaRevisaoDate.setHours(0, 0, 0, 0);

          // Verifica se proximaRevisao <= hoje
          if (proximaRevisaoDate.getTime() > now.getTime()) {
            continue; // Ainda não venceu
          }

          totalProcessados++;

          // Chave de idempotência: evita duplicatas ao cruzar fusos horários
          const idempotencyKey = `${codigo}-${proximaRevisaoTs.toMillis()}`;

          // Busca notificação existente com mesma chave
          const existingSnap = await db
            .collection(`labs/${labId}/notifications`)
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();

          if (!existingSnap.empty) {
            // Já existe — pula
            continue;
          }

          // Cria notificação nova
          const notifRef = db.collection(`labs/${labId}/notifications`).doc();
          const titulo = codigo === 'POL-LGPD-001'
            ? 'Política de Privacidade (LGPD) vencida — revisão pendente'
            : 'Template DPIA (LGPD) vencido — revisão pendente';

          const versao = data.versao as number | undefined;

          await notifRef.set({
            labId,
            tipo: 'lgpd-revisao-vencida',
            titulo,
            descricao: `Documento ${codigo} v${versao ?? '?'} necessita revisão. Próxima revisão planejada: ${proximaRevisaoDate.toLocaleDateString('pt-BR')}.`,
            codigo,
            versao: versao ?? 1,
            documentoId: doc.id,
            proximaRevisao: proximaRevisaoTs,
            severity: 'high',
            status: 'nao-lida',
            criadoEm: Timestamp.now(),
            luidaEm: null,
            idempotencyKey,
          });

          totalNotificacoes++;
        }
      }

      console.log(
        `[lgpd_scheduledAnnualReview] Processados: ${totalProcessados}, Notificações criadas: ${totalNotificacoes}`
      );
    } catch (error) {
      console.error('[lgpd_scheduledAnnualReview] Erro:', error);
      throw error; // Firebase Scheduler retentará
    }
  }
);
