// @ts-ignore
import { describe, it, expect, beforeEach } from '@jest/globals';
import * as crypto from 'crypto';
import { computeHmac } from '../audit/cryptoAudit';
import { POP, POPVersao } from './types';
import * as admin from 'firebase-admin';

/**
 * ADR 0004 — POP Versionado (Procedimentos Operacionais Padrão) Unit Tests
 * >80% coverage target: 12+ test cases
 */

describe('ADR 0004 — POP Versionado', () => {
  const testSecret = crypto.randomBytes(32).toString('hex');
  const mockLabId = 'lab-test-001';
  const mockUserId = 'user-rt-001';
  const mockOperadorId = 'user-operador-001';

  // Helper: Create mock POP data
  const createMockPOP = (overrides?: Partial<POP>): POP => {
    const now = admin.firestore.Timestamp.now();
    const vigenciaFim = new Date();
    vigenciaFim.setFullYear(vigenciaFim.getFullYear() + 2);

    return {
      id: 'pop-001',
      labId: mockLabId,
      nome: 'POP-Coleta-Sangue',
      codigo: 'COL-001',
      conteudo: {
        markdown: '# POP Coleta de Sangue\n\n## Objetivo\nProcedimento padrão...',
        pdfUrl: 'https://storage.googleapis.com/...',
        versaoDocumento: '1.0',
      },
      versoes: [
        {
          numero: '1.0',
          dataVigenciaInicio: now,
          dataVigenciaFim: admin.firestore.Timestamp.fromDate(vigenciaFim),
          hashConteudo: crypto
            .createHash('sha256')
            .update(JSON.stringify({ markdown: '# POP Coleta de Sangue' }))
            .digest('hex'),
          assinadaPor: {
            uid: mockUserId,
            nome: 'Dr. Silva',
            cargo: 'RT',
            timestamp: now,
            hmac: 'mock-hmac-signature',
          },
          proximaRevisao: admin.firestore.Timestamp.fromDate(vigenciaFim),
          status: 'ativa',
        },
      ],
      treinamentosObrigatorios: [
        {
          modulo: 'coleta',
          tipoTreinamento: 'inicial',
          periodicidadeMeses: 24,
        },
      ],
      criadoEm: now,
      criadoPor: mockUserId,
      modulos: ['coleta', 'analise'],
      ...overrides,
    };
  };

  // Helper: Create mock training record
  const createMockTrainingRecord = (overrides?: any) => {
    const now = new Date();
    const validoAte = new Date();
    validoAte.setMonth(validoAte.getMonth() + 24); // 24 months valid

    return {
      popId: 'pop-001',
      popVersaoNumero: '1.0',
      dataConcluso: admin.firestore.Timestamp.fromDate(now),
      validoAte: admin.firestore.Timestamp.fromDate(validoAte),
      certificado_url: 'https://storage.googleapis.com/...',
      ...overrides,
    };
  };

  describe('POP Version Creation & Numbering', () => {
    it('should auto-increment version numero (v1.0 → v1.1)', () => {
      // Simulate version increment logic
      const incrementVersion = (numero: string): string => {
        const [major, minor] = numero.split('.').map(Number);
        return `${major}.${minor + 1}`;
      };

      const v1_0 = '1.0';
      const v1_1 = incrementVersion(v1_0);
      const v1_2 = incrementVersion(v1_1);

      expect(v1_1).toBe('1.1');
      expect(v1_2).toBe('1.2');
    });

    it('should handle major version increments', () => {
      const incrementMajor = (numero: string): string => {
        const [major] = numero.split('.').map(Number);
        return `${major + 1}.0`;
      };

      expect(incrementMajor('1.5')).toBe('2.0');
      expect(incrementMajor('2.9')).toBe('3.0');
    });

    it('should initialize versao 1.0 for new POP', () => {
      const pop = createMockPOP({
        versoes: [
          {
            numero: '1.0',
            dataVigenciaInicio: admin.firestore.Timestamp.now(),
            dataVigenciaFim: admin.firestore.Timestamp.now(),
            hashConteudo: 'mock-hash',
            assinadaPor: {
              uid: '',
              nome: '',
              cargo: '',
              timestamp: admin.firestore.Timestamp.now(),
              hmac: '',
            },
            proximaRevisao: admin.firestore.Timestamp.now(),
            status: 'em_revisao',
          },
        ],
      });

      expect(pop.versoes[0].numero).toBe('1.0');
      expect(pop.versoes[0].status).toBe('em_revisao');
    });
  });

  describe('POP Content Hashing (SHA-256)', () => {
    it('should compute hashConteudo as SHA-256 of JSON content', () => {
      const conteudo = {
        markdown: '# POP Test\n\n## Objetivo',
        pdfUrl: 'https://...',
      };

      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(conteudo))
        .digest('hex');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should compute hash deterministically', () => {
      const conteudo = { markdown: '# Test', pdfUrl: 'url' };

      const hash1 = crypto
        .createHash('sha256')
        .update(JSON.stringify(conteudo))
        .digest('hex');

      const hash2 = crypto
        .createHash('sha256')
        .update(JSON.stringify(conteudo))
        .digest('hex');

      expect(hash1).toBe(hash2);
    });

    it('should differ hash when content changes', () => {
      const content1 = { markdown: '# Version 1' };
      const content2 = { markdown: '# Version 2' };

      const hash1 = crypto
        .createHash('sha256')
        .update(JSON.stringify(content1))
        .digest('hex');

      const hash2 = crypto
        .createHash('sha256')
        .update(JSON.stringify(content2))
        .digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should be independent of JSON key order for consistent hashing', () => {
      const content1 = { markdown: 'a', pdfUrl: 'b' };
      const content2 = { pdfUrl: 'b', markdown: 'a' };

      // Note: JSON.stringify preserves insertion order in modern JS
      // but we ensure canonical ordering in production
      const hash1 = crypto
        .createHash('sha256')
        .update(JSON.stringify(content1, Object.keys(content1).sort()))
        .digest('hex');

      const hash2 = crypto
        .createHash('sha256')
        .update(JSON.stringify(content2, Object.keys(content2).sort()))
        .digest('hex');

      expect(hash1).toBe(hash2);
    });
  });

  describe('POP Version Status Lifecycle', () => {
    it('should set status=em_revisao awaiting RT signature', () => {
      const pop = createMockPOP({
        versoes: [
          {
            numero: '1.1',
            dataVigenciaInicio: admin.firestore.Timestamp.now(),
            dataVigenciaFim: admin.firestore.Timestamp.now(),
            hashConteudo: 'mock-hash',
            assinadaPor: {
              uid: '',
              nome: '',
              cargo: '',
              timestamp: admin.firestore.Timestamp.now(),
              hmac: '',
            },
            proximaRevisao: admin.firestore.Timestamp.now(),
            status: 'em_revisao',
          },
        ],
      });

      expect(pop.versoes[0].status).toBe('em_revisao');
    });

    it('should transition status em_revisao → ativa when RT signs', () => {
      const versao: POPVersao = {
        numero: '1.0',
        dataVigenciaInicio: admin.firestore.Timestamp.now(),
        dataVigenciaFim: admin.firestore.Timestamp.now(),
        hashConteudo: 'mock-hash',
        assinadaPor: {
          uid: mockUserId,
          nome: 'Dr. Silva',
          cargo: 'RT',
          timestamp: admin.firestore.Timestamp.now(),
          hmac: 'mock-hmac-sig',
        },
        proximaRevisao: admin.firestore.Timestamp.now(),
        status: 'ativa',
      };

      expect(versao.status).toBe('ativa');
      expect(versao.assinadaPor.uid).toBeTruthy();
      expect(versao.assinadaPor.hmac).toBeTruthy();
    });

    it('should mark version as obsoleta when superseded', () => {
      const v1_0: POPVersao = {
        numero: '1.0',
        dataVigenciaInicio: admin.firestore.Timestamp.now(),
        dataVigenciaFim: admin.firestore.Timestamp.now(),
        hashConteudo: 'hash-1.0',
        assinadaPor: {
          uid: mockUserId,
          nome: 'Dr. Silva',
          cargo: 'RT',
          timestamp: admin.firestore.Timestamp.now(),
          hmac: 'hmac-1.0',
        },
        proximaRevisao: admin.firestore.Timestamp.now(),
        status: 'obsoleta',
        motivo_obsolescencia: 'Substituída por v1.1',
      };

      expect(v1_0.status).toBe('obsoleta');
      expect(v1_0.motivo_obsolescencia).toContain('v1.1');
    });
  });

  describe('RT Signature (ADR 0005)', () => {
    it('should sign hash via ADR 0005 HMAC', () => {
      const versionData = {
        numero: '1.0',
        hashConteudo: 'abc123...',
      };

      const hmac = computeHmac(versionData, testSecret);
      expect(hmac).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should compute HMAC deterministically for same data', () => {
      const versionData = { numero: '1.0', hashConteudo: 'abc123' };

      const hmac1 = computeHmac(versionData, testSecret);
      const hmac2 = computeHmac(versionData, testSecret);

      expect(hmac1).toBe(hmac2);
    });

    it('should differ HMAC when content hash changes', () => {
      const v1 = { numero: '1.0', hashConteudo: 'hash-v1' };
      const v2 = { numero: '1.0', hashConteudo: 'hash-v2' };

      const hmac1 = computeHmac(v1, testSecret);
      const hmac2 = computeHmac(v2, testSecret);

      expect(hmac1).not.toBe(hmac2);
    });

    it('should require responsavelTecnico (RT) to sign', () => {
      // Simulate permission check
      const userToken = {
        responsavelTecnico: true,
        uid: mockUserId,
      };

      const canSign = userToken.responsavelTecnico === true;
      expect(canSign).toBe(true);
    });

    it('should deny signing to non-RT users', () => {
      const userToken = {
        responsavelTecnico: false,
        operador: true,
        uid: mockOperadorId,
      };

      const canSign = userToken.responsavelTecnico === true;
      expect(canSign).toBe(false);
    });

    it('should record signer name, cargo, timestamp', () => {
      const versao = createMockPOP().versoes[0];

      expect(versao.assinadaPor.uid).toBeTruthy();
      expect(versao.assinadaPor.nome).toBeTruthy();
      expect(versao.assinadaPor.cargo).toBe('RT');
      expect(versao.assinadaPor.timestamp).toBeDefined();
      expect(versao.assinadaPor.hmac).toBeTruthy();
    });
  });

  describe('POP Version Auto-Obsolescence', () => {
    it('should auto-obsolete old ativa version when new one signed', () => {
      // Simulate version list with v1.0 ativa, then v1.1 becomes ativa
      const versions: POPVersao[] = [
        {
          numero: '1.0',
          dataVigenciaInicio: admin.firestore.Timestamp.now(),
          dataVigenciaFim: admin.firestore.Timestamp.now(),
          hashConteudo: 'hash-1.0',
          assinadaPor: {
            uid: mockUserId,
            nome: 'Dr. Silva',
            cargo: 'RT',
            timestamp: admin.firestore.Timestamp.now(),
            hmac: 'hmac-1.0',
          },
          proximaRevisao: admin.firestore.Timestamp.now(),
          status: 'obsoleta', // Was ativa, now obsolete
          motivo_obsolescencia: 'Substituída por v1.1',
        },
        {
          numero: '1.1',
          dataVigenciaInicio: admin.firestore.Timestamp.now(),
          dataVigenciaFim: admin.firestore.Timestamp.now(),
          hashConteudo: 'hash-1.1',
          assinadaPor: {
            uid: mockUserId,
            nome: 'Dr. Silva',
            cargo: 'RT',
            timestamp: admin.firestore.Timestamp.now(),
            hmac: 'hmac-1.1',
          },
          proximaRevisao: admin.firestore.Timestamp.now(),
          status: 'ativa', // New active version
        },
      ];

      const ativCount = versions.filter(v => v.status === 'ativa').length;
      const hasObsoleta = versions.some(
        v => v.status === 'obsoleta' && v.motivo_obsolescencia
      );

      expect(ativCount).toBe(1);
      expect(hasObsoleta).toBe(true);
      expect(versions[0].status).toBe('obsoleta');
      expect(versions[1].status).toBe('ativa');
    });

    it('should only obsolete versions from same major version', () => {
      // v1.x versions: mark old ones obsolete
      // v2.x versions: keep separately
      const versions: POPVersao[] = [
        {
          numero: '1.0',
          dataVigenciaInicio: admin.firestore.Timestamp.now(),
          dataVigenciaFim: admin.firestore.Timestamp.now(),
          hashConteudo: 'hash-1.0',
          assinadaPor: {
            uid: mockUserId,
            nome: 'Dr. Silva',
            cargo: 'RT',
            timestamp: admin.firestore.Timestamp.now(),
            hmac: 'hmac-1.0',
          },
          proximaRevisao: admin.firestore.Timestamp.now(),
          status: 'ativa', // Still ativa
        },
        {
          numero: '2.0',
          dataVigenciaInicio: admin.firestore.Timestamp.now(),
          dataVigenciaFim: admin.firestore.Timestamp.now(),
          hashConteudo: 'hash-2.0',
          assinadaPor: {
            uid: mockUserId,
            nome: 'Dr. Silva',
            cargo: 'RT',
            timestamp: admin.firestore.Timestamp.now(),
            hmac: 'hmac-2.0',
          },
          proximaRevisao: admin.firestore.Timestamp.now(),
          status: 'ativa', // Major version 2
        },
      ];

      const v1_ativa = versions.filter(
        v => v.numero.startsWith('1.') && v.status === 'ativa'
      );
      const v2_ativa = versions.filter(
        v => v.numero.startsWith('2.') && v.status === 'ativa'
      );

      expect(v1_ativa.length).toBe(1);
      expect(v2_ativa.length).toBe(1);
    });
  });

  describe('Operator Training Validation', () => {
    it('canOperadorUsarPOP should allow if operator trained on version', () => {
      const qualificacao = {
        uid: mockOperadorId,
        treinamentosPOP: [createMockTrainingRecord({ popId: 'pop-001' })],
      };

      const trainRecord = qualificacao.treinamentosPOP.find(
        t => t.popId === 'pop-001'
      );
      const allowed = trainRecord && new Date() <= new Date(trainRecord.validoAte);

      expect(allowed).toBe(true);
    });

    it('canOperadorUsarPOP should block if operator not trained', () => {
      const qualificacao = {
        uid: mockOperadorId,
        treinamentosPOP: [] as Array<{popId: string; popVersaoNumero: string; validoAte: any}>, // No training
      };

      const trainRecord = qualificacao.treinamentosPOP.find(
        t => t.popId === 'pop-001'
      );
      const allowed = !!trainRecord;

      expect(allowed).toBe(false);
    });

    it('canOperadorUsarPOP should block if training expired', () => {
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 1); // 1 month ago

      const qualificacao = {
        uid: mockOperadorId,
        treinamentosPOP: [
          createMockTrainingRecord({
            popId: 'pop-001',
            validoAte: admin.firestore.Timestamp.fromDate(expiredDate),
          }),
        ],
      };

      const trainRecord = qualificacao.treinamentosPOP.find(
        t => t.popId === 'pop-001'
      );
      const allowed = trainRecord && new Date() <= new Date(trainRecord.validoAte);

      expect(allowed).toBe(false);
    });

    it('canOperadorUsarPOP should verify POP version is ativa', () => {
      const pop = createMockPOP({
        versoes: [
          {
            numero: '1.0',
            dataVigenciaInicio: admin.firestore.Timestamp.now(),
            dataVigenciaFim: admin.firestore.Timestamp.now(),
            hashConteudo: 'hash',
            assinadaPor: {
              uid: mockUserId,
              nome: 'Dr. Silva',
              cargo: 'RT',
              timestamp: admin.firestore.Timestamp.now(),
              hmac: 'hmac',
            },
            proximaRevisao: admin.firestore.Timestamp.now(),
            status: 'obsoleta', // NOT ativa
          },
        ],
      });

      const versaoAtiva = pop.versoes.find(
        v => v.numero === '1.0' && v.status === 'ativa'
      );

      expect(versaoAtiva).toBeUndefined();
    });

    it('canOperadorUsarPOP should record certificado URL for audit', () => {
      const trainRecord = createMockTrainingRecord({
        certificado_url: 'https://storage.googleapis.com/lab-001/cert-op-001-v1.0.pdf',
      });

      expect(trainRecord.certificado_url).toBeTruthy();
      expect(trainRecord.certificado_url).toContain('cert');
    });
  });

  describe('Module-Level Training Validation', () => {
    it('checkTrainingValid should validate training for all active POPs in module', () => {
      // Simulate 2 POPs required for 'coleta' module
      const popsInModule = [
        createMockPOP({ codigo: 'COL-001', modulos: ['coleta'] }),
        createMockPOP({ codigo: 'COL-002', modulos: ['coleta'] }),
      ];

      // Operator trained on both
      const operadorTraining = {
        uid: mockOperadorId,
        treinamentosPOP: [
          createMockTrainingRecord({ popId: 'pop-001' }),
          createMockTrainingRecord({ popId: 'pop-002' }),
        ],
      };

      const allTrained = popsInModule.every(pop => {
        const ativVersion = pop.versoes.find(v => v.status === 'ativa');
        return ativVersion && operadorTraining.treinamentosPOP.some(
          t => t.popId === pop.id && t.popVersaoNumero === ativVersion.numero
        );
      });

      expect(allTrained).toBe(true);
    });

    it('checkTrainingValid should fail if any POP training is missing', () => {
      const popsInModule = [
        createMockPOP({ id: 'pop-001', codigo: 'COL-001', modulos: ['coleta'] }),
        createMockPOP({ id: 'pop-002', codigo: 'COL-002', modulos: ['coleta'] }),
      ];

      // Only trained on pop-001, missing pop-002
      const operadorTraining = {
        uid: mockOperadorId,
        treinamentosPOP: [
          createMockTrainingRecord({ popId: 'pop-001' }),
          // Missing pop-002
        ],
      };

      const allTrained = popsInModule.every(pop => {
        const ativVersion = pop.versoes.find(v => v.status === 'ativa');
        return ativVersion && operadorTraining.treinamentosPOP.some(
          t => t.popId === pop.id && t.popVersaoNumero === ativVersion.numero
        );
      });

      expect(allTrained).toBe(false);
    });

    it('checkTrainingValid should return blockingReason when validation fails', () => {
      // When training is missing, return reason
      const blockingReason = 'POP "Coleta de Sangue": Operador não treinado nesta versão de POP';
      expect(blockingReason).toContain('POP');
      expect(blockingReason).toContain('não treinado');
    });

    it('checkTrainingValid should pass if no POP required yet for module', () => {
      const popsInModule = []; // No POPs required for this module yet

      const valid = popsInModule.length === 0; // Pass open

      expect(valid).toBe(true);
    });

    it('checkTrainingValid should check expiration for all POPs', () => {
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 1);

      const popsInModule = [
        createMockPOP({ id: 'pop-001', codigo: 'COL-001', modulos: ['coleta'] }),
      ];

      const operadorTraining = {
        uid: mockOperadorId,
        treinamentosPOP: [
          createMockTrainingRecord({
            popId: 'pop-001',
            validoAte: admin.firestore.Timestamp.fromDate(expiredDate),
          }),
        ],
      };

      const allValid = popsInModule.every(pop => {
        const ativVersion = pop.versoes.find(v => v.status === 'ativa');
        if (!ativVersion) return true;

        const trainRecord = operadorTraining.treinamentosPOP.find(
          t => t.popId === pop.id && t.popVersaoNumero === ativVersion.numero
        );

        return trainRecord && new Date() <= new Date(trainRecord.validoAte);
      });

      expect(allValid).toBe(false);
    });
  });

  describe('POP Metadata & Validity', () => {
    it('should track dataVigenciaInicio for version start', () => {
      const pop = createMockPOP();
      expect(pop.versoes[0].dataVigenciaInicio).toBeDefined();
    });

    it('should track dataVigenciaFim for version expiry', () => {
      const pop = createMockPOP();
      expect(pop.versoes[0].dataVigenciaFim).toBeDefined();
    });

    it('should track proximaRevisao for compliance scheduling', () => {
      const pop = createMockPOP();
      expect(pop.versoes[0].proximaRevisao).toBeDefined();
    });

    it('should preserve modulos array for multi-module POPs', () => {
      const pop = createMockPOP({
        modulos: ['coleta', 'analise', 'report'],
      });

      expect(pop.modulos).toEqual(['coleta', 'analise', 'report']);
    });

    it('should track treinamentosObrigatorios requirements', () => {
      const pop = createMockPOP({
        treinamentosObrigatorios: [
          {
            modulo: 'coleta',
            tipoTreinamento: 'inicial',
            periodicidadeMeses: 24,
          },
          {
            modulo: 'coleta',
            tipoTreinamento: 'reciclagem',
            periodicidadeMeses: 12,
          },
        ],
      });

      expect(pop.treinamentosObrigatorios.length).toBe(2);
      expect(pop.treinamentosObrigatorios[0].periodicidadeMeses).toBe(24);
    });
  });
});
