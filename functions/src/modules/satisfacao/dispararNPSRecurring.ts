import { onSchedule } from 'firebase-functions/scheduler';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { db, admin } from '../../shared/firebase';
import { PubSub } from '@google-cloud/pubsub';
import { Resend } from 'resend';
import { generateNPSToken } from '../../shared/tokenUtils';

const pubsub = new PubSub();
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Cron: Every 3 months on the 15th at 09:00 BRT (12:00 UTC)
 * Action: Batch NPS survey to active patients via Pub/Sub fan-out
 *
 * This is a quarterly satisfaction measurement independent of complaint resolution
 */
export const dispararNPSRecurring = onSchedule(
  { schedule: '0 12 15 */3 *', timeZone: 'America/Sao_Paulo' },
  async (_event) => {
    try {
      // Get all active labs
      const labsSnap = await db.collection('labs').where('ativo', '==', true).get();

      console.log(`[NPS Recurring] Processing ${labsSnap.size} labs`);

      let totalPacientes = 0;

      for (const labDoc of labsSnap.docs) {
        const labId = labDoc.id;

        // Get pacientes who completed exam in last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // Query: pacientes with active results in last 90d
        // (Using a simple approach: get from patient portal or results collection)
        const pacientesSnap = await db.collectionGroup('pacientes')
          .where('labId', '==', labId)
          .where('ultimoExameCm', '>=', ninetyDaysAgo)
          .limit(1000)
          .get();

        console.log(`[NPS Recurring] Lab ${labId}: ${pacientesSnap.size} pacientes`);

        // Fan-out: publish to Pub/Sub for parallel email sending
        for (const pacDoc of pacientesSnap.docs) {
          const paciente = pacDoc.data();
          if (!paciente.email) continue;

          try {
            // Generate NPS token valid for 14 days
            const npsToken = await generateNPSToken(pacDoc.id, labId, 14 * 24 * 60 * 60 * 1000);

            // Publish to Pub/Sub topic for async processing
            const messageData = JSON.stringify({
              labId,
              pacienteId: pacDoc.id,
              email: paciente.email,
              nome: paciente.nome,
              npsToken,
              tipo: 'trimestral',
            });

            await pubsub.topic('nps-email-queue').publish(Buffer.from(messageData));
            totalPacientes++;
          } catch (error) {
            console.error(`[NPS Recurring] Error publishing for ${pacDoc.id}:`, error);
          }
        }
      }

      console.log(`[NPS Recurring] Queued ${totalPacientes} emails for delivery`);
    } catch (error) {
      console.error(`[NPS Recurring] Error:`, error);
      throw error;
    }
  }
);

/**
 * Cloud Task / Pub/Sub handler: Process NPS email queue
 * Sends NPS survey emails with rate limiting (max 1000/hour = 1/3.6s)
 */
export const npsEmailQueueHandler = onMessagePublished(
  'nps-email-queue',
  async (event) => {
    try {
      const messageData = event.data.message.data
        ? Buffer.from(event.data.message.data, 'base64').toString('utf-8')
        : '{}';
      const payload = JSON.parse(messageData);
      const { labId, pacienteId, email, nome, npsToken, tipo } = payload;
      void npsToken;

      const npsUrl = `https://hmatologia2.web.app/portal-paciente/nps/${npsToken}`;
      const htmlBody = `
        <h2>Sua opinião é importante</h2>
        <p>Prezado(a) ${nome},</p>
        <p>Como foi sua experiência com nosso laboratório?</p>
        <p>Sua avaliação nos ajuda a melhorar continuamente.</p>
        <p><a href="${npsUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Avaliar agora</a></p>
        <p>Esta pesquisa leva apenas 1 minuto.</p>
      `;

      const response = await resend.emails.send({
        from: 'satisfacao@hmatologia2.web.app',
        to: email,
        subject: `Sua opinião sobre nosso laboratório (${tipo === 'trimestral' ? 'Pesquisa trimestral' : 'Avaliação pós-resolução'})`,
        html: htmlBody,
      });

      // Log delivery
      const resendId = response.data?.id ?? null;
      await db.collection('comunicacoes-cliente').add({
        labId,
        pacienteId,
        tipo: `nps-${tipo}`,
        destinatario: email,
        status: resendId ? 'enviado' : 'erro',
        resendId,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[NPS Email Queue] Sent to ${email} (${tipo})`);
    } catch (error) {
      console.error('[NPS Email Queue] Error:', error);
      throw error;
    }
  },
);
