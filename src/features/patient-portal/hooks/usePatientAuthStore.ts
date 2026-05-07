/**
 * Patient Auth Store — Zustand
 * Ephemeral token storage (localStorage, expires 72h)
 * RN-P01: Token scoped to patientId + labId
 */

import { create } from 'zustand';
import type { PatientSession } from '../types';

interface PatientAuthState {
  session: PatientSession | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSession: (session: PatientSession) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isTokenExpired: () => boolean;
  getTimeRemaining: () => number; // milliseconds
}

const STORAGE_KEY = 'patient_portal_session';

export const usePatientAuthStore = create<PatientAuthState>((set, get) => ({
  session: null,
  isLoading: false,
  error: null,

  setSession: (session: PatientSession) => {
    // Validate expiry before storing
    if (new Date() >= session.expiresAt) {
      set({ error: 'Token expired' });
      return;
    }
    // Store in localStorage for persistence across page reloads
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...session,
      expiresAt: session.expiresAt.toISOString(),
    }));
    set({ session, error: null });
  },

  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ session: null, error: null });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  setError: (error: string | null) => set({ error }),

  isTokenExpired: () => {
    const state = get();
    if (!state.session) return true;
    return new Date() >= state.session.expiresAt;
  },

  getTimeRemaining: () => {
    const state = get();
    if (!state.session) return 0;
    const now = new Date().getTime();
    const expiresAt = state.session.expiresAt.getTime();
    return Math.max(0, expiresAt - now);
  },
}));

// Atomic selectors
export const usePatientSession = () =>
  usePatientAuthStore((s) => s.session);

export const usePatientId = () =>
  usePatientAuthStore((s) => s.session?.patientId ?? null);

export const usePatientLabId = () =>
  usePatientAuthStore((s) => s.session?.labId ?? null);

export const usePatientAuthLoading = () =>
  usePatientAuthStore((s) => s.isLoading);

export const usePatientAuthError = () =>
  usePatientAuthStore((s) => s.error);

export const useIsTokenExpired = () =>
  usePatientAuthStore((s) => s.isTokenExpired());

export const usePatientTimeRemaining = () =>
  usePatientAuthStore((s) => s.getTimeRemaining());

// Initialize store from localStorage on app load
export const initializePatientAuthStore = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const session: PatientSession = {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt),
      };

      // Validate not expired
      if (new Date() < session.expiresAt) {
        usePatientAuthStore.getState().setSession(session);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (error) {
    console.error('Failed to restore patient session:', error);
    localStorage.removeItem(STORAGE_KEY);
  }
};
