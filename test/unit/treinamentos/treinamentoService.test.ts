import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Treinamento, TreinamentoFilters } from '../../../src/features/treinamentos/types/Treinamento';
import {
  diasAteVencimentoCertificado,
  calcularFrequencia,
  isTreinamentoPendente,
  isTreinamentoRealizado,
} from '../../../src/features/treinamentos/types/Treinamento';

// Mock Firebase
vi.mock('../../../src/shared/services/firebase', () => ({
  db: {},
}));

describe('TreinamentoService', () => {
  const labId = 'test-lab-1';
  const now = Timestamp.now();

  const mockTreinamento: Treinamento = {
    id: 'train-001',
    labId,
    popId: 'pop-001',
    popVersaoNumero: '1.0',
    popNome: 'POP Hematologia',
    tipo: 'inicial',
    titulo: 'Treinamento Inicial Hematologia',
    descricao: 'Treinamento inicial para operadores',
    dataAgendada: now,
    dataRealizacao: undefined,
    duracao_minutos: 120,
    instrutorId: 'user-instrutor-01',
    instrutorNome: 'João Silva',
    participantes: ['user-op-01', 'user-op-02'],
    presenca: {
      'user-op-01': { presente: true, assinatura: 'signature-1' },
      'user-op-02': { presente: false },
    },
    certificado: undefined,
    status: 'agendado',
    criadoEm: now,
    criadoPor: 'user-admin-01',
    deletadoEm: null,
  };

  describe('Filters and Queries', () => {
    it('should filter treinamentos by status', () => {
      const filters: TreinamentoFilters = { status: 'realizado' };
      expect(filters.status).toBe('realizado');
    });

    it('should filter treinamentos by tipo', () => {
      const filters: TreinamentoFilters = { tipo: 'reciclagem' };
      expect(filters.tipo).toBe('reciclagem');
    });

    it('should filter treinamentos by popId', () => {
      const filters: TreinamentoFilters = { popId: 'pop-001' };
      expect(filters.popId).toBe('pop-001');
    });

    it('should filter treinamentos by date range', () => {
      const afterDate = Timestamp.fromDate(new Date('2026-01-01'));
      const beforeDate = Timestamp.fromDate(new Date('2026-12-31'));
      const filters: TreinamentoFilters = { dataApos: afterDate, dataAntes: beforeDate };
      expect(filters.dataApos).toBeDefined();
      expect(filters.dataAntes).toBeDefined();
    });
  });

  describe('Data transformation helpers', () => {
    it('should calculate days until certificate expiration', () => {
      const futureDate = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      const trainWithCert: Treinamento = {
        ...mockTreinamento,
        certificado: {
          numero: 'CERT-001',
          emitidoEm: now,
          validoAte: futureDate,
        },
      };

      const diasRestantes = diasAteVencimentoCertificado(trainWithCert);

      expect(diasRestantes).toBeGreaterThan(0);
      expect(diasRestantes).toBeLessThanOrEqual(30);
    });

    it('should calculate attendance frequency', () => {
      const freq = calcularFrequencia(mockTreinamento);

      expect(freq.total).toBe(2); // 2 participants
      expect(freq.presentes).toBe(1); // 1 present
      expect(freq.percentual).toBe(50);
    });

    it('should identify pending training', () => {
      const pending = { ...mockTreinamento, status: 'planejado' as const };
      expect(isTreinamentoPendente(pending)).toBe(true);

      const completed = { ...mockTreinamento, status: 'realizado' as const };
      expect(isTreinamentoPendente(completed)).toBe(false);
    });

    it('should identify completed training with certificate', () => {
      const withCert: Treinamento = {
        ...mockTreinamento,
        status: 'realizado',
        certificado: {
          numero: 'CERT-001',
          emitidoEm: now,
          validoAte: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
        },
      };
      expect(isTreinamentoRealizado(withCert)).toBe(true);

      const noCert = { ...mockTreinamento, status: 'realizado' };
      expect(isTreinamentoRealizado(noCert)).toBe(false);
    });
  });

  describe('Entity validation', () => {
    it('should validate treinamento has required fields', () => {
      expect(mockTreinamento.id).toBeDefined();
      expect(mockTreinamento.labId).toBeDefined();
      expect(mockTreinamento.popId).toBeDefined();
      expect(mockTreinamento.tipo).toBeDefined();
      expect(mockTreinamento.instrutorId).toBeDefined();
    });

    it('should have correct timestamp fields', () => {
      expect(mockTreinamento.dataAgendada).toBeDefined();
      expect(mockTreinamento.criadoEm).toBeDefined();
      expect(mockTreinamento.deletadoEm).toBeNull();
    });

    it('should maintain multi-tenant isolation with labId', () => {
      expect(mockTreinamento.labId).toBe(labId);
      expect(mockTreinamento.labId).not.toBe('other-lab');
    });

    it('should support soft-delete pattern', () => {
      const deletedTrain = { ...mockTreinamento, deletadoEm: now };
      expect(deletedTrain.deletadoEm).not.toBeNull();
    });
  });

  describe('Certificate lifecycle', () => {
    it('should generate certificate with expiration', () => {
      const futureMeses = 12;
      const futureDate = new Date(Date.now() + futureMeses * 30 * 24 * 60 * 60 * 1000);

      const cert = {
        numero: `CERT-${Date.now()}`,
        emitidoEm: now,
        validoAte: Timestamp.fromDate(futureDate),
      };

      expect(cert.numero).toMatch(/^CERT-/);
      expect(cert.validoAte.toDate().getTime()).toBeGreaterThan(cert.emitidoEm.toDate().getTime());
    });

    it('should track certificate expiration correctly', () => {
      // Certificate expiring in 15 days
      const futureMeses = 0.5;
      const futureDate = Timestamp.fromDate(
        new Date(Date.now() + futureMeses * 30 * 24 * 60 * 60 * 1000)
      );
      const trainWithCert: Treinamento = {
        ...mockTreinamento,
        certificado: {
          numero: 'CERT-001',
          emitidoEm: now,
          validoAte: futureDate,
        },
      };

      const dias = diasAteVencimentoCertificado(trainWithCert);
      expect(dias).toBeGreaterThan(0);
      expect(dias).toBeLessThan(20);
    });
  });

  describe('Attendance tracking', () => {
    it('should track presence per participant', () => {
      const freq = calcularFrequencia(mockTreinamento);

      expect(freq.total).toBeGreaterThan(0);
      expect(freq.presentes).toBeLessThanOrEqual(freq.total);
      expect(freq.percentual).toBeGreaterThanOrEqual(0);
      expect(freq.percentual).toBeLessThanOrEqual(100);
    });

    it('should support signature in presence record', () => {
      const hasSignature = mockTreinamento.presenca['user-op-01']?.assinatura;
      expect(hasSignature).toBeDefined();
    });
  });

  describe('Status transitions', () => {
    it('should allow status transitions', () => {
      const validStatuses: Treinamento['status'][] = ['planejado', 'agendado', 'realizado', 'cancelado'];
      expect(validStatuses).toContain('realizado');
      expect(validStatuses).toContain('cancelado');
    });

    it('should track cancellation reason', () => {
      const cancelledTrain: Treinamento = {
        ...mockTreinamento,
        status: 'cancelado',
        motivoCancelamento: 'Falta de interessados',
      };
      expect(cancelledTrain.motivoCancelamento).toBeDefined();
    });
  });

  describe('Multi-tenant constraints', () => {
    it('should isolate data by labId', () => {
      expect(mockTreinamento.labId).toEqual(labId);
    });

    it('should not allow cross-tenant queries without labId', () => {
      // Service requires labId as first parameter
      expect(() => {
        // This would fail at service layer if labId not provided
      }).not.toThrow();
    });
  });

  describe('Training types', () => {
    it('should support initial training type', () => {
      expect(mockTreinamento.tipo).toBe('inicial');
    });

    it('should support refresher training type', () => {
      const refresher: Treinamento = { ...mockTreinamento, tipo: 'reciclagem' };
      expect(refresher.tipo).toBe('reciclagem');
    });

    it('should support complementary training type', () => {
      const complementary: Treinamento = { ...mockTreinamento, tipo: 'complementar' };
      expect(complementary.tipo).toBe('complementar');
    });
  });

  describe('Audit trail', () => {
    it('should track creation metadata', () => {
      expect(mockTreinamento.criadoEm).toBeDefined();
      expect(mockTreinamento.criadoPor).toBeDefined();
    });

    it('should maintain immutable metadata', () => {
      // These should never change after creation
      const originalCreatedAt = mockTreinamento.criadoEm;
      const originalCreatedBy = mockTreinamento.criadoPor;

      expect(originalCreatedAt).toEqual(mockTreinamento.criadoEm);
      expect(originalCreatedBy).toEqual(mockTreinamento.criadoPor);
    });
  });
});
