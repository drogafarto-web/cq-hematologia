/**
 * checkRecurrence — Cloud Function (onCall)
 *
 * Checks if a given indicator has recurring non-conformances across audits.
 * Queries previous auditorias-internas for the same indicador and determines
 * if NCs appeared in the last 2 audits for the same item.
 *
 * Returns recurrence info with actionable recommendation.
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const db = getFirestore();

// ──────────────────────────────────────────────────────────────────────────
// Input validation
// ──────────────────────────────────────────────────────────────────────────

const CheckRecurrenceInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  indicadorId: z.string().min(1, 'indicadorId é obrigatório'),
});

type CheckRecurrenceInputType = z.infer<typeof CheckRecurrenceInput>;

// ──────────────────────────────────────────────────────────────────────────
// Cloud Function export
// ──────────────────────────────────────────────────────────────────────────

export const checkRecurrence = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<CheckRecurrenceInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
    }

    let input: CheckRecurrenceInputType;
    try {
      input = CheckRecurrenceInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    // Verify lab membership
    const userLabRef = db
      .collection('users')
      .doc(request.auth.uid)
      .collection('labs')
      .doc(input.labId);
    const userLabSnap = await userLabRef.get();
    if (!userLabSnap.exists || userLabSnap.data()?.ativo !== true) {
      throw new HttpsError('permission-denied', 'Usuário não é membro ativo do laboratório');
    }

    try {
      // Get all finalized auditorias ordered by year (most recent first)
      const auditoriasSnap = await db
        .collection(`labs/${input.labId}/auditorias-internas`)
        .where('status', '==', 'finalizada')
        .where('deletadoEm', '==', null)
        .orderBy('ano', 'desc')
        .get();

      if (auditoriasSnap.empty) {
        return {
          isRecurrent: false,
          occurrences: 0,
          lastAuditDate: null,
          recommendation: 'Nenhuma auditoria finalizada encontrada para análise de recorrência.',
        };
      }

      // Search for NCs related to this indicador across audits
      let occurrences = 0;
      let lastAuditDate: string | null = null;
      let consecutiveNCs = 0;
      const maxAuditsToCheck = Math.min(auditoriasSnap.size, 5); // Check up to 5 most recent

      for (let i = 0; i < maxAuditsToCheck; i++) {
        const auditoriaDoc = auditoriasSnap.docs[i];
        const auditoriaData = auditoriaDoc.data();

        // Get all sessions for this audit
        const sessoesSnap = await db
          .collection(`labs/${input.labId}/auditorias-internas/${auditoriaDoc.id}/sessoes`)
          .where('deletadoEm', '==', null)
          .get();

        let foundNCInThisAudit = false;

        for (const sessaoDoc of sessoesSnap.docs) {
          // Look for achados (findings) related to this indicador
          const achadosSnap = await db
            .collection(
              `labs/${input.labId}/auditorias-internas/${auditoriaDoc.id}/sessoes/${sessaoDoc.id}/achados`
            )
            .where('deletadoEm', '==', null)
            .get();

          for (const achadoDoc of achadosSnap.docs) {
            const achadoData = achadoDoc.data();

            // Match by checklistItemId (which maps to indicadorId)
            // or by numeroDICQ pattern in the checklist item
            if (
              achadoData.checklistItemId === input.indicadorId ||
              achadoData.indicadorId === input.indicadorId
            ) {
              foundNCInThisAudit = true;

              if (!lastAuditDate) {
                const auditDate = auditoriaData.proximaAuditoriaPlanejada?.toDate?.()
                  ?? auditoriaData.criadoEm?.toDate?.();
                if (auditDate) {
                  lastAuditDate = auditDate.toISOString();
                }
              }
              break;
            }
          }

          if (foundNCInThisAudit) break;
        }

        if (foundNCInThisAudit) {
          occurrences++;
          if (i < 2) {
            // Within the last 2 audits
            consecutiveNCs++;
          }
        }
      }

      // Also check checklist items with não-conforme response for this indicador
      if (occurrences === 0) {
        for (let i = 0; i < maxAuditsToCheck; i++) {
          const auditoriaDoc = auditoriasSnap.docs[i];
          const auditoriaData = auditoriaDoc.data();

          const sessoesSnap = await db
            .collection(`labs/${input.labId}/auditorias-internas/${auditoriaDoc.id}/sessoes`)
            .where('deletadoEm', '==', null)
            .get();

          let foundNCInThisAudit = false;

          for (const sessaoDoc of sessoesSnap.docs) {
            const checklistSnap = await db
              .collection(
                `labs/${input.labId}/auditorias-internas/${auditoriaDoc.id}/sessoes/${sessaoDoc.id}/checklist-items`
              )
              .where('resposta', '==', 'não-conforme')
              .get();

            for (const itemDoc of checklistSnap.docs) {
              const itemData = itemDoc.data();
              if (
                itemDoc.id === input.indicadorId ||
                itemData.numeroDICQ === input.indicadorId
              ) {
                foundNCInThisAudit = true;

                if (!lastAuditDate) {
                  const auditDate = auditoriaData.proximaAuditoriaPlanejada?.toDate?.()
                    ?? auditoriaData.criadoEm?.toDate?.();
                  if (auditDate) {
                    lastAuditDate = auditDate.toISOString();
                  }
                }
                break;
              }
            }

            if (foundNCInThisAudit) break;
          }

          if (foundNCInThisAudit) {
            occurrences++;
            if (i < 2) {
              consecutiveNCs++;
            }
          }
        }
      }

      const isRecurrent = consecutiveNCs >= 2;

      // Generate recommendation based on findings
      let recommendation: string;
      if (isRecurrent) {
        recommendation =
          'NC recorrente detectada nas últimas 2 auditorias. ' +
          'A análise de causa raiz anterior pode ter sido insuficiente. ' +
          'Recomenda-se: (1) revisar eficácia das ações corretivas anteriores, ' +
          '(2) realizar análise de causa raiz mais profunda (ex: 5 Porquês, Ishikawa), ' +
          '(3) considerar ação preventiva sistêmica.';
      } else if (occurrences > 0) {
        recommendation =
          `Indicador apresentou NC em ${occurrences} auditoria(s) anterior(es), ` +
          'porém não de forma consecutiva. Monitorar na próxima auditoria ' +
          'e verificar se ações corretivas foram eficazes.';
      } else {
        recommendation =
          'Nenhuma não conformidade anterior encontrada para este indicador. ' +
          'Histórico limpo.';
      }

      return {
        isRecurrent,
        occurrences,
        lastAuditDate,
        recommendation,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao verificar recorrência');
    }
  }
);
