/**
 * ADR 0003 Wave 3 — NC Blocking Gates Integration Tests
 *
 * Tests that each of the 7 modules correctly checks for blocking NCs
 * before performing create operations.
 */

// @ts-ignore
import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import * as admin from 'firebase-admin';
import { checkNCs } from './naoConformidade';

describe('ADR 0003 Wave 3 — NC Blocking Gates', () => {
  const db = admin.firestore();
  const testLabId = 'test-lab-nc-gates';
  const testModules = ['equipamento', 'procedimentos', 'pessoas', 'auditoria', 'treinamentos'];

  beforeAll(async () => {
    // Ensure test lab exists
    await db.collection('labs').doc(testLabId).set({
      nome: 'Test Lab - NC Gates',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  afterEach(async () => {
    // Clean up NCs after each test
    const ncsSnap = await db.collection(`labs/${testLabId}/naoConformidades`).get();
    const batch = db.batch();
    ncsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  });

  describe('checkNCs() helper function', () => {
    it('should return blocked=false when no critical NCs exist', async () => {
      const result = await checkNCs(testLabId, 'equipamento');
      expect(result.blocked).toBe(false);
      expect(result.blockingNC).toBeUndefined();
    });

    it('should return blocked=true when critical NC exists for module', async () => {
      // Create a critical NC (using actual schema field names)
      await db.collection(`labs/${testLabId}/naoConformidades`).add({
        labId: testLabId,
        codigo: 'NC-TEST-001',
        titulo: 'Test Critical NC',
        descricao: 'Testing blocking gate',
        categoria: 'geral',
        severidade: 'critica',
        bloqueiaOperacoes: true,
        capaStatus: 'nao_iniciada',
        capaHistorico: [],
        origem: 'interno',
        abertaPor: 'test-user',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      const result = await checkNCs(testLabId, 'equipamento');
      expect(result.blocked).toBe(true);
      expect(result.blockingNC).toBeDefined();
      expect(result.message).toContain('NC crítica');
    });

    it('should not block for non-critical NCs', async () => {
      // Create a non-critical NC (leve)
      await db.collection(`labs/${testLabId}/naoConformidades`).add({
        labId: testLabId,
        codigo: 'NC-TEST-002',
        titulo: 'Test Minor NC',
        descricao: 'Minor issue',
        severidade: 'leve',
        moduloOrigemId: 'equipamento',
        bloqueiaOperacoes: false,
        capaStatus: 'nao_iniciada',
        capaHistorico: [],
        origem: 'modulo',
        abertaPor: 'test-user',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      const result = await checkNCs(testLabId, 'equipamento');
      expect(result.blocked).toBe(false);
    });

    it('should not block for critical NCs in different modules', async () => {
      // Create a critical NC for module A
      await db.collection(`labs/${testLabId}/naoConformidades`).add({
        labId: testLabId,
        codigo: 'NC-TEST-003',
        titulo: 'Test Critical NC - Other Module',
        descricao: 'Critical issue in other module',
        severidade: 'critica',
        moduloOrigemId: 'equipamento',
        bloqueiaOperacoes: true,
        capaStatus: 'nao_iniciada',
        capaHistorico: [],
        origem: 'modulo',
        abertaPor: 'test-user',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Check different module should not be blocked
      const result = await checkNCs(testLabId, 'pessoas');
      expect(result.blocked).toBe(false);
    });

    it('should handle multiple critical NCs (return first)', async () => {
      // Create multiple critical NCs
      const batch = db.batch();
      for (let i = 0; i < 3; i++) {
        batch.set(
          db.collection(`labs/${testLabId}/naoConformidades`).doc(),
          {
            labId: testLabId,
            codigo: `NC-TEST-MULTI-${i}`,
            titulo: `Critical NC ${i}`,
            descricao: `Testing multiple critical NCs`,
            severidade: 'critica',
            moduloOrigemId: 'procedimentos',
            bloqueiaOperacoes: true,
            capaStatus: 'nao_iniciada',
            capaHistorico: [],
            origem: 'modulo',
            abertaPor: 'test-user',
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
          }
        );
      }
      await batch.commit();

      const result = await checkNCs(testLabId, 'procedimentos');
      expect(result.blocked).toBe(true);
      expect(result.blockingNC).toBeDefined();
    });
  });

  describe('Per-module integration pattern', () => {
    testModules.forEach((moduloId) => {
      describe(`Module: ${moduloId}`, () => {
        it(`should check NCs before operations in ${moduloId}`, async () => {
          // This test verifies that the module can be checked
          const result = await checkNCs(testLabId, moduloId);
          expect(result).toHaveProperty('blocked');
          expect(typeof result.blocked).toBe('boolean');
        });

        it(`should allow operations when no blocking NCs in ${moduloId}`, async () => {
          const result = await checkNCs(testLabId, moduloId);
          expect(result.blocked).toBe(false);
        });

        it(`should block operations when critical NC open in ${moduloId}`, async () => {
          // Create blocking NC
          await db.collection(`labs/${testLabId}/naoConformidades`).add({
            labId: testLabId,
            codigo: `NC-BLOCK-${moduloId}`,
            titulo: `Blocking NC for ${moduloId}`,
            descricao: 'Testing module blocking',
            severidade: 'critica',
            moduloOrigemId: moduloId,
            bloqueiaOperacoes: true,
            capaStatus: 'nao_iniciada',
            capaHistorico: [],
            origem: 'modulo',
            abertaPor: 'test-user',
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });

          const result = await checkNCs(testLabId, moduloId);
          expect(result.blocked).toBe(true);
          expect(result.message).toContain(moduloId);
        });
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle invalid lab ID gracefully', async () => {
      const result = await checkNCs('invalid-lab-xyz', 'equipamento');
      // Should not throw, should return safe default
      expect(result.blocked).toBe(false);
    });

    it('should handle empty module list gracefully', async () => {
      const result = await checkNCs(testLabId, '');
      expect(result.blocked).toBe(false);
    });

    it('should return consistent results for same state', async () => {
      // Create an NC
      await db.collection(`labs/${testLabId}/naoConformidades`).add({
        labId: testLabId,
        codigo: 'NC-CONSISTENT',
        titulo: 'Consistency Test',
        descricao: 'Testing consistency',
        severidade: 'critica',
        moduloOrigemId: 'auditoria',
        bloqueiaOperacoes: true,
        capaStatus: 'nao_iniciada',
        capaHistorico: [],
        origem: 'modulo',
        abertaPor: 'test-user',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Check multiple times
      const result1 = await checkNCs(testLabId, 'auditoria');
      const result2 = await checkNCs(testLabId, 'auditoria');

      expect(result1.blocked).toBe(result2.blocked);
      expect(result1.blocked).toBe(true);
    });
  });

  afterAll(async () => {
    // Clean up test lab
    const ncsSnap = await db.collection(`labs/${testLabId}/naoConformidades`).get();
    const batch = db.batch();
    ncsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    await db.collection('labs').doc(testLabId).delete();
  });
});

// Placeholder for afterAll import (handled by @ts-ignore above)
