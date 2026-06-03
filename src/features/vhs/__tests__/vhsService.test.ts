import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection-ref'),
  doc: vi.fn(() => 'doc-ref'),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(() => 'where-clause'),
  orderBy: vi.fn(() => 'order-clause'),
  limit: vi.fn(() => 'limit-clause'),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  updateDoc: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
  },
}));

import {
  VHS_TOLERANCIA_MM_H,
  VHS_STATUS_TRANSITIONS,
  VHS_METODOS,
} from '../constants/vhsConstants';
import type {
  VHSExamInput,
  VHSAudit,
  VHSLeitura,
  VHSLeituraInput,
  VHSLiberarInput,
  VHSAddLeitura2Input,
  VHSStatus,
} from '../types/VHSExam';
import {
  saveVHSExam,
  addLeitura2,
  liberarDivergente,
  cancelarExame,
  listVHSExams,
  getVHSExam,
} from '../services/vhsService';
import * as firestore from 'firebase/firestore';

const labId = 'lab-test-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLeituraInput(valor: number, responsavelNome = 'Teste'): VHSLeituraInput {
  return { valor, responsavelNome, leituraEm: new Date('2026-06-01T10:00:00') };
}

function makeSig(): string {
  return 'a'.repeat(64);
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

  it('VHS_STATUS_TRANSITIONS.divergente permite liberado e cancelado', () => {
    expect(VHS_STATUS_TRANSITIONS.divergente).toContain('liberado');
    expect(VHS_STATUS_TRANSITIONS.divergente).toContain('cancelado');
    expect(VHS_STATUS_TRANSITIONS.divergente).toHaveLength(2);
  });

  it('VHS_METODOS tem 2 entradas: westergren e automatizado', () => {
    expect(VHS_METODOS).toHaveLength(2);
    expect(VHS_METODOS.map((m) => m.value)).toContain('westergren');
    expect(VHS_METODOS.map((m) => m.value)).toContain('automatizado');
  });
});

// ─── Types ───────────────────────────────────────────────────────────────────

describe('VHS Types', () => {
  it('VHSStatus aceita apenas pendente | liberado | divergente | cancelado', () => {
    const validStatuses: VHSStatus[] = ['pendente', 'liberado', 'divergente', 'cancelado'];
    expect(validStatuses).toHaveLength(4);
  });

  it('VHSLeitura tem campos: valor, responsavelNome, leituraEm, assinatura', () => {
    const leitura: VHSLeitura = {
      valor: 15,
      responsavelNome: 'Maria',
      leituraEm: { seconds: 1717200000, nanoseconds: 0 } as any,
      assinatura: 'a'.repeat(64),
    };
    expect(leitura.valor).toBe(15);
    expect(leitura.responsavelNome).toBe('Maria');
    expect(leitura.assinatura).toHaveLength(64);
  });

  it('VHSAudit tem registradoPor e registradoEm', () => {
    const audit: VHSAudit = {
      registradoPor: 'uid-001',
      registradoEm: { seconds: 1717200000, nanoseconds: 0 } as any,
    };
    expect(audit.registradoPor).toBe('uid-001');
    expect(audit.registradoEm).not.toBeNull();
  });
});

// ─── Service ─────────────────────────────────────────────────────────────────

