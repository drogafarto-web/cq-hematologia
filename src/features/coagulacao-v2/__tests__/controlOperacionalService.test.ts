import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection-ref'),
  doc: vi.fn(() => 'doc-ref'),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(() => 'where-clause'),
  orderBy: vi.fn(() => 'order-clause'),
  limit: vi.fn(() => 'limit-clause'),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

import {
  createControlOperacional,
  getControlOperacional,
  listControlOperacionals,
  updateControlOperacional,
  deleteControlOperacional,
} from '../services/controlOperacionalService';

import * as firestore from 'firebase/firestore';

const labId = 'lab-test-001';
const mockInput = {
  nome: 'Controle Normal',
  nivel: 'I' as const,
  insumoId: 'insumo-001',
  equipamentoId: 'equip-001',
  mean: { atividadeProtrombinica: 100, rni: 1.0, ttpa: 33 },
  sd: { atividadeProtrombinica: 5, rni: 0.1, ttpa: 3 },
  loteControle: 'LOT-123',
  fabricanteControle: 'Fabricante X',
  validadeControle: '2026-12-31',
  status: 'ativo' as const,
};

describe('ControlOperacional Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria um controle operacional com sucesso', async () => {
    vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'new-id' } as any);

    const result = await createControlOperacional(labId, mockInput);

    expect(firestore.addDoc).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('new-id');
    expect(result.labId).toBe(labId);
  });

  it('retorna null ao buscar controle inexistente', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce({ exists: () => false } as any);

    const result = await getControlOperacional(labId, 'nao-existe');

    expect(result).toBeNull();
  });

  it('lista controles com filtro de status', async () => {
    vi.mocked(firestore.getDocs).mockResolvedValueOnce({
      docs: [{ id: 'c1', data: () => mockInput }, { id: 'c2', data: () => mockInput }],
    } as any);

    const result = await listControlOperacionals(labId, { status: 'ativo' });

    expect(result).toHaveLength(2);
    expect(firestore.where).toHaveBeenCalledWith('status', '==', 'ativo');
  });

  it('atualiza mean e sd de um controle', async () => {
    vi.mocked(firestore.updateDoc).mockResolvedValueOnce(undefined);

    await updateControlOperacional(labId, 'c-001', {
      mean: { atividadeProtrombinica: 105, rni: 1.02, ttpa: 35 },
      sd: { atividadeProtrombinica: 6, rni: 0.12, ttpa: 4 },
    });

    expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
  });

  it('faz soft-delete marcando como aposentado', async () => {
    vi.mocked(firestore.updateDoc).mockResolvedValueOnce(undefined);

    await deleteControlOperacional(labId, 'c-001');

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ status: 'aposentado' }),
    );
  });
});
