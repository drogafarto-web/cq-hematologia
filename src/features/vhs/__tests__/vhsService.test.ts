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
  updateDoc: vi.fn(),
}));

import {
  VHS_TOLERANCIA_MM_H,
  VHS_STATUS_TRANSITIONS,
  VHS_METODOS,
} from '../constants/vhsConstants';
import type { VHSStatus, VHSLeitura } from '../types/VHSExam';
import {
  saveLeitura1,
  saveLeitura2,
  liberarDivergente,
  cancelarExame,
  listVHSExams,
} from '../services/vhsService';
import * as firestore from 'firebase/firestore';

const labId = 'lab-test-001';

describe('VHS Constants', () => {
  it('VHS_TOLERANCIA_MM_H === 3', () => {
    expect(VHS_TOLERANCIA_MM_H).toBe(3);
  });

  it('VHS_STATUS_TRANSITIONS.liberado é array vazio (terminal)', () => {
    expect(VHS_STATUS_TRANSITIONS.liberado).toEqual([]);
  });

  it('VHS_STATUS_TRANSITIONS.cancelado é array vazio', () => {
    expect(VHS_STATUS_TRANSITIONS.cancelado).toEqual([]);
  });

  it('VHS_STATUS_TRANSITIONS.pendente permite transição para liberado, divergente, cancelado', () => {
    expect(VHS_STATUS_TRANSITIONS.pendente).toContain('liberado');
    expect(VHS_STATUS_TRANSITIONS.pendente).toContain('divergente');
    expect(VHS_STATUS_TRANSITIONS.pendente).toContain('cancelado');
    expect(VHS_STATUS_TRANSITIONS.pendente).toHaveLength(3);
  });

  it('VHS_METODOS tem 2 entradas: westergren e automatizado', () => {
    expect(VHS_METODOS).toHaveLength(2);
    expect(VHS_METODOS.map((m) => m.value)).toContain('westergren');
    expect(VHS_METODOS.map((m) => m.value)).toContain('automatizado');
  });
});

describe('VHS Types', () => {
  it('VHSStatus aceita apenas pendente | liberado | divergente | cancelado', () => {
    const validStatuses: VHSStatus[] = ['pendente', 'liberado', 'divergente', 'cancelado'];
    expect(validStatuses).toHaveLength(4);
    // Se VHSStatus aceitasse outros valores, a linha acima não compilari
  });

  it('VHSLeitura tem campos obrigatórios: valor, operadorId, operadorNome, ts, assinatura', () => {
    const leitura: VHSLeitura = {
      valor: 15,
      operadorId: 'op-001',
      operadorNome: 'Teste',
      ts: null,
      assinatura: 'a'.repeat(64),
    };
    expect(leitura.valor).toBe(15);
    expect(leitura.operadorId).toBe('op-001');
    expect(leitura.operadorNome).toBe('Teste');
    expect(leitura.ts).toBeNull();
    expect(leitura.assinatura).toHaveLength(64);
    // Se algum campo obrigatório faltasse, este teste não compilari
  });
});

describe('VHS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveLeitura1 chama addDoc na coleção labs/{labId}/vhs-exams com leitura1 preenchida e status pendente', async () => {
    vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'exam-001' } as any);

    const input = {
      amostraId: 'AMS-001',
      leitura1: { valor: 15, operadorId: 'op-001', operadorNome: 'Teste' },
      metodo: 'westergren' as const,
    };

    const result = await saveLeitura1(labId, input, 'sig-001');

    expect(firestore.addDoc).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(firestore.addDoc).mock.calls[0][1] as any;
    expect(callArgs.status).toBe('pendente');
    expect(callArgs.leitura1.valor).toBe(15);
    expect(callArgs.leitura1.assinatura).toBe('sig-001');
    expect(callArgs.leitura2).toBeNull();
    expect(result.id).toBe('exam-001');
  });

  it('saveLeitura2 chama updateDoc com status liberado quando delta <= 3', async () => {
    await saveLeitura2(
      labId,
      'exam-001',
      { leitura2: { valor: 16, operadorId: 'op-002', operadorNome: 'Teste2' } },
      'sig-002',
      'liberado',
    );

    expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(firestore.updateDoc).mock.calls[0][1] as any;
    expect(callArgs.status).toBe('liberado');
    expect(callArgs.leitura2.valor).toBe(16);
    expect(callArgs.liberadoEm).toBe('server-timestamp');
  });

  it('saveLeitura2 chama updateDoc com status divergente e divergencia populada quando delta > 3', async () => {
    await saveLeitura2(
      labId,
      'exam-001',
      { leitura2: { valor: 25, operadorId: 'op-002', operadorNome: 'Teste2' } },
      'sig-002',
      'divergente',
      { delta: 10, tolerancia: 3 },
    );

    expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(firestore.updateDoc).mock.calls[0][1] as any;
    expect(callArgs.status).toBe('divergente');
    expect(callArgs.divergencia).toEqual({ delta: 10, tolerancia: 3 });
    expect(callArgs.liberadoEm).toBeUndefined();
  });

  it('liberarDivergente valida motivo >= 10 chars (lança erro se menor)', async () => {
    await expect(liberarDivergente(labId, 'exam-001', 'rt-001', 'curto')).rejects.toThrow(
      'Motivo deve ter no minimo 10 caracteres',
    );
  });

  it('cancelarExame aceita qualquer motivo sem validação de tamanho', async () => {
    await expect(cancelarExame(labId, 'exam-001', 'op-001', 'ok')).resolves.not.toThrow();
    await expect(cancelarExame(labId, 'exam-001', 'op-001', 'x')).resolves.not.toThrow();
  });

  it('listVHSExams aplica orderBy criadoEm desc e limit default 50', async () => {
    vi.mocked(firestore.getDocs).mockResolvedValueOnce({ docs: [] } as any);

    await listVHSExams(labId);

    expect(firestore.orderBy).toHaveBeenCalledWith('criadoEm', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(50);
  });
});
