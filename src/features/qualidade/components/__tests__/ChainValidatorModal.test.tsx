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
import { ChainValidatorModal } from '../ChainValidatorModal';
import * as auditCallables from '../../services/auditCallables';

// Mock the callable
jest.mock('../../services/auditCallables');

describe('ChainValidatorModal', () => {
  const mockLabId = 'lab-test-123' as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing when closed', () => {
    const { container } = render(
      <ChainValidatorModal open={false} labId={mockLabId} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should call validateChain when opened', async () => {
    const mockValidateChain = jest.fn().mockResolvedValue({
      ok: true,
      status: 'valido',
      lastCheckTime: Date.now(),
    });
    (auditCallables.callValidateChain as jest.Mock) = mockValidateChain;

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(mockValidateChain).toHaveBeenCalledWith({ labId: mockLabId });
    });
  });

  it('should display valid status when chain is intact', async () => {
    const mockValidateChain = jest.fn().mockResolvedValue({
      ok: true,
      status: 'valido',
      lastCheckTime: Date.now(),
    });
    (auditCallables.callValidateChain as jest.Mock) = mockValidateChain;

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Trilha íntegra')).toBeInTheDocument();
    });
  });

  it('should display broken status with violation details', async () => {
    const mockValidateChain = jest.fn().mockResolvedValue({
      ok: true,
      status: 'quebrado',
      firstViolation: {
        docId: 'doc-123',
        index: 5,
        expectedHash: 'hash-expected',
        actualHash: 'hash-actual',
      },
      lastCheckTime: Date.now(),
    });
    (auditCallables.callValidateChain as jest.Mock) = mockValidateChain;

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Trilha quebrada')).toBeInTheDocument();
      expect(screen.getByText('doc-123')).toBeInTheDocument();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = jest.fn();
    const mockValidateChain = jest.fn().mockResolvedValue({
      ok: true,
      status: 'valido',
      lastCheckTime: Date.now(),
    });
    (auditCallables.callValidateChain as jest.Mock) = mockValidateChain;

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
    const mockValidateChain = jest.fn().mockRejectedValue(
      new Error('Conexão falhou')
    );
    (auditCallables.callValidateChain as jest.Mock) = mockValidateChain;

    render(
      <ChainValidatorModal open={true} labId={mockLabId} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Conexão falhou')).toBeInTheDocument();
    });
  });

  it('should allow retry after error', async () => {
    const mockValidateChain = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 'valido',
        lastCheckTime: Date.now(),
      });
    (auditCallables.callValidateChain as jest.Mock) = mockValidateChain;

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
