/**
 * escalateCritico — Phase 5 W2-SA-30
 *
 * Cloud Function callable to escalate critical value alerts via SMS/email/in-app.
 * Implements RDC 978 Art. 127 (escalação de críticos) + DICQ 4.3 (comunicação crítica)
 *
 * SMS template: [HC Quality] CRÍTICO {analito}={valor}{unidade} em {time}. Acessar app.
 * No PII (patient name, CPF) in SMS body.
 *
 * Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER,
 *          SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { db } from '../../shared/firebase';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { z } from 'zod';

// ─── Secrets ────────────────────────────────────────────────────────────────

const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = defineSecret('TWILIO_FROM_NUMBER');

const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_PORT = defineSecret('SMTP_PORT');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

// ─── Input validation ────────────────────────────────────────────────────────

const EscalateRequestSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  alertId: z.string().min(1, 'alertId required'),
});

export interface NotificationChannel {
  type: 'sms' | 'email' | 'in-app';
  target: string;
  fallbackOrder: number;
}

export interface EscalateResponse {
  channelsAttempted: NotificationChannel[];
  delivered: NotificationChannel[];
}

// ─── SMS via Twilio ─────────────────────────────────────────────────────────

async function sendSMS(
  fromNumber: string,
  toNumber: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID.value()}/Messages.json`,
      new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: body,
      }),
      {
        auth: {
          username: TWILIO_ACCOUNT_SID.value(),
          password: TWILIO_AUTH_TOKEN.value(),
        },
        timeout: 5000,
      }
    );

    return {
      success: true,
      messageId: response.data.sid,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Twilio API error',
    };
  }
}

// ─── Email via SMTP ─────────────────────────────────────────────────────────

async function sendEmail(
  toEmail: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: parseInt(SMTP_PORT.value()),
      secure: true,
      auth: {
        user: SMTP_USER.value(),
        pass: SMTP_PASS.value(),
      },
      connectionTimeout: 5000,
      socketTimeout: 5000,
    });

    const result = await transporter.sendMail({
      from: SMTP_USER.value(),
      to: toEmail,
      subject,
      html,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'SMTP error',
    };
  }
}

// ─── In-app notification ────────────────────────────────────────────────────

async function createInAppNotification(
  userId: string,
  title: string,
  body: string,
  labId: string
): Promise<{ success: boolean; notifId?: string; error?: string }> {
  try {
    const notifId = admin.firestore().collection('_').doc().id;
    const notifRef = db.collection('users').doc(userId).collection('notifications').doc(notifId);

    await notifRef.set({
      title,
      body,
      labId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, notifId };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Firestore write error',
    };
  }
}

// ─── Escalate callable ──────────────────────────────────────────────────────

export const escalateCritico = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: [
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER,
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
    ],
  },
  async (request) => {
    try {
      // Auth + validate input
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User not authenticated');
      }

      const { labId, alertId } = EscalateRequestSchema.parse(request.data);

      // Verify user is member of lab
      const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(request.auth.uid).get();
      if (!memberDoc.exists) {
        throw new HttpsError('permission-denied', 'Not a member of this lab');
      }

      // Read alert
      const alertRef = db.collection('labs').doc(labId).collection('criticos').doc(alertId);
      const alertSnap = await alertRef.get();

      if (!alertSnap.exists) {
        throw new HttpsError('not-found', `Alert not found: ${alertId}`);
      }

      const alert = alertSnap.data() as any;

      // Idempotent check: skip if already escalado
      if (alert.status !== 'novo') {
        return {
          channelsAttempted: [],
          delivered: [],
        };
      }

      // TODO: Resolve channels from criticosRoutingService
      // For now, stub with empty channels
      const channels: NotificationChannel[] = [];

      const attempted: NotificationChannel[] = [];
      const delivered: NotificationChannel[] = [];

      // Attempt each channel in fallbackOrder
      for (const channel of channels.sort((a, b) => a.fallbackOrder - b.fallbackOrder)) {
        attempted.push(channel);

        let result: { success: boolean; messageId?: string; error?: string };

        if (channel.type === 'sms') {
          const body = `[HC Quality] CRÍTICO ${alert.analitoId}=${alert.valor} em ${new Date(
            alert.detectedAt
          ).toLocaleTimeString('pt-BR')}. Acessar app.`;
          result = await sendSMS(TWILIO_FROM_NUMBER.value(), channel.target, body);
        } else if (channel.type === 'email') {
          result = await sendEmail(
            channel.target,
            '[HC Quality] Alerta de Valor Crítico',
            `<p>Analito: ${alert.analitoId}</p><p>Valor: ${alert.valor}</p><p>Severity: ${alert.severity}</p>`
          );
        } else {
          // in-app
          result = await createInAppNotification(
            channel.target,
            `Alerta Crítico: ${alert.analitoId}`,
            `Valor crítico detectado: ${alert.valor}`,
            labId
          );
        }

        if (result.success) {
          delivered.push(channel);
        }
      }

      // Update alert status
      await alertRef.update({
        status: 'escalado',
        escaladoEm: admin.firestore.FieldValue.serverTimestamp(),
        canaisEntregues: delivered,
      });

      return {
        channelsAttempted: attempted,
        delivered,
      };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }

      if (err instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', `Validation: ${err.message}`);
      }

      console.error('[escalateCritico] Error:', err);
      throw new HttpsError('internal', 'Escalation failed');
    }
  }
);
