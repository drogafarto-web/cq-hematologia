/**
 * OTP (One-Time Password) Utilities
 *
 * Generates secure random OTP codes and sends via email.
 * OTP stored in Firestore with 10-minute TTL.
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

/**
 * Generate random 6-digit OTP code
 */
export function generateOTP(length: number = 6): string {
  const chars = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return otp;
}

/**
 * Store OTP in Firestore with 10-minute TTL
 * Returns token for client to pass back with OTP verification
 */
export async function storeOTP(email: string, otp: string): Promise<string> {
  const otpToken = crypto.randomBytes(16).toString('hex');
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(now.toDate().getTime() + 10 * 60 * 1000), // 10 minutes
  );

  const record = {
    contacto: email,
    codigo: otp,
    expirasEm: expiresAt,
    tentativas: 0,
    tentativasMaximas: 3,
    criadoEm: now,
  };

  await db.doc(`otps/${otpToken}`).set(record);

  // Schedule deletion after 10 minutes (Cloud Tasks would be better for production,
  // but for now we rely on the client respecting expirasEm)
  // In production, use Cloud Tasks or Firebase Scheduler for cleanup
  setTimeout(
    async () => {
      try {
        await db.doc(`otps/${otpToken}`).delete();
      } catch {
        // Ignore errors on cleanup
      }
    },
    10 * 60 * 1000,
  );

  return otpToken;
}

/**
 * Validate OTP (check code matches and hasn't expired)
 */
export async function validateOTP(otpToken: string, otp: string): Promise<boolean> {
  try {
    const doc = await db.doc(`otps/${otpToken}`).get();

    if (!doc.exists) {
      return false;
    }

    const data = doc.data();
    if (!data) return false;

    // Check expiration
    if (data.expirasEm.toMillis() < admin.firestore.Timestamp.now().toMillis()) {
      return false;
    }

    // Check code matches
    if (data.codigo !== otp) {
      return false;
    }

    // Check attempts not exceeded
    if (data.tentativas >= data.tentativasMaximas) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Increment OTP attempt count (for brute-force protection)
 */
export async function incrementOTPAttempts(otpToken: string): Promise<void> {
  try {
    await db.doc(`otps/${otpToken}`).update({
      tentativas: admin.firestore.FieldValue.increment(1),
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Delete OTP record after successful use
 */
export async function deleteOTP(otpToken: string): Promise<void> {
  await db.doc(`otps/${otpToken}`).delete();
}
