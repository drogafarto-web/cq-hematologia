import { create } from 'zustand';
import type { PatientSessionState } from '../types/index';

/**
 * Patient Portal Auth Store
 *
 * Manages ephemeral JWT token (72h expiry) for patient email-link auth
 * RN-P02: Token expires in 72h. No auto-renewal.
 * RN-P05: No patient PII stored (only patientId + labId)
 *
 * Zustand pattern replicated from useAuthStore
 */

interface PatientAuthState extends PatientSessionState {
  // Actions
  setAuth: (token: string, patientId: string, labId: string, expiresAt: number) => void;
  clearAuth: () => void;
  checkExpiry: () => void;
}

export const usePatientAuthStore = create<PatientAuthState>((set, get) => ({
  token: localStorage.getItem('patient_auth_token'),
  patientId: localStorage.getItem('patient_id'),
  labId: localStorage.getItem('patient_lab_id'),
  expiresAt: (() => {
    const raw = localStorage.getItem('patient_expires_at');
    return raw ? parseInt(raw, 10) : null;
  })(),
  isExpired: false,
  remainingMs: 0,

  setAuth: (token: string, patientId: string, labId: string, expiresAt: number) => {
    // Validate expiry
    if (Date.now() > expiresAt) {
      throw new Error('Token already expired');
    }

    // Persist to localStorage
    localStorage.setItem('patient_auth_token', token);
    localStorage.setItem('patient_id', patientId);
    localStorage.setItem('patient_lab_id', labId);
    localStorage.setItem('patient_expires_at', expiresAt.toString());

    set({
      token,
      patientId,
      labId,
      expiresAt,
      isExpired: false,
      remainingMs: expiresAt - Date.now(),
    });
  },

  clearAuth: () => {
    localStorage.removeItem('patient_auth_token');
    localStorage.removeItem('patient_id');
    localStorage.removeItem('patient_lab_id');
    localStorage.removeItem('patient_expires_at');

    set({
      token: null,
      patientId: null,
      labId: null,
      expiresAt: null,
      isExpired: true,
      remainingMs: 0,
    });
  },

  checkExpiry: () => {
    const { expiresAt } = get();
    if (!expiresAt) {
      set({ isExpired: true, remainingMs: 0 });
      return;
    }

    const now = Date.now();
    const remaining = expiresAt - now;
    const expired = remaining <= 0;

    set({
      isExpired: expired,
      remainingMs: Math.max(0, remaining),
    });
  },
}));

// ─── Atomic selectors ─────────────────────────────────────────────────────────

export const usePatientToken = () => usePatientAuthStore((s) => s.token);
export const usePatientId = () => usePatientAuthStore((s) => s.patientId);
export const usePatientLabId = () => usePatientAuthStore((s) => s.labId);
export const usePatientSessionExpiry = () => usePatientAuthStore((s) => s.expiresAt);
export const usePatientIsExpired = () => usePatientAuthStore((s) => s.isExpired);
export const usePatientRemainingMs = () => usePatientAuthStore((s) => s.remainingMs);
