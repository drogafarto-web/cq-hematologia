import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, admin } from '../../shared/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import logger from 'firebase-functions/logger';

export const escalacaoSlaMonitor = onSchedule(
  { schedule: 'every 5 minutes', region: 'southamerica-east1', timeZone: 'America/Sao_Paulo' },
  async () => {
    try {
      const now = Timestamp.now();
      const labsSnapshot = await db.collection('labs').get();

      for (const labDoc of labsSnapshot.docs) {
        const labId = labDoc.id;

        // Get all escalacoes with status != ACKNOWLEDGED and slaDeadline < now
        const overdueSnapshot = await db.collection('labs').doc(labId)
          .collection('criticos-escalacoes')
          .where('status', '!=', 'ACKNOWLEDGED')
          .where('slaDeadline', '<', now)
          .where('deletadoEm', '==', null)
          .get();

        for (const escDoc of overdueSnapshot.docs) {
          const escalacao = escDoc.data();

          // Update status to EXPIRED
          await escDoc.ref.update({
            status: 'EXPIRED',
            logs: admin.firestore.FieldValue.arrayUnion({
              timestamp: now,
              action: 'SLA_EXPIRED',
              detail: `SLA deadline passed. Escalated to supervisor.`,
            }),
          });

          // Log for monitoring
          logger.info(`Escalacao ${escDoc.id} in lab ${labId} SLA expired`, {
            escalacaoId: escDoc.id,
            labId,
            slaDeadline: escalacao.slaDeadline,
          });
        }
      }

      logger.info('SLA monitoring completed', { processedLabs: labsSnapshot.size });
    } catch (err) {
      logger.error('Error in escalacao SLA monitor', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
);
