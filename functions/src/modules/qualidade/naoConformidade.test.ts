import * as admin from 'firebase-admin';
import { initializeAdminSDK } from '../../test-helpers/init';
import { openNaoConformidade, updateNaoConformidade, checkNCs } from './naoConformidade';
import { investigarNC, executarAcaoCorretiva, verificarEficacia } from './capaWorkflow';
import { NaoConformidade } from './types';

/**
 * Unit Tests for ADR 0003 Non-Conformidade (NC) implementation
 *
 * Test coverage:
 * - NC creation with HMAC signing
 * - Status machine transitions
 * - CAPA workflow (investigacao → acaoCorretiva → verificacaoEficacia)
 * - Blocking gate for critical NCs
 * - Audit trail logging
 *
 * Run: npm test -- naoConformidade.test.ts
 */

describe('ADR 0003 - Non-Conformidade (NC) Global', () => {
  let db: admin.firestore.Firestore;
  let labId: string;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    const { adminApp } = initializeAdminSDK();
    db = admin.firestore(adminApp);
    labId = 'test-lab-' + Date.now();
  });

  afterEach(async () => {
    // Clean up test data
    const ncsSnapshot = await db.collection(`labs/${labId}/nao-conformidades`).get();
    const batch = db.batch();
    ncsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  });

  describe('openNaoConformidade()', () => {
    it('should create a new NC with numero in NC-{YYYY}-{seq} format', async () => {
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Lote expirado detectado',
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'Verificação de validade',
      };

      const response = await openNaoConformidade(request);

      expect(response.success).toBe(true);
      expect(response.numero).toMatch(/^NC-\d{4}-\d{3}$/);
      expect(response.ncId).toBeTruthy();
      expect(response.hmac).toBeTruthy();

      // Verify in Firestore
      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(response.ncId).get();
      expect(ncDoc.exists).toBe(true);
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.numero).toBe(response.numero);
      expect(nc.status).toBe('aberta');
    });

    it('should set bloqueiaOperacoes=true for critica severity', async () => {
      const request = {
        labId,
        origem: 'equipamento' as const,
        moduloOrigemId: 'equipamento',
        descricao: 'Equipamento crítico quebrado',
        severidade: 'critica' as const,
        uid: testUserId,
        motivo: 'Equipamento não funciona',
      };

      const response = await openNaoConformidade(request);

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(response.ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.bloqueiaOperacoes).toBe(true);
    });

    it('should set bloqueiaOperacoes=false for leve severity', async () => {
      const request = {
        labId,
        origem: 'processo' as const,
        moduloOrigemId: 'qualidade',
        descricao: 'Procedimento menor desviado',
        severidade: 'leve' as const,
        uid: testUserId,
        motivo: 'Desvio menor',
      };

      const response = await openNaoConformidade(request);

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(response.ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.bloqueiaOperacoes).toBe(false);
    });

    it('should include aberta metadata', async () => {
      const request = {
        labId,
        origem: 'controle' as const,
        moduloOrigemId: 'qualidade',
        descricao: 'Controle de qualidade falhou',
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'CQ fora dos limites',
      };

      const response = await openNaoConformidade(request);

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(response.ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.aberta).toBeDefined();
      expect(nc.aberta.uid).toBe(testUserId);
      expect(nc.aberta.motivo).toBe('CQ fora dos limites');
      expect(nc.aberta.timestamp).toBeTruthy();
    });

    it('should include statusHistory with HMAC-signed entry', async () => {
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Test NC',
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'Test motivo',
      };

      const response = await openNaoConformidade(request);

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(response.ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.statusHistory.length).toBeGreaterThan(0);
      const firstEntry = nc.statusHistory[0];
      expect(firstEntry.novoStatus).toBe('aberta');
      expect(firstEntry.mudadoPor).toBe(testUserId);
      expect(firstEntry.hmac).toBeTruthy();
    });

    it('should reject invalid origem', async () => {
      const request = {
        labId,
        origem: 'invalid-origin' as any,
        moduloOrigemId: 'insumos',
        descricao: 'Test',
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'Test',
      };

      expect(async () => {
        await openNaoConformidade(request);
      }).rejects.toThrow();
    });

    it('should reject invalid severidade', async () => {
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Test',
        severidade: 'super-critica' as any,
        uid: testUserId,
        motivo: 'Test',
      };

      expect(async () => {
        await openNaoConformidade(request);
      }).rejects.toThrow();
    });

    it('should require descricao', async () => {
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: '', // Empty
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'Test',
      };

      expect(async () => {
        await openNaoConformidade(request);
      }).rejects.toThrow();
    });
  });

  describe('updateNaoConformidade() - Status Transitions', () => {
    let ncId: string;
    let numero: string;

    beforeEach(async () => {
      // Create initial NC
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Test NC for transitions',
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'Test',
      };

      const response = await openNaoConformidade(request);
      ncId = response.ncId;
      numero = response.numero;
    });

    it('should transition aberta → investig', async () => {
      const response = await updateNaoConformidade({
        ncId,
        labId,
        uid: testUserId,
        novoStatus: 'investig',
        motivoTransicao: 'Iniciando investigação',
      });

      expect(response.success).toBe(true);
      expect(response.novoStatus).toBe('investig');

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('investig');
      expect(nc.statusHistory.length).toBe(2); // aberta + investig
    });

    it('should prevent invalid transition (investig → aberta)', async () => {
      // First transition to investig
      await updateNaoConformidade({
        ncId,
        labId,
        uid: testUserId,
        novoStatus: 'investig',
        motivoTransicao: 'Test',
      });

      // Try invalid transition back to aberta
      expect(async () => {
        await updateNaoConformidade({
          ncId,
          labId,
          uid: testUserId,
          novoStatus: 'aberta',
          motivoTransicao: 'Invalid',
        });
      }).rejects.toThrow();
    });

    it('should record statusHistory with HMAC', async () => {
      await updateNaoConformidade({
        ncId,
        labId,
        uid: testUserId,
        novoStatus: 'investig',
        motivoTransicao: 'Iniciando investigação',
      });

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      const latestEntry = nc.statusHistory[nc.statusHistory.length - 1];
      expect(latestEntry.novoStatus).toBe('investig');
      expect(latestEntry.hmac).toBeTruthy();
      expect(latestEntry.mudadoPor).toBe(testUserId);
    });
  });

  describe('CAPA Workflow', () => {
    let ncId: string;
    let numero: string;

    beforeEach(async () => {
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Test NC for CAPA',
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'Test',
      };

      const response = await openNaoConformidade(request);
      ncId = response.ncId;
      numero = response.numero;
    });

    it('investigarNC should transition to investig and set investigacao data', async () => {
      const result = await investigarNC(labId, ncId, testUserId, 'Test Investigator');

      expect(result.success).toBe(true);

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('investig');
      expect(nc.capa.investigacao?.realizada).toBe(true);
      expect(nc.capa.investigacao?.investigadoPor).toBe(testUserId);
    });

    it('executarAcaoCorretiva should transition to correcao', async () => {
      // First investigate
      await investigarNC(labId, ncId, testUserId, 'Test Investigator');

      // Then execute action
      const dataPrevista = new admin.firestore.Timestamp(
        Math.floor(Date.now() / 1000) + 86400,
        0
      ); // Tomorrow

      const result = await executarAcaoCorretiva(
        labId,
        ncId,
        testUserId,
        'Substituir lote expirado',
        dataPrevista,
        'Test Executor'
      );

      expect(result.success).toBe(true);

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('correcao');
      expect(nc.capa.acaoCorretiva?.descricao).toBe('Substituir lote expirado');
      expect(nc.capa.acaoCorretiva?.status).toBe('planejada');
    });

    it('verificarEficacia should transition to fechada if eficaz', async () => {
      // Setup: aberta → investig → correcao
      await investigarNC(labId, ncId, testUserId, 'Test Investigator');
      const dataPrevista = new admin.firestore.Timestamp(
        Math.floor(Date.now() / 1000) + 86400,
        0
      );
      await executarAcaoCorretiva(
        labId,
        ncId,
        testUserId,
        'Substituir lote',
        dataPrevista,
        'Test Executor'
      );

      // Verify efficacy as eficaz
      const result = await verificarEficacia(
        labId,
        ncId,
        testUserId,
        'eficaz',
        'Lote substituído com sucesso, nova análise OK'
      );

      expect(result.success).toBe(true);

      const ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      const nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('fechada');
      expect(nc.bloqueiaOperacoes).toBe(false); // Should be unblocked
      expect(nc.fechada).toBeDefined();
    });
  });

  describe('checkNCs() - Blocking Gate', () => {
    it('should return empty list if no blocking NCs', async () => {
      const result = await checkNCs(labId, 'insumos');
      expect(result.hasCriticalNCs).toBe(false);
      expect(result.criticalNCs).toHaveLength(0);
    });

    it('should detect blocking NC for module', async () => {
      // Create blocking NC
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Critical issue',
        severidade: 'critica' as const,
        uid: testUserId,
        motivo: 'Critical blocking issue',
      };

      const ncResponse = await openNaoConformidade(request);

      // Check for blocking
      const result = await checkNCs(labId, 'insumos');
      expect(result.hasCriticalNCs).toBe(true);
      expect(result.criticalNCs).toHaveLength(1);
      expect(result.criticalNCs[0].ncId).toBe(ncResponse.ncId);
      expect(result.criticalNCs[0].numero).toBe(ncResponse.numero);
      expect(result.criticalNCs[0].bloqueiaOperacoes).toBe(true);
    });

    it('should not detect blocking NC for different module', async () => {
      // Create NC for insumos
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Critical issue',
        severidade: 'critica' as const,
        uid: testUserId,
        motivo: 'Critical blocking issue',
      };

      await openNaoConformidade(request);

      // Check for blocking on equipamento (should be empty)
      const result = await checkNCs(labId, 'equipamento');
      expect(result.hasCriticalNCs).toBe(false);
    });

    it('should exclude closed NCs from blocking', async () => {
      // Create NC and close it
      const request = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Critical issue',
        severidade: 'critica' as const,
        uid: testUserId,
        motivo: 'Issue',
      };

      const ncResponse = await openNaoConformidade(request);

      // Manually close it
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncResponse.ncId).update({
        status: 'fechada',
        bloqueiaOperacoes: false,
      });

      // Check should return no blocking
      const result = await checkNCs(labId, 'insumos');
      expect(result.hasCriticalNCs).toBe(false);
    });
  });
});
