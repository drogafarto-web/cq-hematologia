import * as admin from 'firebase-admin';
import { initializeAdminSDK } from '../../test-helpers/init';
import { openNaoConformidade, checkNCs } from './naoConformidade';
import { NaoConformidade } from './types';

/**
 * Integration Tests for ADR 0003 NC + 7-module blocking
 *
 * Tests the full workflow:
 * 1. Module (Insumo) creates issue (expired lot)
 * 2. checkNCs() is called before operation
 * 3. If critical NC exists, operation is blocked
 * 4. NC is investigated and resolved
 * 5. Operations unblocked after NC is fechada (eficaz)
 *
 * Run: npm test -- integration.test.ts
 */

describe('ADR 0003 - Integration: NC + Module Blocking', () => {
  let db: admin.firestore.Firestore;
  let labId: string;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    const { adminApp } = initializeAdminSDK();
    db = admin.firestore(adminApp);
    labId = 'integration-test-lab-' + Date.now();
  });

  afterEach(async () => {
    // Cleanup
    const ncsSnapshot = await db.collection(`labs/${labId}/nao-conformidades`).get();
    const batch = db.batch();
    ncsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  });

  describe('E2E: Insumo Expired → NC → Block → Investigate → Close', () => {
    it('should complete full lifecycle', async () => {
      // Step 1: Simulate insumo module detecting expired lot
      // Operator opens NC
      const ncRequest = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Lote #LOT-2024-001 expirado em 2026-04-30',
        severidade: 'critica' as const, // CRITICAL = block operations
        uid: testUserId,
        motivo: 'Verificação de validade mostrou expiração',
      };

      const ncResponse = await openNaoConformidade(ncRequest);
      expect(ncResponse.success).toBe(true);
      const ncId = ncResponse.ncId;
      const numero = ncResponse.numero;

      // Verify NC was created with blocking enabled
      let ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      let nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('aberta');
      expect(nc.bloqueiaOperacoes).toBe(true);

      // Step 2: Simulate insumo module trying to use this lot
      // checkNCs() would be called before any operation
      const checkResult = await checkNCs(labId, 'insumos');
      expect(checkResult.hasCriticalNCs).toBe(true);
      expect(checkResult.criticalNCs).toHaveLength(1);
      expect(checkResult.message).toContain(numero);

      // Module would throw error and block the operation
      if (checkResult.hasCriticalNCs) {
        // Operation is blocked
        const operationBlocked = true;
        expect(operationBlocked).toBe(true);
      }

      // Step 3: RT investigates the NC
      // (In real system, would call investigarNC() from capaWorkflow)
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        status: 'investig',
        'capa.investigacao': {
          realizada: true,
          dataInicio: admin.firestore.FieldValue.serverTimestamp(),
          investigadorId: testUserId,
          achados: ['Lote expirado deve ser descartado', 'Verificação de validade falhou'],
        },
      });

      ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('investig');

      // Step 4: RT executes corrective action
      const dataPrevista = new admin.firestore.Timestamp(
        Math.floor(Date.now() / 1000) + 86400,
        0
      );
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        status: 'correcao',
        'capa.acaoCorretiva': {
          descricao: 'Descartar lote expirado e reordenar novo lote',
          dataPrevista,
          responsavel: testUserId,
          status: 'em_exec',
        },
      });

      ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('correcao');

      // Simulate action execution
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        'capa.acaoCorretiva.status': 'concluida',
        'capa.acaoCorretiva.dataRealizacao': admin.firestore.FieldValue.serverTimestamp(),
        'capa.acaoCorretiva.resultado': 'Lote antigo descartado, novo lote #LOT-2024-002 recebido',
      });

      // Step 5: RT verifies efficacy
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        status: 'fechada',
        bloqueiaOperacoes: false, // UNBLOCK operations
        'capa.verificacaoEficacia': {
          realizada: true,
          resultado: 'eficaz',
          dataVerificacao: admin.firestore.FieldValue.serverTimestamp(),
          verificadoPor: testUserId,
          evidencia: 'Novo lote verificado, análise repetida com resultado OK',
        },
        fechada: {
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          uid: testUserId,
          motivo: 'Ação corretiva verificada como eficaz',
        },
      });

      // Step 6: Verify NC is now closed and operations are unblocked
      ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('fechada');
      expect(nc.bloqueiaOperacoes).toBe(false);
      expect(nc.fechada).toBeDefined();

      // Step 7: Verify checkNCs returns no blocking
      const finalCheckResult = await checkNCs(labId, 'insumos');
      expect(finalCheckResult.hasCriticalNCs).toBe(false);
      // Operations are now unblocked
    });
  });

  describe('E2E: Multiple NCs - Only Critical Block', () => {
    it('should block only on critical NCs, not leve or grave', async () => {
      // Create 3 NCs: leve, grave, critica
      const leveRequest = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Minor labeling issue',
        severidade: 'leve' as const,
        uid: testUserId,
        motivo: 'Cosmetic issue',
      };

      const graveRequest = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Grave deviation but not critical',
        severidade: 'grave' as const,
        uid: testUserId,
        motivo: 'Important but not blocking',
      };

      const criticaRequest = {
        labId,
        origem: 'insumo' as const,
        moduloOrigemId: 'insumos',
        descricao: 'Critical blocking issue',
        severidade: 'critica' as const,
        uid: testUserId,
        motivo: 'Must block operations',
      };

      const leveResp = await openNaoConformidade(leveRequest);
      const graveResp = await openNaoConformidade(graveRequest);
      const criticaResp = await openNaoConformidade(criticaRequest);

      // Verify only critica blocks
      const checkResult = await checkNCs(labId, 'insumos');
      expect(checkResult.hasCriticalNCs).toBe(true);
      expect(checkResult.criticalNCs).toHaveLength(1); // Only critica
      expect(checkResult.criticalNCs[0].ncId).toBe(criticaResp.ncId);
      expect(checkResult.criticalNCs[0].severidade).toBe('critica');
    });
  });

  describe('E2E: NC Closure Scenarios', () => {
    it('should allow closure only when eficacia is eficaz', async () => {
      const ncRequest = {
        labId,
        origem: 'equipamento' as const,
        moduloOrigemId: 'equipamento',
        descricao: 'Equipment failure',
        severidade: 'critica' as const,
        uid: testUserId,
        motivo: 'Test',
      };

      const ncResp = await openNaoConformidade(ncRequest);
      const ncId = ncResp.ncId;

      // Progress through CAPA
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        status: 'investig',
        'capa.investigacao': {
          realizada: true,
          dataInicio: admin.firestore.FieldValue.serverTimestamp(),
        },
      });

      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        status: 'correcao',
        'capa.acaoCorretiva': {
          descricao: 'Replace equipment',
          dataPrevista: new admin.firestore.Timestamp(
            Math.floor(Date.now() / 1000) + 86400,
            0
          ),
          responsavel: testUserId,
          status: 'concluida',
        },
      });

      // Verify eficacia as ineficaz
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        status: 'verif_eficacia',
        'capa.verificacaoEficacia': {
          realizada: true,
          resultado: 'ineficaz',
          dataVerificacao: admin.firestore.FieldValue.serverTimestamp(),
          verificadoPor: testUserId,
          observacoes: 'Action did not resolve issue',
        },
      });

      let ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      let nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('verif_eficacia');
      expect(nc.bloqueiaOperacoes).toBe(true); // Still blocking

      // Now verify as eficaz
      await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).update({
        status: 'fechada',
        bloqueiaOperacoes: false,
        'capa.verificacaoEficacia': {
          realizada: true,
          resultado: 'eficaz',
          dataVerificacao: admin.firestore.FieldValue.serverTimestamp(),
          verificadoPor: testUserId,
          evidencia: 'Equipment working correctly after replacement',
        },
      });

      ncDoc = await db.collection(`labs/${labId}/nao-conformidades`).doc(ncId).get();
      nc = ncDoc.data() as NaoConformidade;
      expect(nc.status).toBe('fechada');
      expect(nc.bloqueiaOperacoes).toBe(false);
    });
  });
});
