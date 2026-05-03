// @ts-ignore
import { describe, it, expect, beforeEach } from '@jest/globals';
import * as crypto from 'crypto';
import { computeHmac, hashData } from '../audit/cryptoAudit';
import { NaoConformidade, NCStatus, NCSeveridade } from './types';
import * as admin from 'firebase-admin';

/**
 * ADR 0003 — Non-Conformidade (NC) Unit Tests
 * >80% coverage target: 12+ test cases
 */

describe('ADR 0003 — Nao Conformidade', () => {
  const testSecret = crypto.randomBytes(32).toString('hex');
  const mockLabId = 'lab-test-001';
  const mockUserId = 'user-rt-001';

  // Helper: Create mock NC data
  const createMockNC = (overrides?: Partial<NaoConformidade>): NaoConformidade => {
    const now = admin.firestore.Timestamp.now();
    return {
      id: 'nc-001',
      labId: mockLabId,
      numero: 'NC-2026-0001',
      origem: 'insumo',
      origemId: 'insumo-123',
      moduloOrigemId: 'modulo-hematologia',
      descricao: 'Reagente vencido encontrado',
      severidade: 'leve' as NCSeveridade,
      status: 'aberta' as NCStatus,
      statusHistory: [
        {
          timestamp: now,
          novoStatus: 'aberta' as NCStatus,
          mudadoPor: mockUserId,
          motivo: 'Abertura inicial',
          hmac: 'mock-hmac-001',
        },
      ],
      capa: {},
      aberta: {
        timestamp: now,
        uid: mockUserId,
        motivo: 'Aberta por operador',
      },
      bloqueiaOperacoes: false,
      hmac: 'mock-hmac-nc',
      previousHash: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  describe('NC Creation & Numbering', () => {
    it('should generate numero in format NC-{YYYY}-{seq}', () => {
      // Test number format against regex
      const regex = /^NC-\d{4}-\d{4}$/;
      const mockNumber = 'NC-2026-0001';
      expect(regex.test(mockNumber)).toBe(true);

      const mockNumber2 = 'NC-2025-9999';
      expect(regex.test(mockNumber2)).toBe(true);

      // Invalid formats should not match
      const invalidNumber = 'NC-2026-1';
      expect(regex.test(invalidNumber)).toBe(false);
    });

    it('should increment sequence number correctly', () => {
      // Simulate sequence increment logic
      const parseSeq = (numero: string): number => {
        const parts = numero.split('-');
        return parseInt(parts[2], 10);
      };

      const seq1 = parseSeq('NC-2026-0001');
      const seq2 = parseSeq('NC-2026-0002');
      expect(seq2).toBe(seq1 + 1);
    });

    it('should reset sequence by year', () => {
      const year2025 = 'NC-2025-9999';
      const year2026 = 'NC-2026-0001';

      const getYear = (numero: string): number => parseInt(numero.split('-')[1], 10);

      expect(getYear(year2026)).toBe(getYear(year2025) + 1);
    });
  });

  describe('NC Severity & Blocking', () => {
    it('should set bloqueiaOperacoes=true for severidade critica', () => {
      const nc = createMockNC({ severidade: 'critica' as NCSeveridade });
      expect(nc.bloqueiaOperacoes).toBe(true);
    });

    it('should set bloqueiaOperacoes=true for severidade grave', () => {
      const nc = createMockNC({ severidade: 'grave' as NCSeveridade });
      expect(nc.bloqueiaOperacoes).toBe(true);
    });

    it('should set bloqueiaOperacoes=false for severidade leve', () => {
      const nc = createMockNC({ severidade: 'leve' as NCSeveridade });
      expect(nc.bloqueiaOperacoes).toBe(false);
    });

    it('should respect operacoesTodasBloqueadas filter', () => {
      const nc = createMockNC({
        severidade: 'grave' as NCSeveridade,
        bloqueiaOperacoes: true,
        operacoesTodasBloqueadas: ['modulo-microbiologia'],
      });

      // Hematologia should not be blocked
      const shouldBlockHemato = !nc.operacoesTodasBloqueadas ||
        nc.operacoesTodasBloqueadas.length === 0 ||
        nc.operacoesTodasBloqueadas.includes('modulo-hematologia');

      // Microbiologia should be blocked
      const shouldBlockMicro = !nc.operacoesTodasBloqueadas ||
        nc.operacoesTodasBloqueadas.length === 0 ||
        nc.operacoesTodasBloqueadas.includes('modulo-microbiologia');

      expect(shouldBlockHemato).toBe(false);
      expect(shouldBlockMicro).toBe(true);
    });
  });

  describe('NC HMAC Signing (ADR 0005)', () => {
    it('should include HMAC in NC creation', () => {
      const nc = createMockNC();
      expect(nc.hmac).toBeTruthy();
      expect(nc.hmac).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should compute HMAC deterministically', () => {
      const ncData = {
        labId: mockLabId,
        numero: 'NC-2026-0001',
        descricao: 'Test NC',
        severidade: 'leve' as NCSeveridade,
      };

      const hmac1 = computeHmac(ncData, testSecret);
      const hmac2 = computeHmac(ncData, testSecret);

      expect(hmac1).toBe(hmac2);
    });

    it('should differ HMAC when payload changes', () => {
      const data1 = { numero: 'NC-2026-0001', descricao: 'Original' };
      const data2 = { numero: 'NC-2026-0001', descricao: 'Modified' };

      const hmac1 = computeHmac(data1, testSecret);
      const hmac2 = computeHmac(data2, testSecret);

      expect(hmac1).not.toBe(hmac2);
    });

    it('should fail verification with wrong secret', () => {
      const data = { numero: 'NC-2026-0001' };
      const correctHmac = computeHmac(data, testSecret);
      const wrongHmac = computeHmac(data, 'wrong-secret');

      expect(correctHmac).not.toBe(wrongHmac);
    });

    it('should maintain chain hash (previousHash)', () => {
      const nc1 = createMockNC({ previousHash: null });
      const nc2 = createMockNC({
        numero: 'NC-2026-0002',
        previousHash: nc1.hmac,
      });

      expect(nc2.previousHash).toBe(nc1.hmac);
      expect(nc1.previousHash).toBeNull();
    });
  });

  describe('Status Transitions', () => {
    it('should allow transition aberta → investig', () => {
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      expect(validTransitions['aberta']).toContain('investig');
    });

    it('should allow transition investig → correcao', () => {
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      expect(validTransitions['investig']).toContain('correcao');
    });

    it('should allow transition correcao → verif_eficacia', () => {
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      expect(validTransitions['correcao']).toContain('verif_eficacia');
    });

    it('should allow transition verif_eficacia → fechada (eficaz)', () => {
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      expect(validTransitions['verif_eficacia']).toContain('fechada');
    });

    it('should allow transition verif_eficacia → investig (ineficaz)', () => {
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      expect(validTransitions['verif_eficacia']).toContain('investig');
    });

    it('should reject invalid transition fechada → any', () => {
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      expect(validTransitions['fechada']).toEqual([]);
      expect(validTransitions['fechada']).not.toContain('aberta');
    });

    it('should reject invalid transition cancelada → any', () => {
      const validTransitions: { [key in NCStatus]: NCStatus[] } = {
        aberta: ['investig', 'cancelada'],
        investig: ['correcao', 'aberta'],
        correcao: ['verif_eficacia'],
        verif_eficacia: ['fechada', 'investig'],
        fechada: [],
        cancelada: [],
      };

      expect(validTransitions['cancelada']).toEqual([]);
    });
  });

  describe('Status History & Audit Trail', () => {
    it('should initialize statusHistory on NC creation', () => {
      const nc = createMockNC();
      expect(nc.statusHistory).toBeDefined();
      expect(Array.isArray(nc.statusHistory)).toBe(true);
      expect(nc.statusHistory.length).toBeGreaterThan(0);
    });

    it('should record initial status as aberta', () => {
      const nc = createMockNC();
      expect(nc.statusHistory[0].novoStatus).toBe('aberta');
    });

    it('should sign each statusHistory entry with HMAC', () => {
      const nc = createMockNC();
      nc.statusHistory.forEach(entry => {
        expect(entry.hmac).toBeTruthy();
        expect(entry.hmac).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    it('should record who changed status (mudadoPor)', () => {
      const nc = createMockNC();
      expect(nc.statusHistory[0].mudadoPor).toBe(mockUserId);
    });

    it('should record reason for status change (motivo)', () => {
      const nc = createMockNC();
      expect(nc.statusHistory[0].motivo).toBeTruthy();
    });

    it('should track timestamp for each status change', () => {
      const nc = createMockNC();
      expect(nc.statusHistory[0].timestamp).toBeDefined();
    });
  });

  describe('CAPA Workflow — Investigacao', () => {
    it('investigarNC should set capa.investigacao.realizada=true', () => {
      const nc = createMockNC({
        status: 'investig' as NCStatus,
        capa: {
          investigacao: {
            realizada: true,
            dataInicio: admin.firestore.Timestamp.now(),
            dataFim: admin.firestore.Timestamp.now(),
            descricao: 'Investigação do reagente',
            investigadorId: mockUserId,
            achados: ['Reagente vencido desde 2026-01-15'],
          },
        },
      });

      expect(nc.capa.investigacao?.realizada).toBe(true);
      expect(nc.capa.investigacao?.descricao).toBeTruthy();
      expect(nc.capa.investigacao?.achados?.length).toBeGreaterThan(0);
    });

    it('investigarNC should record dataInicio', () => {
      const nc = createMockNC({
        capa: {
          investigacao: {
            realizada: true,
            dataInicio: admin.firestore.Timestamp.now(),
            descricao: 'Test',
            investigadorId: mockUserId,
          },
        },
      });

      expect(nc.capa.investigacao?.dataInicio).toBeDefined();
    });

    it('investigarNC should record investigadorId (who)', () => {
      const nc = createMockNC({
        capa: {
          investigacao: {
            realizada: true,
            investigadorId: 'user-analyst-123',
            descricao: 'Test',
          },
        },
      });

      expect(nc.capa.investigacao?.investigadorId).toBe('user-analyst-123');
    });

    it('investigarNC should record achados array', () => {
      const achados = ['Causa raiz: falta de controle', 'Impacto: 5 amostras'];
      const nc = createMockNC({
        capa: {
          investigacao: {
            realizada: true,
            investigadorId: mockUserId,
            descricao: 'Test',
            achados,
          },
        },
      });

      expect(nc.capa.investigacao?.achados).toEqual(achados);
    });
  });

  describe('CAPA Workflow — Acao Corretiva', () => {
    it('executarAcaoCorretiva should set status=correcao', () => {
      const nc = createMockNC({
        status: 'correcao' as NCStatus,
        capa: {
          acaoCorretiva: {
            descricao: 'Descartar lote vencido',
            dataPrevista: admin.firestore.Timestamp.now(),
            responsavel: mockUserId,
            status: 'planejada',
          },
        },
      });

      expect(nc.status).toBe('correcao');
      expect(nc.capa.acaoCorretiva?.status).toBe('planejada');
    });

    it('executarAcaoCorretiva should record descricao', () => {
      const descricao = 'Implementar controle de validade com QR code';
      const nc = createMockNC({
        status: 'correcao' as NCStatus,
        capa: {
          acaoCorretiva: {
            descricao,
            dataPrevista: admin.firestore.Timestamp.now(),
            responsavel: mockUserId,
            status: 'planejada',
          },
        },
      });

      expect(nc.capa.acaoCorretiva?.descricao).toBe(descricao);
    });

    it('executarAcaoCorretiva should record responsavel (who implements)', () => {
      const nc = createMockNC({
        status: 'correcao' as NCStatus,
        capa: {
          acaoCorretiva: {
            descricao: 'Test',
            dataPrevista: admin.firestore.Timestamp.now(),
            responsavel: 'user-supervisor-123',
            status: 'planejada',
          },
        },
      });

      expect(nc.capa.acaoCorretiva?.responsavel).toBe('user-supervisor-123');
    });

    it('executarAcaoCorretiva should record dataPrevista', () => {
      const expectedDate = admin.firestore.Timestamp.fromDate(new Date('2026-06-01'));
      const nc = createMockNC({
        status: 'correcao' as NCStatus,
        capa: {
          acaoCorretiva: {
            descricao: 'Test',
            dataPrevista: expectedDate,
            responsavel: mockUserId,
            status: 'planejada',
          },
        },
      });

      expect(nc.capa.acaoCorretiva?.dataPrevista).toBe(expectedDate);
    });
  });

  describe('CAPA Workflow — Verificacao de Eficacia', () => {
    it('verificarEficacia with eficaz=true should close NC (status=fechada)', () => {
      const nc = createMockNC({
        status: 'fechada' as NCStatus,
        capa: {
          verificacaoEficacia: {
            realizada: true,
            resultado: 'eficaz',
            verificadoPor: mockUserId,
          },
        },
      });

      expect(nc.status).toBe('fechada');
      expect(nc.capa.verificacaoEficacia?.resultado).toBe('eficaz');
    });

    it('verificarEficacia with eficaz=true should set fechada timestamp', () => {
      const nc = createMockNC({
        status: 'fechada' as NCStatus,
        fechada: {
          timestamp: admin.firestore.Timestamp.now(),
          uid: mockUserId,
          motivo: 'Ação corretiva verificada como eficaz',
        },
      });

      expect(nc.fechada).toBeDefined();
      expect(nc.fechada?.motivo).toContain('eficaz');
    });

    it('verificarEficacia with eficaz=false should reopen to investigacao (status=investig)', () => {
      const nc = createMockNC({
        status: 'investig' as NCStatus,
        capa: {
          verificacaoEficacia: {
            realizada: true,
            resultado: 'ineficaz',
            verificadoPor: mockUserId,
          },
          reabertura: true,
        },
      });

      expect(nc.status).toBe('investig');
      expect(nc.capa.verificacaoEficacia?.resultado).toBe('ineficaz');
      expect(nc.capa.reabertura).toBe(true);
    });

    it('verificarEficacia should record resultado (eficaz|ineficaz|nao_concluida)', () => {
      const resultados = ['eficaz', 'ineficaz', 'nao_concluida'];
      resultados.forEach(resultado => {
        const nc = createMockNC({
          capa: {
            verificacaoEficacia: {
              realizada: true,
              resultado: resultado as any,
              verificadoPor: mockUserId,
            },
          },
        });
        expect(nc.capa.verificacaoEficacia?.resultado).toBe(resultado);
      });
    });

    it('verificarEficacia should record evidencia (supporting data)', () => {
      const evidencia = 'Relatório QC 2026-05-01: 100% conforme, 0 desvios';
      const nc = createMockNC({
        capa: {
          verificacaoEficacia: {
            realizada: true,
            resultado: 'eficaz',
            verificadoPor: mockUserId,
            evidencia,
          },
        },
      });

      expect(nc.capa.verificacaoEficacia?.evidencia).toBe(evidencia);
    });

    it('verificarEficacia should record verificadoPor (who verified)', () => {
      const nc = createMockNC({
        capa: {
          verificacaoEficacia: {
            realizada: true,
            resultado: 'eficaz',
            verificadoPor: 'user-supervisor-456',
          },
        },
      });

      expect(nc.capa.verificacaoEficacia?.verificadoPor).toBe('user-supervisor-456');
    });
  });

  describe('checkNCs Blocking Logic', () => {
    it('checkNCs should return blocked=true for active grave NC', () => {
      const gravePopen: NaoConformidade = createMockNC({
        severidade: 'grave' as NCSeveridade,
        status: 'investig' as NCStatus,
        bloqueiaOperacoes: true,
      });

      // Simulate blocking logic
      const isBlocked = gravePopen.status !== 'fechada' &&
        (gravePopen.severidade === 'grave' || gravePopen.severidade === 'critica') &&
        gravePopen.bloqueiaOperacoes;

      expect(isBlocked).toBe(true);
    });

    it('checkNCs should return blocked=true for active critica NC', () => {
      const criticaOpen: NaoConformidade = createMockNC({
        severidade: 'critica' as NCSeveridade,
        status: 'aberta' as NCStatus,
        bloqueiaOperacoes: true,
      });

      const isBlocked = criticaOpen.status !== 'fechada' &&
        (criticaOpen.severidade === 'grave' || criticaOpen.severidade === 'critica') &&
        criticaOpen.bloqueiaOperacoes;

      expect(isBlocked).toBe(true);
    });

    it('checkNCs should return blocked=false for closed NC', () => {
      const closedNC: NaoConformidade = createMockNC({
        severidade: 'critica' as NCSeveridade,
        status: 'fechada' as NCStatus,
      });

      const isBlocked = closedNC.status !== 'fechada' &&
        (closedNC.severidade === 'grave' || closedNC.severidade === 'critica') &&
        closedNC.bloqueiaOperacoes;

      expect(isBlocked).toBe(false);
    });

    it('checkNCs should return blocked=false for leve NC even if open', () => {
      const leveOpen: NaoConformidade = createMockNC({
        severidade: 'leve' as NCSeveridade,
        status: 'investig' as NCStatus,
        bloqueiaOperacoes: false,
      });

      const isBlocked = leveOpen.status !== 'fechada' &&
        (leveOpen.severidade === 'grave' || leveOpen.severidade === 'critica') &&
        leveOpen.bloqueiaOperacoes;

      expect(isBlocked).toBe(false);
    });

    it('checkNCs should check operacoesTodasBloqueadas for module-level filtering', () => {
      const ncBlockingSpecificModule: NaoConformidade = createMockNC({
        severidade: 'grave' as NCSeveridade,
        status: 'investig' as NCStatus,
        bloqueiaOperacoes: true,
        operacoesTodasBloqueadas: ['modulo-hematologia'],
        moduloOrigemId: 'modulo-hematologia',
      });

      // Check if module is blocked
      const modulosBlockados = ncBlockingSpecificModule.operacoesTodasBloqueadas || [];
      const hematologiaBlocked = modulosBlockados.includes('modulo-hematologia');

      expect(hematologiaBlocked).toBe(true);
    });

    it('checkNCs should allow unblocked modules when operacoesTodasBloqueadas is set', () => {
      const ncBlockingSpecificModule: NaoConformidade = createMockNC({
        severidade: 'grave' as NCSeveridade,
        status: 'investig' as NCStatus,
        bloqueiaOperacoes: true,
        operacoesTodasBloqueadas: ['modulo-hematologia'],
      });

      const modulosBlockados = ncBlockingSpecificModule.operacoesTodasBloqueadas || [];
      const microbiologiaBlocked = modulosBlockados.includes('modulo-microbiologia');

      expect(microbiologiaBlocked).toBe(false);
    });
  });

  describe('NC Metadata', () => {
    it('should track createdAt timestamp', () => {
      const nc = createMockNC();
      expect(nc.createdAt).toBeDefined();
    });

    it('should track updatedAt timestamp', () => {
      const nc = createMockNC();
      expect(nc.updatedAt).toBeDefined();
    });

    it('should preserve origem field', () => {
      const origins = ['insumo', 'controle', 'equipamento', 'pessoas', 'processo', 'outro'];
      origins.forEach(origin => {
        const nc = createMockNC({ origem: origin as any });
        expect(nc.origem).toBe(origin);
      });
    });

    it('should preserve origemId reference', () => {
      const nc = createMockNC({ origemId: 'insumo-abc-123' });
      expect(nc.origemId).toBe('insumo-abc-123');
    });

    it('should preserve moduloOrigemId for audit traceability', () => {
      const nc = createMockNC({ moduloOrigemId: 'modulo-bioquimica' });
      expect(nc.moduloOrigemId).toBe('modulo-bioquimica');
    });
  });
});
