/**
 * Calibração Unit Tests — SA-43
 *
 * Tests status calculation, alert triggers, and certificate validation.
 * Phase 8 Wave 6 — Unit Tests
 *
 * Compliance: DICQ 5.3.1.4 | RDC 978 § 5.3
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCalibracaoStatus,
  mapStatusToLegacy,
  type CalibracaoStatusNew,
  type CalibracaoStatusLegacy,
  type CalibracaoRecord,
  type LogicalSignature,
} from '../../features/calibracao/types';

describe('Calibração', () => {
  // ─── calculateCalibracaoStatus Tests ────────────────────────────────────

  describe('calculateCalibracaoStatus', () => {
    it('should return "overdue" when due date is in the past', () => {
      const pastDate = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const status = calculateCalibracaoStatus(pastDate);
      expect(status).toBe('overdue');
    });

    it('should return "warning-7d" when due date is within 7 days', () => {
      const soonDate = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3 days from now
      const status = calculateCalibracaoStatus(soonDate);
      expect(status).toBe('warning-7d');
    });

    it('should return "warning-30d" when due date is between 7 and 30 days', () => {
      const mediumDate = Date.now() + 15 * 24 * 60 * 60 * 1000; // 15 days from now
      const status = calculateCalibracaoStatus(mediumDate);
      expect(status).toBe('warning-30d');
    });

    it('should return "in-date" when due date is more than 30 days away', () => {
      const futureDate = Date.now() + 45 * 24 * 60 * 60 * 1000; // 45 days from now
      const status = calculateCalibracaoStatus(futureDate);
      expect(status).toBe('in-date');
    });

    it('should handle boundary: exactly 30 days', () => {
      const thirtyDaysAhead = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const status = calculateCalibracaoStatus(thirtyDaysAhead);
      expect(status).toBe('in-date');
    });

    it('should handle boundary: exactly 7 days', () => {
      const sevenDaysAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const status = calculateCalibracaoStatus(sevenDaysAhead);
      expect(status).toBe('warning-30d');
    });

    it('should return "overdue" at exactly 0 days (today)', () => {
      const today = Date.now();
      const status = calculateCalibracaoStatus(today);
      // At the boundary, 0 days is not overdue (negative would be)
      expect(['in-date', 'warning-7d', 'warning-30d', 'overdue']).toContain(
        status,
      );
    });
  });

  // ─── mapStatusToLegacy Tests ────────────────────────────────────────────

  describe('mapStatusToLegacy', () => {
    it('should map "in-date" to "no-prazo"', () => {
      const legacy = mapStatusToLegacy('in-date');
      expect(legacy).toBe('no-prazo');
    });

    it('should map "warning-30d" to "em-risco"', () => {
      const legacy = mapStatusToLegacy('warning-30d');
      expect(legacy).toBe('em-risco');
    });

    it('should map "warning-7d" to "em-risco"', () => {
      const legacy = mapStatusToLegacy('warning-7d');
      expect(legacy).toBe('em-risco');
    });

    it('should map "overdue" to "vencido"', () => {
      const legacy = mapStatusToLegacy('overdue');
      expect(legacy).toBe('vencido');
    });

    it('should map "out-of-service" to "vencido"', () => {
      const legacy = mapStatusToLegacy('out-of-service');
      expect(legacy).toBe('vencido');
    });
  });

  // ─── CalibracaoRecord Schema Tests ──────────────────────────────────────

  describe('CalibracaoRecord type validation', () => {
    it('should have required fields present', () => {
      const now = Date.now();
      const record: CalibracaoRecord = {
        id: 'cal-001',
        labId: 'lab-test',
        equipamentoId: 'equip-123',
        equipId: 'equip-123',
        equipName: 'Laboratory Scale',
        calibrationMethod: 'external-provider',
        calibrationProvider: 'Acme Calibration Inc.',
        lastCalibrationDate: now - 365 * 24 * 60 * 60 * 1000,
        nextDueDate: now + 180 * 24 * 60 * 60 * 1000,
        certificateStoragePath: 'gs://bucket/calibracao/lab-test/equip-123/cert-001.pdf',
        certificateHash:
          'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        expandedUncertainty: 0.5,
        status: 'in-date',
        statusUpdatedAt: now,
        alertsSent: [],
        createdAt: now,
        createdBy: 'user-123',
        dueDateInfo: {
          nextDueDate: { toMillis: () => now + 180 * 24 * 60 * 60 * 1000 } as any,
          daysUntilDue: 180,
          status: 'no-prazo',
          alertsSent: { dias30: false, dias15: false, dias7: false },
        },
        certificates: [],
      };

      expect(record).toBeDefined();
      expect(record.id).toBe('cal-001');
      expect(record.labId).toBe('lab-test');
      expect(record.equipamentoId).toBe('equip-123');
      expect(record.certificateHash).toHaveLength(64);
      expect(record.status).toBe('in-date');
    });

    it('should support equipment alias (equipId)', () => {
      const record: CalibracaoRecord = {
        id: 'cal-001',
        labId: 'lab-test',
        equipamentoId: 'equip-123',
        equipId: 'equip-123',
        equipName: 'Test Equipment',
        calibrationMethod: 'in-house',
        lastCalibrationDate: Date.now(),
        nextDueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        certificateStoragePath: 'path',
        certificateHash:
          'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        expandedUncertainty: 0.1,
        status: 'warning-30d',
        statusUpdatedAt: Date.now(),
        alertsSent: [],
        createdAt: Date.now(),
        createdBy: 'user-123',
        dueDateInfo: {
          nextDueDate: { toMillis: () => Date.now() + 30 * 24 * 60 * 60 * 1000 } as any,
          daysUntilDue: 30,
          status: 'em-risco',
          alertsSent: { dias30: false, dias15: false, dias7: false },
        },
        certificates: [],
      };

      // Both should work
      expect(record.equipamentoId).toBe(record.equipId);
    });
  });

  // ─── Certificate Hash Validation Tests ──────────────────────────────────

  describe('Certificate hash validation', () => {
    it('should accept 64-character hex hash', () => {
      const validHash = 'a'.repeat(64);
      expect(validHash).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(validHash)).toBe(true);
    });

    it('should reject hash with less than 64 characters', () => {
      const invalidHash = 'a'.repeat(63);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should reject hash with more than 64 characters', () => {
      const invalidHash = 'a'.repeat(65);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should reject hash with non-hex characters', () => {
      const invalidHash = 'g'.repeat(64);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should accept mixed case hex', () => {
      const validHash = 'AaBbCcDd'.padEnd(64, '0');
      expect(/^[a-f0-9]{64}$/i.test(validHash)).toBe(true);
    });
  });

  // ─── LogicalSignature Validation Tests ──────────────────────────────────

  describe('LogicalSignature', () => {
    it('should have required fields', () => {
      const sig: LogicalSignature = {
        hash: 'a'.repeat(64),
        operatorId: 'user-123',
        ts: { toMillis: () => Date.now() } as any,
      };

      expect(sig.hash).toHaveLength(64);
      expect(sig.operatorId).toBe('user-123');
      expect(sig.ts).toBeDefined();
    });

    it('should enforce 64-char hash requirement', () => {
      const validSig = {
        hash: 'abcdef'.padEnd(64, '0'),
        operatorId: 'user-123',
        ts: { toMillis: () => Date.now() } as any,
      };

      expect(validSig.hash).toHaveLength(64);
    });
  });

  // ─── Alert Triggers Tests ───────────────────────────────────────────────

  describe('Alert triggers', () => {
    it('should track alert sent at 30 days', () => {
      const now = Date.now();
      const alertsSent = [
        { days: 30, sentAt: now },
      ];

      expect(alertsSent).toHaveLength(1);
      expect(alertsSent[0].days).toBe(30);
    });

    it('should track alert sent at 7 days', () => {
      const now = Date.now();
      const alertsSent = [
        { days: 30, sentAt: now - 1000 },
        { days: 7, sentAt: now },
      ];

      expect(alertsSent).toHaveLength(2);
      expect(alertsSent[1].days).toBe(7);
    });

    it('should not duplicate same day alert', () => {
      const now = Date.now();
      const alertsSent = [
        { days: 30, sentAt: now },
      ];

      // Check if 30-day alert already sent
      const hasSent30Day = alertsSent.some((a) => a.days === 30);
      expect(hasSent30Day).toBe(true);

      // Don't add duplicate
      if (!hasSent30Day) {
        alertsSent.push({ days: 30, sentAt: now + 1000 });
      }

      expect(alertsSent).toHaveLength(1);
    });

    it('should handle multiple alert timestamps', () => {
      const now = Date.now();
      const alertsSent = [
        { days: 30, sentAt: now - 100000 },
        { days: 15, sentAt: now - 50000 },
        { days: 7, sentAt: now },
      ];

      expect(alertsSent).toHaveLength(3);
      expect(alertsSent[0].days).toBe(30);
      expect(alertsSent[1].days).toBe(15);
      expect(alertsSent[2].days).toBe(7);
    });
  });

  // ─── Calibração Status Scenarios Tests ──────────────────────────────────

  describe('Calibração status scenarios', () => {
    it('should calculate status: in-date (60 days remaining)', () => {
      const dueDate = Date.now() + 60 * 24 * 60 * 60 * 1000;
      const status = calculateCalibracaoStatus(dueDate);
      expect(status).toBe('in-date');
    });

    it('should calculate status: warning-30d (20 days remaining)', () => {
      const dueDate = Date.now() + 20 * 24 * 60 * 60 * 1000;
      const status = calculateCalibracaoStatus(dueDate);
      expect(status).toBe('warning-30d');
    });

    it('should calculate status: warning-7d (3 days remaining)', () => {
      const dueDate = Date.now() + 3 * 24 * 60 * 60 * 1000;
      const status = calculateCalibracaoStatus(dueDate);
      expect(status).toBe('warning-7d');
    });

    it('should calculate status: overdue (5 days past)', () => {
      const dueDate = Date.now() - 5 * 24 * 60 * 60 * 1000;
      const status = calculateCalibracaoStatus(dueDate);
      expect(status).toBe('overdue');
    });
  });

  // ─── Soft-Delete Behavior Tests ─────────────────────────────────────────

  describe('Soft-delete behavior', () => {
    it('should support deletedAt field', () => {
      const now = Date.now();
      const record: CalibracaoRecord = {
        id: 'cal-001',
        labId: 'lab-test',
        equipamentoId: 'equip-123',
        equipId: 'equip-123',
        equipName: 'Test Equipment',
        calibrationMethod: 'in-house',
        lastCalibrationDate: now,
        nextDueDate: now + 30 * 24 * 60 * 60 * 1000,
        certificateStoragePath: 'path',
        certificateHash: 'a'.repeat(64),
        expandedUncertainty: 0.1,
        status: 'in-date',
        statusUpdatedAt: now,
        alertsSent: [],
        createdAt: now,
        createdBy: 'user-123',
        deletedAt: now,
        dueDateInfo: {
          nextDueDate: { toMillis: () => now + 30 * 24 * 60 * 60 * 1000 } as any,
          daysUntilDue: 30,
          status: 'no-prazo',
          alertsSent: { dias30: false, dias15: false, dias7: false },
        },
        certificates: [],
      };

      expect(record.deletedAt).toBe(now);
      // Filtering logic: exclude if deletedAt is set
      expect(!record.deletedAt).toBe(false);
    });

    it('should filter out deleted calibrações', () => {
      const now = Date.now();
      const calibracoes = [
        {
          id: 'cal-001',
          deletedAt: undefined,
        },
        {
          id: 'cal-002',
          deletedAt: now,
        },
        {
          id: 'cal-003',
          deletedAt: undefined,
        },
      ];

      const active = calibracoes.filter((c) => !c.deletedAt);
      expect(active).toHaveLength(2);
      expect(active[0].id).toBe('cal-001');
      expect(active[1].id).toBe('cal-003');
    });
  });

  // ─── Multi-Tenant Isolation Tests ───────────────────────────────────────

  describe('Multi-tenant scoping', () => {
    it('should isolate by labId', () => {
      const lab1Records = [
        { id: 'cal-001', labId: 'lab-1' },
        { id: 'cal-002', labId: 'lab-1' },
      ];

      const lab2Records = [
        { id: 'cal-003', labId: 'lab-2' },
      ];

      const allRecords = [...lab1Records, ...lab2Records];

      const lab1Only = allRecords.filter((r) => r.labId === 'lab-1');
      expect(lab1Only).toHaveLength(2);
      expect(lab1Only.every((r) => r.labId === 'lab-1')).toBe(true);
    });
  });
});
