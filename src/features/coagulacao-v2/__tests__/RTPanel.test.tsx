import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../shared/services/firebase', () => ({ db: {} }));
vi.mock('../../../store/useAuthStore', () => ({
  useActiveLab: () => ({ id: 'lab-test-001' }),
}));
vi.mock('../hooks/useAttempts', () => ({
  useAttempts: () => ({
    attempts: [
      { id: 'att-001', controlOperacionalId: 'co-001', resultados: { atividadeProtrombinica: 98, rni: 1.02, ttpa: 33.5 }, conformidade: 'A' },
    ],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../hooks/useRTAction', () => ({
  useRTAction: () => ({ create: vi.fn(), isSaving: false, error: null }),
}));

import { RTPanel } from '../components/RTPanel';

describe('RTPanel', () => {
  it('renderiza KPIs corretamente', () => {
    render(<RTPanel />);
    expect(screen.getByText('tentativas')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('renderiza lista de tentativas', () => {
    render(<RTPanel />);
    expect(screen.getByText((c: string) => c.includes('att-00'))).toBeDefined();
  });
});
