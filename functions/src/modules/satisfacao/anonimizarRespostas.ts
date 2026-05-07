import { onSchedule } from 'firebase-functions/scheduler';
import { db, admin } from '../../shared/firebase';

/**
 * Cron: Daily at 03:00 BRT (06:00 UTC)
 * Action: Anonymize NPS responses older than 90 days
 *
 * LGPD compliance: Removes pacienteId after 90 days, retaining only respostaId + scores
 * This allows trending analysis while protecting patient privacy
 */
export const anonimizarRespostas = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'America/Sao_Paulo', memory: '512MiB' },
  async (_event) => {
    try {
      // Calculate date 90 days ago
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(ninetyDaysAgo);

      // Get all labs
      const labsSnap = await db.collection('labs').get();
      let totalAnonymized = 0;

      for (const labDoc of labsSnap.docs) {
        const labId = labDoc.id;

        // Query: respostas older than 90d that are not yet anonymized
        const respostasSnap = await db
          .collectionGroup('satisfacao-respostas')
          .where('labId', '==', labId)
          .where('respondidoEm', '<', ninetyDaysAgoTimestamp)
          .where('anonimizadoEm', '==', null)
          .limit(1000)
          .get();

        console.log(`[Anonimizar] Lab ${labId}: ${respostasSnap.size} respostas to anonymize`);

        // Batch update
        const batch = db.batch();

        for (const respostaDoc of respostasSnap.docs) {
          const docRef = db.doc(
            `labs/${labId}/satisfacao-respostas/${respostaDoc.id}`
          );

          batch.update(docRef, {
            pacienteId: null, // Remove patient ID
            reclamacaoId: null, // Remove complaint ID
            anonimizadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });

          totalAnonymized++;
        }

        if (respostasSnap.size > 0) {
          await batch.commit();
        }
      }

      console.log(`[Anonimizar] Total anonymized: ${totalAnonymized}`);
    } catch (error) {
      console.error('[Anonimizar] Error:', error);
      throw error;
    }
  }
);
