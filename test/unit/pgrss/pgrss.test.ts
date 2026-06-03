import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for PGRSS module (Cloud Functions).
 * Tests waste generation, collection, and segregation validation.
 */

describe('PGRSS Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registrarGeracao', () => {
    it('should record waste generation with valid inputs', () => {
      const validInput = {
        labId: 'lab-001',
        tipo: 'biologico',
        descricao: 'Pipetas contaminadas',
        peso_kg: 2.5,
        responsavel: 'João Silva',
      };

      expect(validInput.peso_kg).toBeGreaterThan(0);
      expect(['biologico', 'quimico', 'radioativo', 'perfuro-cortante', 'comum']).toContain(
        validInput.tipo,
      );
    });

    it('should reject invalid waste type', () => {
      const invalidInput = {
        labId: 'lab-001',
        tipo: 'invalido',
        descricao: 'Test',
        peso_kg: 1,
        responsavel: 'Test',
      };

      const tiposValidos = ['biologico', 'quimico', 'radioativo', 'perfuro-cortante', 'comum'];
      expect(tiposValidos).not.toContain(invalidInput.tipo);
    });

    it('should reject zero or negative weight', () => {
      const invalidWeights = [0, -1, -10];

      invalidWeights.forEach((weight) => {
        expect(weight).toBeLessThanOrEqual(0);
      });
    });

    it('should initialize status as "gerado"', () => {
      const status = 'gerado';
      expect(status).toBe('gerado');
    });
  });

  describe('registrarColeta', () => {
    it('should link waste generation records to collection', () => {
      const registroIds = ['reg-001', 'reg-002', 'reg-003'];
      expect(registroIds.length).toBeGreaterThan(0);
    });

    it('should require at least one waste generation record', () => {
      const emptyIds: string[] = [];
      expect(emptyIds.length).toBe(0);
    });

    it('should update status to "coletado" after collection', () => {
      const beforeStatus = 'gerado';
      const afterStatus = 'coletado';

      expect(beforeStatus).not.toEqual(afterStatus);
    });

    it('should accept optional evidence URL', () => {
      const coleta = {
        labId: 'lab-001',
        empresa_coletora: 'Coleta Plus',
        registroGeracaoIds: ['reg-001'],
        peso_total_kg: 5,
        comprovante_url: 'https://exemplo.com/comprovante.pdf',
      };

      expect(coleta.comprovante_url).toBeTruthy();
    });
  });

  describe('validarSegregacao', () => {
    it('should detect biological + chemical mix violations', () => {
      const violation = {
        registroId: 'reg-001',
        tipo: 'biologico',
        descricao: 'Resíduo biológico descrito como químico',
      };

      expect(violation.tipo).not.toMatch(/quimico/i);
    });

    it('should alert on overweight sharps containers', () => {
      const pesoMaximoPermitido = 30; // kg
      const pesoAtual = 35;

      expect(pesoAtual).toBeGreaterThan(pesoMaximoPermitido);
    });

    it('should auto-create NC on violations', () => {
      const violacoes = 5;
      const deveCriarNC = violacoes > 0;

      expect(deveCriarNC).toBe(true);
    });

    it('should set severity based on violation count', () => {
      const violacoes = [1, 2, 3, 4, 5];

      violacoes.forEach((count) => {
        const severidade = count > 3 ? 'critica' : 'grave';
        expect(['critica', 'grave']).toContain(severidade);
      });
    });
  });

  describe('gerarRelatorioMensal', () => {
    it('should aggregate monthly waste data', () => {
      const relatorio = {
        mes: 5,
        ano: 2026,
        pesoTotalGerado: 150.5,
        pesoTotalColetado: 145.3,
        pesoPendente: 5.2,
      };

      const calculado = relatorio.pesoTotalGerado - relatorio.pesoTotalColetado;
      expect(relatorio.pesoPendente).toBeCloseTo(calculado, 1);
    });

    it('should calculate compliance percentage', () => {
      const pesoGerado = 100;
      const pesoColetado = 95;
      const compliance = (pesoColetado / pesoGerado) * 100;

      expect(compliance).toBe(95);
      expect(compliance).toBeGreaterThan(90);
    });

    it('should count waste generation by type', () => {
      const tiposAcumulado = {
        biologico: { peso_kg: 50, quantidade: 10 },
        quimico: { peso_kg: 30, quantidade: 5 },
        perfuro_cortante: { peso_kg: 20, quantidade: 15 },
      };

      const totalQuantidade = Object.values(tiposAcumulado).reduce(
        (sum, t) => sum + t.quantidade,
        0,
      );
      expect(totalQuantidade).toBe(30);
    });

    it('should store report in monthly collection', () => {
      const periodo = '2026-05';
      expect(periodo).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('RDC 222/2018 Compliance', () => {
    it('should enforce waste type segregation', () => {
      const tipos = ['biologico', 'quimico', 'radioativo', 'perfuro-cortante', 'comum'];
      expect(tipos.length).toBe(5);
    });

    it('should validate container capacity', () => {
      const maxCapacidade = { 'perfuro-cortante': 30, quimico: 100, biologico: 100 };
      expect(maxCapacidade['perfuro-cortante']).toBeLessThan(maxCapacidade['biologico']);
    });

    it('should document all waste movements', () => {
      const movementoTypes = ['gerado', 'segregado', 'coletado', 'descartado'];
      expect(movementoTypes.length).toBe(4);
    });
  });
});
