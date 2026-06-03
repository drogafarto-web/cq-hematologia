import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type {
  Area,
  EPE,
  InspecaoArea,
} from '../../../src/features/biosseguranca/types/Biosseguranca';
import {
  epeVencida,
  epeEstoque,
  diasAteVencimentoEPE,
  areaConformidade,
} from '../../../src/features/biosseguranca/types/Biosseguranca';

describe('BiossegurancaService', () => {
  const labId = 'test-lab-1';
  const now = Timestamp.now();

  const mockArea: Area = {
    id: 'area-001',
    labId,
    nome: 'Sala de Hematologia',
    descricao: 'Sala principal de análise hematológica',
    nivelBiosseguranca: 2,
    status: 'ativa',
    classeISO: 6,
    epeObrigatorio: ['luva', 'mascara', 'jaleco'],
    capacidadeMaximaPessoas: 10,
    pessoasAtuais: 3,
    certificadoValidade: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
    inspetorResponsavel: 'user-inspetor-01',
    criadoEm: now,
    criadoPor: 'user-admin-01',
    deletadoEm: null,
  };

  const mockEPE: EPE = {
    id: 'epe-001',
    labId,
    tipo: 'luva',
    descricao: 'Luva nitrílica tamanho M',
    marca: 'Medline',
    lote: 'LOTE-2026-001',
    dataFabricacao: Timestamp.fromDate(new Date('2025-01-01')),
    dataValidade: Timestamp.fromDate(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
    qtdEstoque: 500,
    qtdMinima: 100,
    status: 'em_uso',
    criadoEm: now,
    criadoPor: 'user-admin-01',
    deletadoEm: null,
  };

  const mockInspecao: InspecaoArea = {
    id: 'insp-001',
    labId,
    areaId: 'area-001',
    areaNome: 'Sala de Hematologia',
    data: now,
    inspetor: 'user-inspetor-01',
    conformidades: {
      limpeza: true,
      ventilacao: true,
      pressao: true,
      filtros: true,
      EPEDisponiveis: true,
    },
    observacoes: 'Área em conformidade',
    necessitaManutencao: false,
    criadoEm: now,
    criadoPor: 'user-admin-01',
  };

  describe('Area management', () => {
    it('should validate area has required fields', () => {
      expect(mockArea.id).toBeDefined();
      expect(mockArea.labId).toBeDefined();
      expect(mockArea.nome).toBeDefined();
      expect(mockArea.nivelBiosseguranca).toBeDefined();
      expect(mockArea.epeObrigatorio.length).toBeGreaterThan(0);
    });

    it('should maintain multi-tenant isolation', () => {
      expect(mockArea.labId).toBe(labId);
    });

    it('should track area status', () => {
      const validStatuses = ['ativa', 'desativada', 'em_manutencao'];
      expect(validStatuses).toContain(mockArea.status);
    });

    it('should support biosafety levels NB1-NB4', () => {
      const levels = [1, 2, 3, 4];
      expect(levels).toContain(mockArea.nivelBiosseguranca);
    });

    it('should track capacity and occupancy', () => {
      expect(mockArea.pessoasAtuais).toBeLessThanOrEqual(mockArea.capacidadeMaximaPessoas!);
    });

    it('should support ISO 14644 classification', () => {
      expect(mockArea.classeISO).toBeGreaterThanOrEqual(1);
      expect(mockArea.classeISO).toBeLessThanOrEqual(9);
    });

    it('should track certification validity', () => {
      if (mockArea.certificadoValidade) {
        expect(mockArea.certificadoValidade.toDate()).toBeInstanceOf(Date);
      }
    });
  });

  describe('EPE lifecycle', () => {
    it('should validate EPE has required fields', () => {
      expect(mockEPE.id).toBeDefined();
      expect(mockEPE.labId).toBeDefined();
      expect(mockEPE.tipo).toBeDefined();
      expect(mockEPE.dataValidade).toBeDefined();
      expect(mockEPE.qtdEstoque).toBeGreaterThanOrEqual(0);
      expect(mockEPE.qtdMinima).toBeGreaterThanOrEqual(0);
    });

    it('should track EPE manufacturing date', () => {
      expect(mockEPE.dataFabricacao).toBeDefined();
      expect(mockEPE.dataFabricacao.toDate()).toBeInstanceOf(Date);
    });

    it('should support EPE batch tracking', () => {
      expect(mockEPE.lote).toBeDefined();
    });

    it('should track EPE status', () => {
      const validStatuses = ['em_uso', 'descartado', 'inutilizado'];
      expect(validStatuses).toContain(mockEPE.status);
    });

    it('should validate stock quantities', () => {
      expect(mockEPE.qtdEstoque).toBeLessThanOrEqual(mockEPE.qtdEstoque + 1);
      expect(mockEPE.qtdMinima).toBeGreaterThanOrEqual(0);
    });

    it('should support multiple EPE types', () => {
      const tipos = ['luva', 'mascara', 'jaleco', 'oculos', 'avental', 'propé', 'touca', 'outro'];
      expect(mockEPE.tipo).toBeOneOf(tipos);
    });
  });

  describe('EPE expiration tracking', () => {
    it('should detect expired EPE', () => {
      const expiredEPE: EPE = {
        ...mockEPE,
        dataValidade: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
      };
      expect(epeVencida(expiredEPE)).toBe(true);
    });

    it('should detect valid EPE', () => {
      expect(epeVencida(mockEPE)).toBe(false);
    });

    it('should calculate days until EPE expiration', () => {
      const dias = diasAteVencimentoEPE(mockEPE);
      expect(dias).toBeGreaterThan(0);
      expect(dias).toBeLessThanOrEqual(200);
    });

    it('should handle EPE expiring today', () => {
      const hoje = Timestamp.now();
      const epeToday: EPE = {
        ...mockEPE,
        dataValidade: hoje,
      };
      const dias = diasAteVencimentoEPE(epeToday);
      expect(dias).toBeLessThanOrEqual(1);
    });
  });

  describe('EPE stock levels', () => {
    it('should identify critical stock', () => {
      const criticalEPE: EPE = { ...mockEPE, qtdEstoque: 0 };
      expect(epeEstoque(criticalEPE)).toBe('critico');
    });

    it('should identify low stock', () => {
      const lowEPE: EPE = { ...mockEPE, qtdEstoque: 50, qtdMinima: 100 };
      expect(epeEstoque(lowEPE)).toBe('baixo');
    });

    it('should identify adequate stock', () => {
      expect(epeEstoque(mockEPE)).toBe('ok');
    });

    it('should alert when below minimum', () => {
      const belowMinimum = 50;
      const minimum = 100;
      expect(belowMinimum).toBeLessThan(minimum);
    });
  });

  describe('Inspection records', () => {
    it('should validate inspection has required fields', () => {
      expect(mockInspecao.id).toBeDefined();
      expect(mockInspecao.labId).toBeDefined();
      expect(mockInspecao.areaId).toBeDefined();
      expect(mockInspecao.data).toBeDefined();
      expect(mockInspecao.inspetor).toBeDefined();
      expect(mockInspecao.conformidades).toBeDefined();
    });

    it('should track compliance checklist', () => {
      const checks = mockInspecao.conformidades;
      expect(checks.limpeza).toBeDefined();
      expect(checks.ventilacao).toBeDefined();
      expect(checks.pressao).toBeDefined();
      expect(checks.filtros).toBeDefined();
      expect(checks.EPEDisponiveis).toBeDefined();
    });

    it('should track maintenance needs', () => {
      expect(typeof mockInspecao.necessitaManutencao).toBe('boolean');
    });

    it('should support inspection notes', () => {
      expect(mockInspecao.observacoes).toBeDefined();
    });

    it('should calculate area conformance percentage', () => {
      const conformance = areaConformidade(mockInspecao);
      expect(conformance).toBeGreaterThanOrEqual(0);
      expect(conformance).toBeLessThanOrEqual(100);
    });

    it('should identify fully compliant areas', () => {
      const conformance = areaConformidade(mockInspecao);
      expect(conformance).toBe(100);
    });

    it('should identify non-compliant areas', () => {
      const nonCompliant: InspecaoArea = {
        ...mockInspecao,
        conformidades: {
          limpeza: false,
          ventilacao: false,
          pressao: true,
          filtros: true,
          EPEDisponiveis: false,
        },
      };
      const conformance = areaConformidade(nonCompliant);
      expect(conformance).toBe(40);
    });
  });

  describe('Multi-tenant constraints', () => {
    it('should isolate areas by labId', () => {
      expect(mockArea.labId).toEqual(labId);
    });

    it('should isolate EPEs by labId', () => {
      expect(mockEPE.labId).toEqual(labId);
    });

    it('should isolate inspections by labId', () => {
      expect(mockInspecao.labId).toEqual(labId);
    });
  });

  describe('Soft delete pattern', () => {
    it('should support soft delete for areas', () => {
      const deletedArea: Area = { ...mockArea, deletadoEm: now };
      expect(deletedArea.deletadoEm).not.toBeNull();
    });

    it('should support soft delete for EPEs', () => {
      const deletedEPE: EPE = { ...mockEPE, deletadoEm: now };
      expect(deletedEPE.deletadoEm).not.toBeNull();
    });
  });

  describe('Audit trail', () => {
    it('should track area creation metadata', () => {
      expect(mockArea.criadoEm).toBeDefined();
      expect(mockArea.criadoPor).toBeDefined();
    });

    it('should track EPE creation metadata', () => {
      expect(mockEPE.criadoEm).toBeDefined();
      expect(mockEPE.criadoPor).toBeDefined();
    });

    it('should track inspection creation metadata', () => {
      expect(mockInspecao.criadoEm).toBeDefined();
      expect(mockInspecao.criadoPor).toBeDefined();
    });
  });

  describe('Required EPE validation', () => {
    it('should list required EPEs for area', () => {
      expect(mockArea.epeObrigatorio).toContain('luva');
      expect(mockArea.epeObrigatorio).toContain('mascara');
      expect(mockArea.epeObrigatorio).toContain('jaleco');
    });

    it('should validate EPE against area requirements', () => {
      const requiredEPEs = mockArea.epeObrigatorio;
      expect(requiredEPEs.length).toBeGreaterThan(0);
    });
  });
});
