import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../../shared/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import twilio from 'twilio';

const SMSInputSchema = z.object({
  escalacaoId: z.string().min(1),
  labId: z.string().min(1),
  recipientePhone: z.string().regex(/^\+\d{10,15}$/),
  criticoData: z.object({
    analito: z.string(),
    valor: z.number(),
    referencia: z.string(),
  }),
  labData: z.object({
    nomeAbreviado: z.string(),
    telefone: z.string(),
  }),
  patientName: z.string(),
});

const twilio_client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const escalarCriticoViaSmS = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    try {
      const data = SMSInputSchema.parse(request.data);

      // Build SMS text (max 160 chars)
      const smsText = `[${data.labData.nomeAbreviado}] CRÍTICO: ${data.criticoData.analito} = ${data.criticoData.valor} (ref: ${data.criticoData.referencia}). Paciente: ${data.patientName}. Contato: ${data.labData.telefone}`;

      if (smsText.length > 160) {
        throw new HttpsError('invalid-argument', 'SMS text exceeds 160 characters');
      }

      // Send SMS via Twilio
      const message = await twilio_client.messages.create({
        from: process.env.TWILIO_FROM_NUMBER!,
        to: data.recipientePhone,
        body: smsText,
      });

      // Log SMS sent in escalacao document
      const escalacaoRef = db.collection('labs').doc(data.labId)
        .collection('criticos-escalacoes').doc(data.escalacaoId);

      await escalacaoRef.update({
        logs: FieldValue.arrayUnion({
          timestamp: Timestamp.now(),
          action: 'SMS_SENT',
          detail: `SMS sent to ${data.recipientePhone}`,
          provider: 'twilio',
          messageId: message.sid,
        }),
      });

      return {
        success: true,
        messageId: message.sid,
        status: 'sent',
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', err.errors[0].message);
      }
      throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
  }
);

// Import FieldValue at top
import { FieldValue } from 'firebase-admin/firestore';
