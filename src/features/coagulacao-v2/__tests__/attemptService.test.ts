import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection-ref'),
  doc: vi.fn(() => 'doc-ref'),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(() => 'where-clause'),
  orderBy: vi.fn(() => 'order-clause'),
  limit: vi.fn(() => 'limit-clause'),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

import { saveAttempt, getAttempt, listAttempts } from '../services/attemptService';
import * as firestore from 'firebase/firestore';

const labId = 'lab-test-001';
const mockData = {
  controlOperacionalId: 'co-001',
  equipamentoId: 'equip-001',
  resultados: { atividadeProtrombinica: 98, rni: 1.02, ttpa: 33.5 },
  conformidade: 'A' as const,
  violacoes: [],
  analitosComViolacao: [],
  snapshot: {
    controle: { id: 'ins-001', tipo: 'controle', lote: 'LOT-123' } as any,
    reagente: { id: 'ins-002', tipo: 'reagente', lote: 'REAG-456' } as any,
    reagenteTtpa: null,
    equipamento: { id: 'equip-001', name: 'Clotimer Duo' } as any,
  },
  overrides: { insumoVencido: false, qcNaoValidado: false, motivo: null },
  logicalSignature: 'a'.repeat(64),
};

describe('Attempt Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('salva tentativa com sucesso', async () => {
    vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'att-001' } as any);
    const result = await saveAttempt(labId, 'user-001', '', mockData);
    expect(result.id).toBe('att-001');
    expect(firestore.addDoc).toHaveBeenCalledTimes(1);
  });

  it('retorna null ao buscar tentativa inexistente', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce({ exists: () => false } as any);
    const result = await getAttempt(labId, 'nao-existe');
    expect(result).toBeNull();
  });

  it('lista tentativas com filtro', async () => {
    vi.mocked(firestore.getDocs).mockResolvedValueOnce({ docs: [] } as any);
    const result = await listAttempts(labId, { conformidade: 'R', limit: 10 });
    expect(result).toEqual([]);
    expect(firestore.where).toHaveBeenCalledWith('conformidade', '==', 'R');
  });
});
