import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection-ref'),
  doc: vi.fn(() => 'doc-ref'),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(() => 'where-clause'),
  orderBy: vi.fn(() => 'order-clause'),
  limit: vi.fn(() => 'limit-clause'),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));
vi.mock('../services/controlOperacionalService', () => ({
  updateControlOperacional: vi.fn(),
}));

import { createRTAction, listRTActionsByTarget } from '../services/rtActionService';
import * as firestore from 'firebase/firestore';
import * as controlService from '../services/controlOperacionalService';

const labId = 'lab-test-001';

describe('RTAction Service', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('cria RTAction de aprovação com sucesso', async () => {
    vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'rt-001' } as any);

    const result = await createRTAction(labId, 'rt-user', {
      tipo: 'aprovar_controle',
      controlOperacionalId: 'co-001',
      payload: { decisao: 'A', motivo: 'Controle dentro dos limites aceitáveis' },
    });

    expect(result.id).toBe('rt-001');
    expect(controlService.updateControlOperacional).toHaveBeenCalledWith(labId, 'co-001', { status: 'ativo' });
  });

  it('cria RTAction de rejeição com sucesso', async () => {
    vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'rt-002' } as any);

    const result = await createRTAction(labId, 'rt-user', {
      tipo: 'rejeitar_controle',
      controlOperacionalId: 'co-001',
      payload: { motivo: 'Desvio sistemático identificado no lote atual' },
    });

    expect(result.id).toBe('rt-002');
    expect(controlService.updateControlOperacional).toHaveBeenCalledWith(labId, 'co-001', { status: 'pausado' });
  });

  it('cria RTAction de NOTIVISA', async () => {
    vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'rt-003' } as any);

    const result = await createRTAction(labId, 'rt-user', {
      tipo: 'notificar_notivisa',
      attemptId: 'att-001',
      payload: {
        notivisaTipo: 'queixa_tecnica',
        motivo: 'Resultado inconsistente com bula do fabricante',
      },
    });

    expect(result.id).toBe('rt-003');
    expect(result.targetRef).toEqual({ type: 'Attempt', id: 'att-001' });
  });

  it('lista RTActions por target', async () => {
    vi.mocked(firestore.getDocs).mockResolvedValueOnce({ docs: [] } as any);
    const result = await listRTActionsByTarget(labId, { type: 'ControlOperacional', id: 'co-001' });
    expect(result).toEqual([]);
  });
});