describe('VHS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── saveVHSExam ──────────────────────────────────────────────────────────

  describe('saveVHSExam', () => {
    it('cria exame com leitura1 → status pendente, leitura2=null', async () => {
      vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'exam-001' } as any);

      const input: VHSExamInput = {
        amostraId: 'AMS-001',
        leitura1: makeLeituraInput(15),
        metodo: 'westergren',
      };
      const sig1 = makeSig();
      const uid = 'uid-001';

      const result = await saveVHSExam(labId, input, sig1, uid);

      expect(firestore.addDoc).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(firestore.addDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.status).toBe('pendente');
      expect((callArgs.leitura1 as VHSLeitura).valor).toBe(15);
      expect((callArgs.leitura1 as VHSLeitura).assinatura).toBe(sig1);
      expect((callArgs.leitura1 as VHSLeitura).responsavelNome).toBe('Teste');
      expect(callArgs.leitura2).toBeNull();
      expect(callArgs.divergencia).toBeNull();
      expect((callArgs.audit as VHSAudit).registradoPor).toBe(uid);
      expect(result).toBe('exam-001');
    });

    it('cria exame com leitura2 dentro da tolerância → status liberado', async () => {
      vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'exam-002' } as any);

      const input: VHSExamInput = {
        amostraId: 'AMS-002',
        leitura1: makeLeituraInput(15),
        leitura2: makeLeituraInput(16, 'João'),
        metodo: 'westergren',
      };
      const uid = 'uid-001';

      const result = await saveVHSExam(labId, input, makeSig(), uid, makeSig());

      const callArgs = vi.mocked(firestore.addDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.status).toBe('liberado');
      expect((callArgs.leitura2 as VHSLeitura).valor).toBe(16);
      expect(callArgs.divergencia).toBe(1);
      expect(callArgs.liberadoEm).toBe('server-timestamp');
      expect(callArgs.liberadoPor).toBe(uid);
      expect(result).toBe('exam-002');
    });

    it('cria exame com leitura2 divergente → status divergente, sem liberadoEm', async () => {
      vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'exam-003' } as any);

      const input: VHSExamInput = {
        amostraId: 'AMS-003',
        leitura1: makeLeituraInput(15),
        leitura2: makeLeituraInput(30, 'João'),
        metodo: 'westergren',
      };
      const uid = 'uid-001';

      const result = await saveVHSExam(labId, input, makeSig(), uid, makeSig());

      const callArgs = vi.mocked(firestore.addDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.status).toBe('divergente');
      expect(callArgs.divergencia).toBe(15);
      expect(callArgs.liberadoEm).toBeUndefined();
      expect(callArgs.liberadoPor).toBeUndefined();
      expect(result).toBe('exam-003');
    });

    it('cria exame com dupla checagem ativa (isValidationActive) → status liberado com 4 leituras persistidas', async () => {
      vi.mocked(firestore.addDoc).mockResolvedValueOnce({ id: 'exam-004' } as any);

      const input: VHSExamInput = {
        amostraId: 'AMS-004',
        leitura1: makeLeituraInput(15),
        leitura2: makeLeituraInput(16, 'João'),
        metodo: 'westergren',
        isValidationActive: true,
        validacaoLeitura1: makeLeituraInput(14, 'Carlos'),
        validacaoLeitura2: makeLeituraInput(15, 'Ana'),
      };
      const uid = 'uid-001';

      const result = await saveVHSExam(
        labId,
        input,
        makeSig(),
        uid,
        makeSig(),
        makeSig(),
        makeSig(),
      );

      const callArgs = vi.mocked(firestore.addDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.isValidationActive).toBe(true);
      expect(callArgs.status).toBe('liberado');
      expect((callArgs.leitura1 as VHSLeitura).valor).toBe(15);
      expect((callArgs.leitura2 as VHSLeitura).valor).toBe(16);
      expect((callArgs.validacaoLeitura1 as VHSLeitura).valor).toBe(14);
      expect((callArgs.validacaoLeitura2 as VHSLeitura).valor).toBe(15);
      expect(callArgs.liberadoEm).toBe('server-timestamp');
      expect(callArgs.liberadoPor).toBe(uid);
      expect(result).toBe('exam-004');
    });
  });

  // ── addLeitura2 ───────────────────────────────────────────────────────────

  describe('addLeitura2', () => {
    it('adiciona leitura2 em exame pendente com delta dentro da tolerância → status liberado', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pendente',
          leitura1: { valor: 15, responsavelNome: 'Teste', leituraEm: null, assinatura: makeSig() },
        }),
      } as any);

      const input: VHSAddLeitura2Input = { leitura2: makeLeituraInput(16, 'João') };

      const result = await addLeitura2(labId, 'exam-001', input, makeSig(), 'uid-002');

      expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
      const updateArgs = vi.mocked(firestore.updateDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(updateArgs.status).toBe('liberado');
      expect(updateArgs.divergencia).toBe(1);
      expect((updateArgs.leitura2 as VHSLeitura).valor).toBe(16);
      expect(updateArgs['audit.alteradoPor']).toBe('uid-002');
      expect(updateArgs.liberadoEm).toBe('server-timestamp');
      expect(updateArgs.liberadoPor).toBe('uid-002');
      expect(result).toEqual({ status: 'liberado', divergencia: 1 });
    });

    it('adiciona leitura2 divergente → status divergente, sem liberadoEm', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pendente',
          leitura1: { valor: 15, responsavelNome: 'Teste', leituraEm: null, assinatura: makeSig() },
        }),
      } as any);

      const input: VHSAddLeitura2Input = { leitura2: makeLeituraInput(30, 'João') };

      const result = await addLeitura2(labId, 'exam-002', input, makeSig(), 'uid-002');

      const updateArgs = vi.mocked(firestore.updateDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(updateArgs.status).toBe('divergente');
      expect(updateArgs.divergencia).toBe(15);
      expect(updateArgs.liberadoEm).toBeUndefined();
      expect(updateArgs.liberadoPor).toBeUndefined();
      expect(result).toEqual({ status: 'divergente', divergencia: 15 });
    });

    it('lança erro quando exame não está pendente', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'liberado', leitura1: {} }),
      } as any);

      const input: VHSAddLeitura2Input = { leitura2: makeLeituraInput(16) };

      await expect(addLeitura2(labId, 'exam-003', input, makeSig(), 'uid-002')).rejects.toThrow(
        'não aceita leitura 2',
      );

      expect(firestore.updateDoc).not.toHaveBeenCalled();
    });

    it('lança erro quando exame não existe', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      } as any);

      const input: VHSAddLeitura2Input = { leitura2: makeLeituraInput(16) };

      await expect(
        addLeitura2(labId, 'exam-notfound', input, makeSig(), 'uid-002'),
      ).rejects.toThrow('Exame não encontrado');

      expect(firestore.updateDoc).not.toHaveBeenCalled();
    });
  });

  // ── liberarDivergente ────────────────────────────────────────────────────

  describe('liberarDivergente', () => {
    it('libera exame divergente com motivo válido', async () => {
      const input: VHSLiberarInput = { motivo: 'Valor aceito conforme reavaliação clínica' };

      await liberarDivergente(labId, 'exam-001', 'rt-001', input);

      expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
      const updateArgs = vi.mocked(firestore.updateDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(updateArgs.status).toBe('liberado');
      expect(updateArgs.liberadoPor).toBe('rt-001');
      expect(updateArgs.liberadoMotivo).toBe(input.motivo.trim());
      expect(updateArgs['audit.alteradoPor']).toBe('rt-001');
    });

    it('lança erro com motivo menor que 10 caracteres', async () => {
      const input: VHSLiberarInput = { motivo: 'Curto' };

      await expect(liberarDivergente(labId, 'exam-001', 'rt-001', input)).rejects.toThrow(
        'Motivo deve ter pelo menos 10 caracteres',
      );

      expect(firestore.updateDoc).not.toHaveBeenCalled();
    });

    it('lança erro com motivo vazio', async () => {
      const input: VHSLiberarInput = { motivo: '' };

      await expect(liberarDivergente(labId, 'exam-001', 'rt-001', input)).rejects.toThrow(
        'Motivo deve ter pelo menos 10 caracteres',
      );

      expect(firestore.updateDoc).not.toHaveBeenCalled();
    });
  });

  // ── cancelarExame ─────────────────────────────────────────────────────────

  describe('cancelarExame', () => {
    it('cancela exame com motivo válido (>= 5 chars)', async () => {
      await cancelarExame(labId, 'exam-001', 'op-001', 'Amostra coagulada');

      expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
      const updateArgs = vi.mocked(firestore.updateDoc).mock.calls[0][1] as unknown as Record<
        string,
        unknown
      >;
      expect(updateArgs.status).toBe('cancelado');
      expect(updateArgs.canceladoPor).toBe('op-001');
      expect(updateArgs.canceladoMotivo).toBe('Amostra coagulada');
      expect(updateArgs['audit.alteradoPor']).toBe('op-001');
    });

    it('lança erro com motivo menor que 5 caracteres', async () => {
      await expect(cancelarExame(labId, 'exam-001', 'op-001', 'abc')).rejects.toThrow(
        'Motivo deve ter pelo menos 5 caracteres',
      );

      expect(firestore.updateDoc).not.toHaveBeenCalled();
    });

    it('lança erro com motivo vazio', async () => {
      await expect(cancelarExame(labId, 'exam-001', 'op-001', '')).rejects.toThrow(
        'Motivo deve ter pelo menos 5 caracteres',
      );

      expect(firestore.updateDoc).not.toHaveBeenCalled();
    });
  });

  // ── listVHSExams ──────────────────────────────────────────────────────────

  describe('listVHSExams', () => {
    it('aplica orderBy audit.registradoEm desc e limit default 50', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValueOnce({ docs: [] } as any);

      await listVHSExams(labId);

      expect(firestore.orderBy).toHaveBeenCalledWith('audit.registradoEm', 'desc');
      expect(firestore.limit).toHaveBeenCalledWith(50);
    });

    it('retorna array de exames quando existem docs', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'exam-001',
            data: () => ({
              labId,
              amostraId: 'AMS-001',
              metodo: 'westergren',
              status: 'liberado',
              leitura1: {
                valor: 15,
                responsavelNome: 'Teste',
                leituraEm: null,
                assinatura: makeSig(),
              },
              leitura2: {
                valor: 16,
                responsavelNome: 'João',
                leituraEm: null,
                assinatura: makeSig(),
              },
              divergencia: 1,
              audit: { registradoPor: 'uid-001', registradoEm: null },
            }),
          },
        ],
      } as any);

      const result = await listVHSExams(labId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('exam-001');
      expect(result[0].amostraId).toBe('AMS-001');
    });

    it('aplica filtro por status quando options.status é fornecido', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValueOnce({ docs: [] } as any);

      await listVHSExams(labId, { status: 'pendente' });

      expect(firestore.where).toHaveBeenCalledWith('status', '==', 'pendente');
      expect(firestore.orderBy).toHaveBeenCalledWith('audit.registradoEm', 'desc');
    });
  });

  // ── getVHSExam ────────────────────────────────────────────────────────────

  describe('getVHSExam', () => {
    it('retorna exame quando encontrado', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'exam-001',
        data: () => ({
          labId,
          amostraId: 'AMS-001',
          metodo: 'westergren',
          status: 'liberado',
          leitura1: { valor: 15, responsavelNome: 'Teste', leituraEm: null, assinatura: makeSig() },
          leitura2: { valor: 16, responsavelNome: 'João', leituraEm: null, assinatura: makeSig() },
          divergencia: 1,
          audit: { registradoPor: 'uid-001', registradoEm: null },
        }),
      } as any);

      const result = await getVHSExam(labId, 'exam-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('exam-001');
      expect(result!.amostraId).toBe('AMS-001');
      expect(result!.status).toBe('liberado');
    });

    it('retorna null quando exame não existe', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => false,
        id: 'exam-notfound',
        data: () => null,
      } as any);

      const result = await getVHSExam(labId, 'exam-notfound');

      expect(result).toBeNull();
    });
  });
});
