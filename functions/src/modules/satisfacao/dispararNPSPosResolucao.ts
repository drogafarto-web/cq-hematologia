import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, admin } from '../../shared/firebase';
import { Resend } from 'resend';
import { generateNPSToken } from '../../shared/tokenUtils';

let resend: Resend | null = null;

function getResendClient() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

/**
 * Trigger: When reclamacao transitions to 'Resolvida'
 * Action: Send NPS survey email to reclamant with unique token (valid 14 days)
 */
export const dispararNPSPosResolucao = onDocumentUpdated(
  { document: 'labs/{labId}/reclamacoes/{reclamacaoId}' },
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

      // Send via Resend
      const client = getResendClient();
      const response = await client.emails.send({
        from: 'reclamacoes@hmatologia2.web.app',
        to: reclamante.email,
        subject: `Sua reclamação foi resolvida - Avalie nossa resposta`,
        html: htmlBody,
      });

      // Log email delivery
      const resendId = response.data?.id ?? null;
      await db.collection('comunicacoes-cliente').add({
        labId,
        reclamacaoId,
        tipo: 'nps-pos-resolucao',
        destinatario: reclamante.email,
        status: resendId ? 'enviado' : 'erro',
        resendId,
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
