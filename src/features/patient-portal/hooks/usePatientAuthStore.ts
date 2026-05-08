/**
 * Patient Auth Store — Zustand
 * Ephemeral token storage (localStorage, expires 72h)
 * RN-P01: Token scoped to patientId + labId
 */

import { create } from 'zustand';
import type { PatientSession } from '../types';

interface PatientAuthState {
  token: string | null;
  patientId: string | null;
  labId: string | null;
  email: string | null;
  expiresAt: number | null;
  isLoading: boolean;
  error: string | null;
  isExpired: boolean;
  remainingMs: number | null;

  // Actions
  setAuth: (token: string, patientId: string, labId: string, expiresAt: number) => void;
  clearAuth: () => void;
  setSession: (session: PatientSession) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  checkExpiry: () => void;
  isTokenExpired: () => boolean;
  getTimeRemaining: () => number; // milliseconds
}

const STORAGE_KEY_TOKEN = 'patient_auth_token';
const STORAGE_KEY_PATIENT_ID = 'patient_id';
const STORAGE_KEY_LAB_ID = 'lab_id';
const STORAGE_KEY_EXPIRES_AT = 'patient_auth_expires_at';

export const usePatientAuthStore = create<PatientAuthState>((set, get) => ({
  token: null,
  patientId: null,
  labId: null,
  email: null,
  expiresAt: null,
  isLoading: false,
  error: null,
  isExpired: false,
  remainingMs: null,

  setAuth: (token: string, patientId: string, labId: string, expiresAt: number) => {
    // Validate expiry before storing
    const now = Date.now();
    if (now >= expiresAt) {
      throw new Error('Token already expired');
    }
    // Store in localStorage for persistence across page reloads
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_PATIENT_ID, patientId);
    localStorage.setItem(STORAGE_KEY_LAB_ID, labId);
    localStorage.setItem(STORAGE_KEY_EXPIRES_AT, String(expiresAt));
    set({ token, patientId, labId, expiresAt, error: null, isExpired: false });
  },

  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_PATIENT_ID);
    localStorage.removeItem(STORAGE_KEY_LAB_ID);
    localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
    set({ token: null, patientId: null, labId: null, email: null, expiresAt: null, error: null, isExpired: true, remainingMs: null });
  },

  setSession: (session: PatientSession) => {
    const expiresAtMs = session.expiresAt instanceof Date ? session.expiresAt.getTime() : Number(session.expiresAt);
    if (Date.now() >= expiresAtMs) {
      throw new Error('Token already expired');
    }
    localStorage.setItem(STORAGE_KEY_TOKEN, session.token);
    localStorage.setItem(STORAGE_KEY_PATIENT_ID, session.patientId);
    localStorage.setItem(STORAGE_KEY_LAB_ID, session.labId);
    localStorage.setItem(STORAGE_KEY_EXPIRES_AT, String(expiresAtMs));
    set({
      token: session.token,
      patientId: session.patientId,
      labId: session.labId,
      email: session.email,
      expiresAt: expiresAtMs,
      error: null,
      isExpired: false,
    });
  },

  clearSession: () => {
    get().clearAuth();
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  setError: (error: string | null) => set({ error }),

  checkExpiry: () => {
    const state = get();
    if (!state.expiresAt) {
      set({ isExpired: true, remainingMs: 0 });
      return;
    }
    const now = Date.now();
    const isExpired = now >= state.expiresAt;
    const remainingMs = isExpired ? 0 : state.expiresAt - now;
    set({ isExpired, remainingMs });
  },

  isTokenExpired: () => {
    const state = get();
    if (!state.expiresAt) return true;
    return Date.now() >= state.expiresAt;
  },

  getTimeRemaining: () => {
    const state = get();
    if (!state.expiresAt) return 0;
    const now = Date.now();
    return Math.max(0, state.expiresAt - now);
  },
}));

// Composite selector returning a PatientSession-shaped object (or null when unauthenticated)
export const usePatientSession = (): PatientSession | null => {
  const token = usePatientAuthStore((s) => s.token);
  const patientId = usePatientAuthStore((s) => s.patientId);
  const labId = usePatientAuthStore((s) => s.labId);
  const email = usePatientAuthStore((s) => s.email);
  const expiresAt = usePatientAuthStore((s) => s.expiresAt);
  if (!token || !patientId || !labId || !expiresAt) return null;
  return {
    token,
    patientId,
    labId,
    email: email ?? '',
    expiresAt: new Date(expiresAt),
  };
};

// Atomic selectors
export const usePatientToken = () =>
  usePatientAuthStore((s) => s.token);

export const usePatientId = () =>
  usePatientAuthStore((s) => s.patientId);

export const usePatientLabId = () =>
  usePatientAuthStore((s) => s.labId);

export const usePatientAuthLoading = () =>
  usePatientAuthStore((s) => s.isLoading);

export const usePatientAuthError = () =>
  usePatientAuthStore((s) => s.error);

export const useIsTokenExpired = () =>
  usePatientAuthStore((s) => s.isExpired);

export const usePatientTimeRemaining = () =>
  usePatientAuthStore((s) => s.remainingMs);

// Initialize store from localStorage on app load
export const initializePatientAuthStore = () => {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const patientId = localStorage.getItem(STORAGE_KEY_PATIENT_ID);
    const labId = localStorage.getItem(STORAGE_KEY_LAB_ID);
    const expiresAtStr = localStorage.getItem(STORAGE_KEY_EXPIRES_AT);

    if (token && patientId && labId && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      // Validate not expired
      if (Date.now() < expiresAt) {
        usePatientAuthStore.getState().setAuth(token, patientId, labId, expiresAt);
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_PATIENT_ID);
        localStorage.removeItem(STORAGE_KEY_LAB_ID);
        localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      }
    }
  } catch (error) {
    console.error('Failed to restore patient session:', error);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_PATIENT_ID);
    localStorage.removeItem(STORAGE_KEY_LAB_ID);
    localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
  }
};
