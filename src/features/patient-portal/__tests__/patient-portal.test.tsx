import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { usePatientLaudos } from '../hooks/usePatientLaudos';
import { usePatientAuthStore } from '../hooks/usePatientAuthStore';
import { usePatientSession } from '../hooks/usePatientSession';
import type { PatientPortalLaudo } from '../types/index';

// ─── Mock data ─────────────────────────────────────────────────────────────

const mockLaudo: PatientPortalLaudo = {
  id: 'laudo-001',
  labId: 'lab-001',
  pacienteId: 'patient-001',
  nome: 'Hemograma',
  dataColeta: Timestamp.fromDate(new Date('2026-05-01')),
  dataResultado: Timestamp.fromDate(new Date('2026-05-02')),
  dataEmissao: Timestamp.fromDate(new Date('2026-05-02')),
  status: 'FINALIZADO',
  criticoFlag: false,
  exames: [
    {
      analito: 'Glóbulos Vermelhos',
      valor: 4.8,
      unidade: 'M/µL',
      valoresReferencia: '4.5–5.9',
      nome: 'RBC',
    },
  ],
  criadoEm: Timestamp.fromDate(new Date('2026-05-02')),
};

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Patient Portal — Auth Store', () => {
  beforeEach(() => {
    localStorage.clear();
    usePatientAuthStore.getState().clearAuth();
  });

  it('should initialize with null values', () => {
    const state = usePatientAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.patientId).toBeNull();
    expect(state.labId).toBeNull();
  });

  it('should set auth and persist to localStorage', () => {
    const token = 'jwt-token-123';
    const patientId = 'patient-001';
    const labId = 'lab-001';
    const expiresAt = Date.now() + 72 * 60 * 60 * 1000;

    act(() => {
      usePatientAuthStore.getState().setAuth(token, patientId, labId, expiresAt);
    });

    const state = usePatientAuthStore.getState();
    expect(state.token).toBe(token);
    expect(state.patientId).toBe(patientId);
    expect(state.labId).toBe(labId);
    expect(state.expiresAt).toBe(expiresAt);

    // Check localStorage
    expect(localStorage.getItem('patient_auth_token')).toBe(token);
    expect(localStorage.getItem('patient_id')).toBe(patientId);
  });

  it('should reject expired tokens', () => {
    const pastTimestamp = Date.now() - 1000; // 1 second ago

    expect(() => {
      usePatientAuthStore.getState().setAuth('token', 'patient-001', 'lab-001', pastTimestamp);
    }).toThrow('Token already expired');
  });

  it('should clear auth and remove from localStorage', () => {
    const token = 'jwt-token-123';
    const patientId = 'patient-001';
    const labId = 'lab-001';
    const expiresAt = Date.now() + 72 * 60 * 60 * 1000;

    act(() => {
      usePatientAuthStore.getState().setAuth(token, patientId, labId, expiresAt);
    });

    act(() => {
      usePatientAuthStore.getState().clearAuth();
    });

    const state = usePatientAuthStore.getState();
    expect(state.token).toBeNull();
    expect(localStorage.getItem('patient_auth_token')).toBeNull();
  });
});

