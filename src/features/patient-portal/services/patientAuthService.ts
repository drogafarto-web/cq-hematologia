/**
 * Patient Auth Service — Client-side thin wrapper
 * Heavy lifting is in Cloud Functions (server-side)
 * RN-P03: Rate-limit enforcement (server-side)
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import type {
  GenerateAuthLinkRequest,
  GenerateAuthLinkResponse,
  VerifyAuthTokenRequest,
  VerifyAuthTokenResponse,
} from '../types';

/**
 * generatePatientAuthLink — Server-side callable
 * Flow: 1. Lookup patient by email (hashed) 2. Rate-limit check (3/day, RN-P03)
 * 3. Generate JWT (72h, RN-P02) 4. Send via Resend 5. Log immutably (RN-P04)
 */
export async function generatePatientAuthLink(
  request: GenerateAuthLinkRequest,
): Promise<GenerateAuthLinkResponse> {
  try {
    const callable = httpsCallable<GenerateAuthLinkRequest, GenerateAuthLinkResponse>(
      functions,
      'generatePatientAuthLink',
    );
    const result = await callable(request);
    return result.data;
  } catch (error: any) {
    const message = error?.message || 'Failed to generate auth link';
    return {
      success: false,
      message,
      error: message,
    };
  }
}

/**
 * verifyPatientAuthToken — Client-side validation
 * Also calls server to log the event (RN-P04: immutable audit trail)
 */
export async function verifyPatientAuthToken(
  request: VerifyAuthTokenRequest,
): Promise<VerifyAuthTokenResponse> {
  try {
    // Basic structure validation (client-side)
    const parts = request.token.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        error: 'Invalid token format',
      };
    }

    // Decode JWT (without verification — server trusts its own signature)
    try {
      const payload = JSON.parse(atob(parts[1]));
      const expiresAt = (payload.expiresAt || 0) * 1000; // Convert to ms

      if (Date.now() >= expiresAt) {
        return {
          valid: false,
          error: 'Token expired',
        };
      }

      // Call server to log the token verification event
      const callable = httpsCallable<VerifyAuthTokenRequest, VerifyAuthTokenResponse>(
        functions,
        'verifyPatientAuthToken',
      );
      const result = await callable(request);
      return result.data;
    } catch (parseError: any) {
      return {
        valid: false,
        error: 'Invalid token payload',
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || 'Verification failed',
    };
  }
}

/**
 * Validate email format (client-side pre-check)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format token expiry time (72 hours from now)
 */
export function getTokenExpiryTime(): Date {
  const now = new Date();
  now.setHours(now.getHours() + 72);
  return now;
}
