/**
 * Patient Auth Store — Zustand
 * Ephemeral token storage (localStorage, expires 72h)
 * RN-P01: Token scoped to patientId + labId
 */

import { create } from 'zustand';
import type { PatientSession } from '../types';

interface PatientAuthState {
  // Primary session object (single source of truth)
  session: PatientSession | null;
  // Flat fields kept in sync for backwards compatibility with selectors
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

const STORAGE_KEY_SESSION = 'patient_portal_session';
// Legacy keys kept for clearAuth cleanup only
const STORAGE_KEY_TOKEN = 'patient_auth_token';
const STORAGE_KEY_PATIENT_ID = 'patient_id';
const STORAGE_KEY_LAB_ID = 'lab_id';
const STORAGE_KEY_EXPIRES_AT = 'patient_auth_expires_at';

function persistSession(session: PatientSession): void {
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
    token: session.token,
    patientId: session.patientId,
    labId: session.labId,
    email: session.email,
    expiresAt: session.expiresAt instanceof Date
      ? session.expiresAt.toISOString()
      : session.expiresAt,
  }));
}

function clearPersistedSession(): void {
  localStorage.removeItem(STORAGE_KEY_SESSION);
  // Also clear legacy keys if present
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_PATIENT_ID);
  localStorage.removeItem(STORAGE_KEY_LAB_ID);
  localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
}

export const usePatientAuthStore = create<PatientAuthState>((set, get) => ({
  session: null,
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
    const now = Date.now();
    if (now >= expiresAt) {
      throw new Error('Token already expired');
    }
    const session: PatientSession = {
      token,
      patientId,
      labId,
      email: get().email ?? '',
      expiresAt: new Date(expiresAt),
    };
    persistSession(session);
    // Also write legacy individual keys for backwards compatibility
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_PATIENT_ID, patientId);
    localStorage.setItem(STORAGE_KEY_LAB_ID, labId);
    localStorage.setItem(STORAGE_KEY_EXPIRES_AT, String(expiresAt));
    set({ session, token, patientId, labId, expiresAt, error: null, isExpired: false });
  },

  clearAuth: () => {
    clearPersistedSession();
    set({ session: null, token: null, patientId: null, labId: null, email: null, expiresAt: null, error: null, isExpired: true, remainingMs: null });
  },

  setSession: (session: PatientSession) => {
    const expiresAtMs = session.expiresAt instanceof Date
      ? session.expiresAt.getTime()
      : Number(session.expiresAt);
    if (Date.now() >= expiresAtMs) {
      set({ session: null, error: 'Token expired' });
      return;
    }
    persistSession(session);
    set({
      session,
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
    const expiresAtMs = state.session
      ? (state.session.expiresAt instanceof Date
        ? state.session.expiresAt.getTime()
        : Number(state.session.expiresAt))
      : state.expiresAt;
    if (!expiresAtMs) {
      set({ isExpired: true, remainingMs: 0 });
      return;
    }
    const now = Date.now();
    const isExpired = now >= expiresAtMs;
    const remainingMs = isExpired ? 0 : expiresAtMs - now;
    set({ isExpired, remainingMs });
  },

  isTokenExpired: () => {
    const state = get();
    // Prefer session.expiresAt (Date-typed) for precision
    if (state.session?.expiresAt) {
      const ms = state.session.expiresAt instanceof Date
        ? state.session.expiresAt.getTime()
        : Number(state.session.expiresAt);
      return Date.now() >= ms;
    }
    if (!state.expiresAt) return true;
    return Date.now() >= state.expiresAt;
  },

  getTimeRemaining: () => {
    const state = get();
    // Prefer session.expiresAt (Date-typed)
    const expiresAtMs = state.session?.expiresAt
      ? (state.session.expiresAt instanceof Date
        ? state.session.expiresAt.getTime()
        : Number(state.session.expiresAt))
      : state.expiresAt;
    if (!expiresAtMs) return 0;
    return Math.max(0, expiresAtMs - Date.now());
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
    const stored = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!stored) return;

    const parsed = JSON.parse(stored) as {
      token: string;
      patientId: string;
      labId: string;
      email: string;
      expiresAt: string | number;
    };

    const expiresAt = new Date(parsed.expiresAt);
    if (Date.now() >= expiresAt.getTime()) {
      // Expired — remove from storage
      localStorage.removeItem(STORAGE_KEY_SESSION);
      return;
    }

    const session: PatientSession = {
      token: parsed.token,
      patientId: parsed.patientId,
      labId: parsed.labId,
      email: parsed.email,
      expiresAt,
    };
    usePatientAuthStore.getState().setSession(session);
  } catch (error) {
    console.error('Failed to restore patient session:', error);
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }
};
