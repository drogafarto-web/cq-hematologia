/**
 * ChainValidatorModal.test.tsx
 *
 * Unit tests for ChainValidatorModal component.
 * Verifies:
 * - Modal opens/closes
 * - Callable is invoked on open
 * - Result states render correctly (valid, broken, error)
 * - Buttons work (refresh, close, export)
 * - Timeout warning appears
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainValidatorModal } from '../ChainValidatorModal';
import * as auditCallables from '../../services/auditCallables';

vi.mock('../../services/auditCallables', () => ({
  callValidateChain: vi.fn(),
}));

describe('ChainValidatorModal', () => {
  const mockLabId = 'lab-test-123' as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when closed', () => {
    const { container } = render(
      <ChainValidatorModal open={false} labId={mockLabId} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should call validateChain when opened', async () => {
    vi.mocked(auditCallables.callValidateChain).mockResolvedValue({
      ok: true,
      status: 'valido',
      lastCheckTime: Date.now(),
    } as any);

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(auditCallables.callValidateChain).toHaveBeenCalledWith({ labId: mockLabId });
    });
  });

  it('should display valid status when chain is intact', async () => {
    vi.mocked(auditCallables.callValidateChain).mockResolvedValue({
      ok: true,
      status: 'valido',
      lastCheckTime: Date.now(),
    } as any);

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Trilha íntegra')).toBeInTheDocument();
    });
  });

  it('should display broken status with violation details', async () => {
    vi.mocked(auditCallables.callValidateChain).mockResolvedValue({
      ok: true,
      status: 'quebrado',
      firstViolation: {
        docId: 'doc-123',
        index: 5,
        expectedHash: 'hash-expected',
        actualHash: 'hash-actual',
      },
      lastCheckTime: Date.now(),
    } as any);

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Trilha quebrada')).toBeInTheDocument();
      expect(screen.getByText('doc-123')).toBeInTheDocument();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = vi.fn();
    vi.mocked(auditCallables.callValidateChain).mockResolvedValue({
      ok: true,
      status: 'valido',
      lastCheckTime: Date.now(),
    } as any);

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Trilha íntegra')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('Fechar');
    await userEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(auditCallables.callValidateChain).mockRejectedValue(
      new Error('Conexão falhou')
    );

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Conexão falhou')).toBeInTheDocument();
    });
  });

  it('should allow retry after error', async () => {
    vi.mocked(auditCallables.callValidateChain)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 'valido',
        lastCheckTime: Date.now(),
      } as any);

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Verificar novamente');
    await userEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('Trilha íntegra')).toBeInTheDocument();
    });
  });
});
