/**
 * Unit tests for Patient Auth Store
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePatientAuthStore, initializePatientAuthStore } from '../hooks/usePatientAuthStore';
import type { PatientSession } from '../types';

describe('usePatientAuthStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store
    usePatientAuthStore.setState({
      session: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('setSession', () => {
    it('sets session with valid token', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: futureDate,
      };

      usePatientAuthStore.getState().setSession(session);
      const state = usePatientAuthStore.getState();

      expect(state.session).toEqual(session);
      expect(state.error).toBeNull();
    });

    it('rejects expired token', () => {
      const pastDate = new Date(Date.now() - 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: pastDate,
      };

      usePatientAuthStore.getState().setSession(session);
      const state = usePatientAuthStore.getState();

      expect(state.session).toBeNull();
      expect(state.error).toBe('Token expired');
    });

    it('persists session to localStorage', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: futureDate,
      };

      usePatientAuthStore.getState().setSession(session);

      const stored = localStorage.getItem('patient_portal_session');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.patientId).toBe('pat1');
      expect(parsed.labId).toBe('lab1');
    });
  });

  describe('clearSession', () => {
    it('clears session and localStorage', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: futureDate,
      };

      usePatientAuthStore.getState().setSession(session);
      usePatientAuthStore.getState().clearSession();

      const state = usePatientAuthStore.getState();
      expect(state.session).toBeNull();
      expect(localStorage.getItem('patient_portal_session')).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('returns true for expired token', () => {
      const pastDate = new Date(Date.now() - 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: pastDate,
      };

      usePatientAuthStore.setState({ session });
      expect(usePatientAuthStore.getState().isTokenExpired()).toBe(true);
    });

    it('returns false for valid token', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: futureDate,
      };

      usePatientAuthStore.setState({ session });
      expect(usePatientAuthStore.getState().isTokenExpired()).toBe(false);
    });

    it('returns true when no session', () => {
      usePatientAuthStore.setState({ session: null });
      expect(usePatientAuthStore.getState().isTokenExpired()).toBe(true);
    });
  });

  describe('getTimeRemaining', () => {
    it('returns milliseconds until expiry', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: futureDate,
      };

      usePatientAuthStore.setState({ session });
      const remaining = usePatientAuthStore.getState().getTimeRemaining();

      expect(remaining).toBeGreaterThan(59000);
      expect(remaining).toBeLessThanOrEqual(60000);
    });

    it('returns 0 for expired token', () => {
      const pastDate = new Date(Date.now() - 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: pastDate,
      };

      usePatientAuthStore.setState({ session });
      expect(usePatientAuthStore.getState().getTimeRemaining()).toBe(0);
    });
  });

  describe('initializePatientAuthStore', () => {
    it('restores valid session from localStorage', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const sessionData = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: futureDate.toISOString(),
      };

      localStorage.setItem('patient_portal_session', JSON.stringify(sessionData));
      initializePatientAuthStore();

      const state = usePatientAuthStore.getState();
      expect(state.session?.patientId).toBe('pat1');
      expect(state.session?.labId).toBe('lab1');
    });

    it('removes expired session from localStorage', () => {
      const pastDate = new Date(Date.now() - 1000);
      const sessionData = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: pastDate.toISOString(),
      };

      localStorage.setItem('patient_portal_session', JSON.stringify(sessionData));
      initializePatientAuthStore();

      expect(localStorage.getItem('patient_portal_session')).toBeNull();
    });
  });

  describe('selectors', () => {
    it('returns correct patientId', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const session: PatientSession = {
        token: 'test-token',
        patientId: 'pat1',
        labId: 'lab1',
        email: 'test@example.com',
        expiresAt: futureDate,
      };

      usePatientAuthStore.setState({ session });
      const patientId = usePatientAuthStore.getState().session?.patientId;
      expect(patientId).toBe('pat1');
    });

    it('returns null when no session', () => {
      usePatientAuthStore.setState({ session: null });
      const session = usePatientAuthStore.getState().session;
      expect(session).toBeNull();
    });
  });
});
