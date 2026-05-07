import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, admin } from '../../shared/firebase';
import { sendEmail, ALL_SMTP_SECRETS } from '../../shared/email/smtpClient';
import { generateNPSToken } from '../../shared/tokenUtils';

/**
 * Trigger: When reclamacao transitions to 'Resolvida'
 * Action: Send NPS survey email to reclamant with unique token (valid 14 days)
 */
export const dispararNPSPosResolucao = onDocumentUpdated(
  {
    document: 'labs/{labId}/reclamacoes/{reclamacaoId}',
    secrets: [...ALL_SMTP_SECRETS],
  },
  async (event) => {
    const { labId, reclamacaoId } = event.params as { labId: string; reclamacaoId: string };
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger if status changed to 'Resolvida'
    if (before.status === after.status || after.status !== 'Resolvida') {
      return;
    }

    const reclamacao = after;
    const { reclamante } = reclamacao;

    if (!reclamante.email) {
      console.log(`[NPS] No email for reclamacao ${reclamacaoId}`);
      return;
    }

    try {
      // Generate unique 14-day token
      const npsToken = await generateNPSToken(reclamacaoId, labId, 14 * 24 * 60 * 60 * 1000);

      // Email template
      const npsUrl = `https://hmatologia2.web.app/portal-paciente/nps/${npsToken}`;
      const htmlBody = `
        <h2>Sua reclamação foi resolvida</h2>
        <p>Prezado(a) ${reclamante.nome},</p>
        <p>Gostaríamos de saber sua opinião sobre como resolvemos sua reclamação.</p>
        <p><a href="${npsUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Avaliar resolução</a></p>
        <p>Seu feedback é importante para melhorarmos continuamente.</p>
      `;

      // Send via SMTP
      await sendEmail({
        to: reclamante.email,
        subject: `Sua reclamação foi resolvida - Avalie nossa resposta`,
        html: htmlBody,
      });

      // Log email delivery
      await db.collection('comunicacoes-cliente').add({
        labId,
        reclamacaoId,
        tipo: 'nps-pos-resolucao',
        destinatario: reclamante.email,
        status: 'enviado',
        transport: 'smtp',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update reclamacao to track NPS pending
      await db.doc(`labs/${labId}/reclamacoes/${reclamacaoId}`).update({
        npsPendente: true,
        npsTokenCriadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[NPS] Sent to ${reclamante.email} for reclamacao ${reclamacaoId}`);
    } catch (error) {
      console.error(`[NPS] Error sending NPS email:`, error);
      throw error;
    }
  }
);
