import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, admin } from '../../shared/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const EscalacaoInputSchema = z.object({
  laudoId: z.string().min(1),
  labId: z.string().min(1),
  criticalResults: z.array(z.object({
    analitoId: z.string(),
    valor: z.number(),
    severidade: z.enum(['alta', 'baixa']),
  })),
  patientPhone: z.string().optional(),
  physicianEmail: z.string().email(),
  operadorId: z.string().min(1),
});

export const escalacaoCriticos = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    try {
      const data = EscalacaoInputSchema.parse(request.data);
      const userId = request.auth?.uid;

      if (!userId) throw new HttpsError('unauthenticated', 'User not authenticated');

      const labRef = db.collection('labs').doc(data.labId);
      const escalacaoRef = labRef.collection('criticos-escalacoes').doc();
      const now = Timestamp.now();

      // Get routing rules from Task 05-01
      const rulesSnapshot = await labRef.collection('criticos-routing').where('ativo', '==', true).get();
      const recipients = {
        operadorIds: [] as string[],
        telefones: [] as string[],
        emails: [] as string[],
      };

      // Extract recipients from routing rules (simplified: all RT members for now)
      const membersSnapshot = await labRef.collection('members').where('role', '==', 'RT').get();
      membersSnapshot.docs.forEach(doc => {
        const member = doc.data();
        recipients.operadorIds.push(doc.id);
        if (member.telefone) recipients.telefones.push(member.telefone);
        if (member.email) recipients.emails.push(member.email);
      });

      // Default: physician email
      if (data.physicianEmail && !recipients.emails.includes(data.physicianEmail)) {
        recipients.emails.push(data.physicianEmail);
      }

      // Calculate SLA deadline (default 30 minutes)
      const slaMinutos = 30;
      const slaDeadline = new Timestamp(
        now.seconds + (slaMinutos * 60),
        now.nanoseconds
      );

      // Create escalacao document
      await escalacaoRef.set({
        labId: data.labId,
        laudoId: data.laudoId,
        criticalValues: data.criticalResults,
        escaladoEm: now,
        recipients,
        status: 'NEW',
        slaMinutos,
        slaDeadline,
        logs: [{
          timestamp: now,
          action: 'CREATED',
          detail: `Escalation created by ${data.operadorId}`,
        }],
        deletadoEm: null,
      });

      return {
        escalacaoId: escalacaoRef.id,
        status: 'NEW',
        slaDeadline: slaDeadline.toDate().toISOString(),
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', err.errors[0].message);
      }
      throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
  }
);
