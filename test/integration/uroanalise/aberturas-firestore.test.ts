/**
 * Integration tests for uroAberturaService against Firebase Emulator.
 *
 * Run: npx vitest run test/integration/uroanalise/aberturas-firestore.test.ts
 * Requires: emulator running (npm run fb:emulator:core)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  Timestamp,
} from '@/shared/services/firebase';
import { db } from '@/shared/services/firebase';
import {
  createAbertura,
  getAberturaAtiva,
  listAberturas,
  getAberturaById,
  isValidWorklabId,
} from '@/features/uroanalise/services/uroAberturaService';

const LAB_ID = 'test-lab-uro-aberturas';
const LOT_ID = 'test-lot-aberturas';
const COL_PATH = ['labs', LAB_ID, 'ciq-uroanalise', LOT_ID, 'aberturas'];

async function cleanAberturas() {
  const snap = await getDocs(collection(db, ...COL_PATH));
  const batch = writeBatch(db);
  for (const d of snap.docs) {
    batch.delete(doc(db, ...COL_PATH, d.id));
  }
  await batch.commit();
}

async function seedLot() {
  await setDoc(doc(db, 'labs', LAB_ID, 'ciq-uroanalise', LOT_ID), {
    nivel: 'N',
    loteControle: 'CTRL-001',
    fabricanteControle: 'Fabricante X',
    aberturaControle: '2026-01-01',
    validadeControle: Timestamp.now(),
    lotStatus: 'ativo',
    runCount: 0,
    createdAt: Timestamp.now(),
    createdBy: 'test-runner',
  });
}

const snapshotLote = {
  tipo: 'controle' as const,
  lote: 'L123',
  fabricante: 'Fabricante X',
  validade: Timestamp.now(),
};

describe('uroAberturaService', () => {
  beforeAll(async () => {
    await seedLot();
  });

  beforeEach(async () => {
    await cleanAberturas();
  });

  afterAll(async () => {
    await cleanAberturas();
  });

  describe('isValidWorklabId', () => {
    it.each([
      ['1', true],
      ['12', true],
      ['9999999999', true],
      ['10000000000', false], // 11 digits
      ['abc', false],
      ['12a', false],
      ['', false],
      ['1 2', false],
    ])('"%s" → %s', (val, expected) => {
      expect(isValidWorklabId(val)).toBe(expected);
    });
  });

  it('createAbertura cria abertura ativa e getAberturaAtiva retorna', async () => {
    const id = await createAbertura({
      labId: LAB_ID,
      lotId: LOT_ID,
      worklabId: '42',
      abertoPor: 'user-1',
      abertoPorNome: 'Test User',
      snapshotLote,
    });

    expect(id).toBeTruthy();
    const ativa = await getAberturaAtiva(LAB_ID, LOT_ID);
    expect(ativa).not.toBeNull();
    expect(ativa!.worklabId).toBe('42');
    expect(ativa!.abertaPor).toBe('user-1');
    expect(ativa!.ativa).toBe(true);
  });

  it('createAbertura desativa a anterior quando cria nova', async () => {
    await createAbertura({
      labId: LAB_ID,
      lotId: LOT_ID,
      worklabId: '10',
      abertoPor: 'user-1',
      abertoPorNome: 'User A',
      snapshotLote,
    });

    const primeira = await getAberturaAtiva(LAB_ID, LOT_ID);
    expect(primeira?.worklabId).toBe('10');

    await createAbertura({
      labId: LAB_ID,
      lotId: LOT_ID,
      worklabId: '20',
      abertoPor: 'user-2',
      abertoPorNome: 'User B',
      snapshotLote,
    });

    const nova = await getAberturaAtiva(LAB_ID, LOT_ID);
    expect(nova?.worklabId).toBe('20');

    // A anterior deve estar desativada
    const antiga = await getAberturaById(LAB_ID, LOT_ID, primeira!.id);
    expect(antiga?.ativa).toBe(false);
  });

  it('listAberturas retorna em ordem DESC por createdAt', async () => {
    await createAbertura({
      labId: LAB_ID,
      lotId: LOT_ID,
      worklabId: '1',
      abertoPor: 'u1',
      abertoPorNome: 'U A',
      snapshotLote,
      observacoes: 'primeira',
    });

    // Small delay so createdAt timestamps differ
    await new Promise((r) => setTimeout(r, 100));

    await createAbertura({
      labId: LAB_ID,
      lotId: LOT_ID,
      worklabId: '2',
      abertoPor: 'u2',
      abertoPorNome: 'U B',
      snapshotLote,
      observacoes: 'segunda',
    });

    const lista = await listAberturas(LAB_ID, LOT_ID);
    expect(lista.length).toBe(2);
    expect(lista[0].observacoes).toBe('segunda');
    expect(lista[1].observacoes).toBe('primeira');
  });

  it('rejeita worklabId invalido', async () => {
    await expect(
      createAbertura({
        labId: LAB_ID,
        lotId: LOT_ID,
        worklabId: 'abc',
        abertoPor: 'u1',
        abertoPorNome: 'U A',
        snapshotLote,
      }),
    ).rejects.toThrow('worklabId inválido');
  });
});
