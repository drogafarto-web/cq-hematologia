import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { UroInsumoPicker } from '../../../src/features/uroanalise/components/UroInsumoPicker';
import * as useUroLotsModule from '../../../src/features/uroanalise/hooks/useUroLots';

vi.mock('../../../src/features/uroanalise/hooks/useUroLots');
vi.mock('../../../src/store/useAuthStore', () => ({
  useActiveLabId: () => 'lab-123',
}));

const mockLots = [
  {
    id: 'lot-1',
    tipo: 'controle' as const,
    nivel: 'N' as const,
    loteControle: 'CTRL-2026-001',
    fabricanteControle: 'BioRad',
    aberturaControle: '2026-01-15',
    validadeControle: '2026-12-01',
    lotStatus: 'valido' as const,
    runCount: 5,
    createdAt: new Date('2026-01-15') as any,
    createdBy: 'user-1',
    labId: 'lab-123',
  },
  {
    id: 'lot-2',
    tipo: 'controle' as const,
    nivel: 'P' as const,
    loteControle: 'CTRL-2026-002',
    fabricanteControle: 'Randox',
    aberturaControle: '2025-06-01',
    validadeControle: '2024-01-01',
    lotStatus: 'reprovado' as const,
    runCount: 20,
    createdAt: new Date('2025-06-01') as any,
    createdBy: 'user-1',
    labId: 'lab-123',
  },
];

describe('UroInsumoPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton while loading', () => {
    vi.spyOn(useUroLotsModule, 'useUroLots').mockReturnValue({
      lots: [],
      isLoading: true,
      error: null,
    });

    render(<UroInsumoPicker tipo="controle" label="Controle" onChange={vi.fn()} />);

    expect(screen.getByText('Controle')).toBeInTheDocument();
    // Skeleton div
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no lots exist', () => {
    vi.spyOn(useUroLotsModule, 'useUroLots').mockReturnValue({
      lots: [],
      isLoading: false,
      error: null,
    });

    render(<UroInsumoPicker tipo="controle" label="Controle" onChange={vi.fn()} />);

    expect(screen.getByText('Nenhum lote cadastrado.')).toBeInTheDocument();
  });

  it('shows lots in dropdown when opened', async () => {
    const user = userEvent.setup();
    vi.spyOn(useUroLotsModule, 'useUroLots').mockReturnValue({
      lots: mockLots,
      isLoading: false,
      error: null,
    });

    render(<UroInsumoPicker tipo="controle" label="Controle" onChange={vi.fn()} />);

    // Click to open
    await user.click(screen.getByText('Selecionar…'));

    // Should show the valid lot (lot-1) but not the reprovado one (lot-2)
    expect(screen.getByText(/CTRL-2026-001/)).toBeInTheDocument();
    expect(screen.queryByText(/CTRL-2026-002/)).not.toBeInTheDocument();
  });

  it('filters lots by search term', async () => {
    const user = userEvent.setup();
    vi.spyOn(useUroLotsModule, 'useUroLots').mockReturnValue({
      lots: mockLots,
      isLoading: false,
      error: null,
    });

    render(<UroInsumoPicker tipo="controle" label="Controle" onChange={vi.fn()} />);

    // Open dropdown
    await user.click(screen.getByText('Selecionar…'));

    // Search for "Randox"
    const searchInput = screen.getByPlaceholderText('Buscar lote ou fabricante…');
    await user.type(searchInput, 'Randox');

    // Wait for debounce (200ms) + render cycle
    await vi.waitFor(
      () => {
        expect(screen.getByText(/Nenhum resultado/)).toBeInTheDocument();
      },
      { timeout: 500 },
    );
  });
});
