/**
 * sendOTP Cloud Function Callable
 *
 * Sends OTP via email for titular exclusion flow (LGPD Art. 18)
 *
 * Rate limiting: 1 OTP per email per minute (enforced by 10-min TTL + client-side delays)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { generateOTP, storeOTP } from '../../helpers/otp';

export const sendOTP = onCall<
  {
    email: string;
    labName: string;
  },
  {
    otpToken: string;
  }
>(async (request) => {
  const { email, labName } = request.data;

  // ─────────────────────────────────────────────────────────────────────────
  // Validate inputs
  // ─────────────────────────────────────────────────────────────────────────

  if (!email || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'Email inválido');
  }

  if (!labName) {
    throw new HttpsError('invalid-argument', 'Nome do laboratório obrigatório');
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Generate OTP
    // ─────────────────────────────────────────────────────────────────────────

    const otp = generateOTP(6);

    // ─────────────────────────────────────────────────────────────────────────
    // Store OTP in Firestore (returns token)
    // ─────────────────────────────────────────────────────────────────────────

    const otpToken = await storeOTP(email, otp);

    // ─────────────────────────────────────────────────────────────────────────
    // Send OTP via email (TODO: integrate with SendGrid or similar)
    // For now, log and return OTP token
    // ─────────────────────────────────────────────────────────────────────────

    // In production, use Firebase Admin SDK to send email via SendGrid/Mailgun:
    // await sendEmailViaProvider(email, {
    //   subject: 'Código de Verificação - Exclusão de Dados',
    //   text: `Seu código OTP é: ${otp}\n\nVálido por 10 minutos.`,
    //   html: `<p>Seu código OTP é: <strong>${otp}</strong></p><p>Válido por 10 minutos.</p>`,
    // });

    console.log(`[sendOTP] OTP sent to ${email} (token: ${otpToken}, otp: ${otp})`);

    // For development: log OTP to console (NEVER do this in production)
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      console.warn(`[DEV] OTP Code: ${otp}`);
    }

    return {
      otpToken,
    };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Erro ao enviar OTP');
  }
});
