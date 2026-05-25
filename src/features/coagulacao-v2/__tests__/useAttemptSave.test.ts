import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../shared/services/firebase', () => ({ db: {} }));
vi.mock('../../coagulacao/hooks/useCoagSignature', () => ({
  useCoagSignature: () => ({ sign: vi.fn(() => Promise.resolve({ logicalSignature: 'a'.repeat(64), signedBy: 'user-001', signedAt: '2026-05-25T01:00:00.000Z' })), isReady: true }),
  canonicalizeCoagResultados: vi.fn((r: Record<string, number>) => JSON.stringify(r)),
}));
vi.mock('../../coagulacao/hooks/useCoagWestgard', () => ({
  computeCoagWestgard: () => ({
    byRun: new Map([['__simulated__', { conformidade: 'A', allViolations: [], analitosComViolacao: [] }]]),
    lotStatus: 'valido',
    lotAlerts: [],
  }),
}));
vi.mock('../services/attemptService', () => ({
  saveAttempt: vi.fn(() => Promise.resolve({ id: 'att-001' })),
  listAttempts: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../services/controlOperacionalService', () => ({
  getControlOperacional: vi.fn(() => Promise.resolve({
    id: 'co-001',
    status: 'ativo',
    nivel: 'I',
    mean: { atividadeProtrombinica: 100, rni: 1.0, ttpa: 33 },
    sd: { atividadeProtrombinica: 5, rni: 0.1, ttpa: 3 },
    validadeControle: '2026-12-31',
  })),
}));
vi.mock('../../insumos/types/InsumoSnapshot', () => ({
  buildInsumoSnapshot: vi.fn(() => ({ id: 'ins-001', lote: 'LOT' })),
}));
vi.mock('../../equipamentos/types/Equipamento', () => ({
  buildEquipamentoSnapshot: vi.fn(() => ({ id: 'equip-001', name: 'Clotimer Duo' })),
}));

import { useAttemptSave } from '../hooks/useAttemptSave';

describe('useAttemptSave', () => {
  it('salva tentativa com sucesso e retorna resultado', async () => {
    const { result } = renderHook(() => useAttemptSave('lab-001'));

    const attempt = await result.current.save({
      controlOperacionalId: 'co-001',
      equipamentoId: 'equip-001',
      resultados: { atividadeProtrombinica: 98, rni: 1.02, ttpa: 33.5 },
    });

    expect(attempt).toBeDefined();
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('rejeita salvar sem ação corretiva para tentativa R', async () => {
    vi.mocked(await import('../../coagulacao/hooks/useCoagWestgard')).computeCoagWestgard = vi.fn(() => ({
      byRun: new Map([['__simulated__', { conformidade: 'R', allViolations: [{ rule: '1-2s' }], analitosComViolacao: ['rni'] }]]),
      lotStatus: 'valido',
      lotAlerts: [],
    }));

    const { result } = renderHook(() => useAttemptSave('lab-001'));

    await expect(
      result.current.save({
        controlOperacionalId: 'co-001',
        equipamentoId: 'equip-001',
        resultados: { atividadeProtrombinica: 75, rni: 1.45, ttpa: 34 },
      }),
    ).rejects.toThrow('Ação corretiva é obrigatória');
  });
});