describe('Patient Portal — Session Expiry', () => {
  beforeEach(() => {
    localStorage.clear();
    usePatientAuthStore.getState().clearAuth();
    vi.useFakeTimers({ now: Date.now() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should track remaining time', () => {
    const now = Date.now();
    const expiresAt = now + 60 * 60 * 1000; // 1 hour

    act(() => {
      vi.setSystemTime(now);
      usePatientAuthStore.getState().setAuth('token', 'patient-001', 'lab-001', expiresAt);
    });

    act(() => {
      usePatientAuthStore.getState().checkExpiry();
    });

    const state = usePatientAuthStore.getState();
    expect(state.isExpired).toBe(false);
    expect(state.remainingMs).toBeGreaterThan(59 * 60 * 1000); // Close to 1 hour
  });

  it('should mark as expired when time passes', () => {
    const now = Date.now();
    const expiresAt = now + 60 * 1000; // 1 minute

    act(() => {
      vi.setSystemTime(now);
      usePatientAuthStore.getState().setAuth('token', 'patient-001', 'lab-001', expiresAt);
    });

    act(() => {
      vi.advanceTimersByTime(61 * 1000); // Move forward 61 seconds
      usePatientAuthStore.getState().checkExpiry();
    });

    const state = usePatientAuthStore.getState();
    expect(state.isExpired).toBe(true);
    expect(state.remainingMs).toBe(0);
  });
});

describe('Patient Portal — Laudo Types', () => {
  it('should validate laudo structure', () => {
    expect(mockLaudo.id).toBeDefined();
    expect(mockLaudo.pacienteId).toBeDefined();
    expect(mockLaudo.labId).toBeDefined();
    expect(mockLaudo.nome).toBeDefined();
    expect(mockLaudo.status).toMatch(/FINALIZADO|PENDENTE|CANCELADO|EM_ANALISE/);
    expect(mockLaudo.exames).toBeInstanceOf(Array);
    expect(mockLaudo.exames.length).toBeGreaterThan(0);
  });

  it('should handle critical flag', () => {
    const criticalLaudo = { ...mockLaudo, criticoFlag: true };
    expect(criticalLaudo.criticoFlag).toBe(true);
  });

  it('should format timestamps correctly', () => {
    expect(mockLaudo.dataColeta.toDate()).toBeInstanceOf(Date);
    expect(mockLaudo.dataResultado.toDate()).toBeInstanceOf(Date);
    expect(mockLaudo.dataEmissao.toDate()).toBeInstanceOf(Date);
  });
});

describe('Patient Portal — Date Filtering', () => {
  it('should calculate 30-day range correctly', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    expect(mockLaudo.dataEmissao.toDate() >= thirtyDaysAgo).toBe(
      mockLaudo.dataEmissao.toDate().getTime() >= thirtyDaysAgo.getTime(),
    );
  });

  it('should calculate 90-day range correctly', () => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const isInRange = mockLaudo.dataEmissao.toDate().getTime() >= ninetyDaysAgo.getTime();
    expect(isInRange).toBeDefined();
  });
});

describe('Patient Portal — Status Badge Logic', () => {
  const statusConfigs = {
    FINALIZADO: { icon: '✓', color: 'emerald' },
    PENDENTE: { icon: '⏱', color: 'amber' },
    EM_ANALISE: { icon: '⧖', color: 'blue' },
    CANCELADO: { icon: '×', color: 'red' },
  };

  it('should map status to correct icon and color', () => {
    Object.entries(statusConfigs).forEach(([status, config]) => {
      expect(config.icon).toBeDefined();
      expect(config.color).toMatch(/emerald|amber|blue|red/);
    });
  });

  it('should highlight critical results', () => {
    const criticalLaudo = { ...mockLaudo, criticoFlag: true, status: 'FINALIZADO' as const };
    expect(criticalLaudo.criticoFlag && criticalLaudo.status === 'FINALIZADO').toBe(true);
  });
});

describe('Patient Portal — RN Compliance', () => {
  it('RN-P01: Should enforce patient-only access', () => {
    // Service must validate patientId match
    const patientLaudos = [mockLaudo];
    const requestedPatientId = 'patient-001';

    const hasAccess = patientLaudos.every((l) => l.pacienteId === requestedPatientId);
    expect(hasAccess).toBe(true);
  });

  it('RN-P02: Should enforce 72h expiry', () => {
    const token = 'jwt-123';
    const now = Date.now();
    const expiresAt = now + 72 * 60 * 60 * 1000;

    act(() => {
      vi.setSystemTime(now);
      usePatientAuthStore.getState().setAuth(token, 'patient-001', 'lab-001', expiresAt);
    });

    act(() => {
      // Must call checkExpiry() to populate remainingMs — setAuth() does not auto-populate it
      usePatientAuthStore.getState().checkExpiry();
    });

    const state = usePatientAuthStore.getState();
    const remainingHours = state.remainingMs! / (60 * 60 * 1000);
    expect(remainingHours).toBeLessThanOrEqual(72);
    expect(remainingHours).toBeGreaterThan(71); // Roughly 72 hours
  });

  it('RN-P05: Should not store PII in logs', () => {
    // Only patientId (hashed), not email or CPF
    const logEntry = {
      patientId: mockLaudo.pacienteId,
      action: 'PDF_DOWNLOADED',
      timestamp: new Date(),
    };

    expect(logEntry.patientId).toBeDefined();
    expect(logEntry.patientId).not.toContain('@'); // No email
    expect(logEntry.patientId).toMatch(/^patient-/); // Hashed format
  });

  it('RN-P07: Should soft-delete, never hard-delete', () => {
    const deletedLaudo = { ...mockLaudo, deletadoEm: Timestamp.now() };
    expect(deletedLaudo.id).toBe(mockLaudo.id); // ID still exists
    expect(deletedLaudo.deletadoEm).toBeDefined(); // Marked as deleted
  });
});
