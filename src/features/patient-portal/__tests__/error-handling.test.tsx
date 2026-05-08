/**
 * Error Handling Tests — All 10 error scenarios + accessibility
 * RDC 978 Art. 167 — Error communication + audit trail
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorAlert, type ErrorAlertProps } from '../components/ErrorAlert';
import { SuccessAlert } from '../components/SuccessAlert';
import { LoadingState } from '../components/LoadingState';
import { SessionExpiryWarning } from '../components/SessionExpiryWarning';
import { PortalErrorBoundary } from '../components/PortalErrorBoundary';
import { useAuthErrorHandler, AuthErrorCode } from '../hooks/useAuthErrorHandler';
import { renderHook } from '@testing-library/react';

// ─── ErrorAlert Tests ─────────────────────────────────────────────────────────

describe('ErrorAlert Component', () => {
  describe('Error scenarios (10 total)', () => {
    it('should handle token invalid error', () => {
      render(
        <ErrorAlert
          message="Link inválido. Solicite um novo."
          type="auth"
          actionLabel="Solicitar novo link"
          onAction={vi.fn()}
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/link inválido/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /solicitar/i })).toBeInTheDocument();
    });

    it('should handle token expired error', () => {
      render(
        <ErrorAlert
          message="Link expirado. Os links são válidos por 72 horas."
          type="auth"
          actionLabel="Solicitar novo link"
        />,
      );

      expect(screen.getByText(/link expirado/i)).toBeInTheDocument();
      expect(screen.getByText(/72 horas/i)).toBeInTheDocument();
    });

    it('should handle token already used error', () => {
      render(
        <ErrorAlert
          message="Este link já foi utilizado. Faça login ou solicite um novo."
          type="auth"
          actionLabel="Fazer login"
        />,
      );

      expect(screen.getByText(/já foi utilizado/i)).toBeInTheDocument();
    });

    it('should handle tampering detected error', () => {
      render(
        <ErrorAlert
          message="Link inválido (possível adulteração detectada)."
          type="auth"
          actionLabel="Solicitar novo link"
        />,
      );

      expect(screen.getByText(/adulteração/i)).toBeInTheDocument();
    });

    it('should handle lab not found error', () => {
      render(
        <ErrorAlert
          message="Laboratório não encontrado. Entre em contato com o suporte."
          type="auth"
        />,
      );

      expect(screen.getByText(/laboratório não encontrado/i)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should handle patient not found error', () => {
      render(
        <ErrorAlert
          message="Registro do paciente não encontrado. Entre em contato com o suporte."
          type="auth"
        />,
      );

      expect(screen.getByText(/paciente não encontrado/i)).toBeInTheDocument();
    });

    it('should handle email not found error', () => {
      render(
        <ErrorAlert
          message="Email não associado a este laboratório."
          type="email"
          actionLabel="Tentar outro email"
        />,
      );

      expect(screen.getByText(/email não associado/i)).toBeInTheDocument();
    });

    it('should handle rate limit error with countdown', () => {
      render(
        <ErrorAlert
          message="Muitas tentativas. Aguarde 1 minuto antes de tentar novamente."
          type="validation"
        />,
      );

      expect(screen.getByText(/muitas tentativas/i)).toBeInTheDocument();
      expect(screen.getByText(/1 minuto/i)).toBeInTheDocument();
    });

    it('should handle email service down error', () => {
      render(
        <ErrorAlert
          message="Serviço de email indisponível. Tente novamente em alguns momentos."
          type="network"
          actionLabel="Tentar novamente"
        />,
      );

      expect(screen.getByText(/email indisponível/i)).toBeInTheDocument();
    });

    it('should handle email recently sent error', () => {
      render(
        <ErrorAlert
          message="Email enviado recentemente. Verifique sua caixa de entrada ou tente em 5 minutos."
          type="session"
        />,
      );

      expect(screen.getByText(/enviado recentemente/i)).toBeInTheDocument();
      expect(screen.getByText(/5 minutos/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert" for immediate announcement', () => {
      render(<ErrorAlert message="Test error" type="auth" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live="assertive"', () => {
      render(<ErrorAlert message="Test error" type="auth" />);
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    });

    it('should focus on mount when autoFocus=true', () => {
      render(<ErrorAlert message="Test error" type="auth" autoFocus />);
      expect(screen.getByRole('alert')).toHaveFocus();
    });

    it('should have aria-describedby linking to message', () => {
      render(<ErrorAlert message="Test error" type="auth" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-describedby');
    });

    it('should dismiss on X button click', async () => {
      const handleDismiss = vi.fn();
      const { unmount } = render(
        <ErrorAlert message="Test error" type="auth" onDismiss={handleDismiss} />,
      );

      const dismissBtn = screen.getByLabelText(/fechar/i);
      await userEvent.click(dismissBtn);

      expect(handleDismiss).toHaveBeenCalled();
    });

    it('should call onAction when action button clicked', async () => {
      const handleAction = vi.fn();
      render(
        <ErrorAlert
          message="Test error"
          type="auth"
          actionLabel="Retry"
          onAction={handleAction}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(handleAction).toHaveBeenCalled();
    });
  });

  describe('Styling by type', () => {
    it('should style auth errors with red background', () => {
      const { container } = render(<ErrorAlert message="Error" type="auth" />);
      expect(container.firstChild).toHaveClass('bg-red-500/10');
    });

    it('should style session errors with orange background', () => {
      const { container } = render(<ErrorAlert message="Error" type="session" />);
      expect(container.firstChild).toHaveClass('bg-orange-500/10');
    });
  });
});

// ─── SuccessAlert Tests ───────────────────────────────────────────────────────

describe('SuccessAlert Component', () => {
  it('should render success message', () => {
    render(<SuccessAlert message="Email enviado com sucesso!" />);
    expect(screen.getByText(/email enviado/i)).toBeInTheDocument();
  });

  it('should have role="alert" and aria-live="polite"', () => {
    render(<SuccessAlert message="Success" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('should auto-dismiss after 5 seconds by default', async () => {
    const handleDismiss = vi.fn();
    render(<SuccessAlert message="Success" onDismiss={handleDismiss} />);

    expect(screen.getByText(/success/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(handleDismiss).toHaveBeenCalled();
      },
      { timeout: 6000 },
    );
  });

  it('should not auto-dismiss if autoDismissMs=0', () => {
    const handleDismiss = vi.fn();
    render(<SuccessAlert message="Success" autoDismissMs={0} onDismiss={handleDismiss} />);

    // Wait to ensure it's still visible
    vi.advanceTimersByTime(5000);
    expect(handleDismiss).not.toHaveBeenCalled();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('should dismiss on X button click', async () => {
    const handleDismiss = vi.fn();
    render(<SuccessAlert message="Success" autoDismissMs={10000} onDismiss={handleDismiss} />);

    await userEvent.click(screen.getByLabelText(/fechar/i));
    expect(handleDismiss).toHaveBeenCalled();
  });
});

// ─── LoadingState Tests ───────────────────────────────────────────────────────

describe('LoadingState Component', () => {
  describe('Skeleton variant', () => {
    it('should render skeleton items', () => {
      render(<LoadingState variant="skeleton" count={3} />);
      expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(0); // aria-hidden
    });

    it('should have role="status" and aria-busy="true"', () => {
      render(<LoadingState variant="skeleton" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');
    });

    it('should accept custom count', () => {
      const { container } = render(<LoadingState variant="skeleton" count={5} />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons).toHaveLength(5);
    });
  });

  describe('Spinner variant', () => {
    it('should render spinner with label', () => {
      render(<LoadingState variant="spinner" label="Loading..." />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should have aria-busy="true"', () => {
      render(<LoadingState variant="spinner" />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Minimal variant', () => {
    it('should render text only', () => {
      render(<LoadingState variant="minimal" label="Aguarde..." />);
      expect(screen.getByText(/aguarde/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="status" for all variants', () => {
      const variants = ['skeleton', 'spinner', 'minimal'] as const;
      variants.forEach((v) => {
        const { unmount } = render(<LoadingState variant={v} />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        unmount();
      });
    });

    it('should respect aria-live prop', () => {
      render(<LoadingState variant="spinner" ariaLive="assertive" />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
    });

    it('should support fullHeight for centered screens', () => {
      const { container } = render(<LoadingState variant="spinner" fullHeight />);
      expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
    });
  });
});

// ─── SessionExpiryWarning Tests ───────────────────────────────────────────────

describe('SessionExpiryWarning Component', () => {
  it('should not render when isOpen=false', () => {
    render(
      <SessionExpiryWarning
        isOpen={false}
        timeRemaining={600000}
        onContinue={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('should render modal when isOpen=true', () => {
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeRemaining={600000}
        onContinue={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/sessão está prestes a expirar/i)).toBeInTheDocument();
  });

  it('should display formatted countdown time', () => {
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeRemaining={5 * 60000 + 30000} // 5m 30s
        onContinue={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText(/5m/i)).toBeInTheDocument();
  });

  it('should auto-focus Continue button', () => {
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeRemaining={600000}
        onContinue={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    const continueBtn = screen.getByRole('button', { name: /continuar/i });
    expect(continueBtn).toHaveFocus();
  });

  it('should call onContinue when Continue clicked', async () => {
    const handleContinue = vi.fn();
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeRemaining={600000}
        onContinue={handleContinue}
        onLogout={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(handleContinue).toHaveBeenCalled();
  });

  it('should call onLogout when Logout clicked', async () => {
    const handleLogout = vi.fn();
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeRemaining={600000}
        onContinue={vi.fn()}
        onLogout={handleLogout}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(handleLogout).toHaveBeenCalled();
  });

  it('should close on Escape key', async () => {
    const handleLogout = vi.fn();
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeRemaining={600000}
        onContinue={vi.fn()}
        onLogout={handleLogout}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(handleLogout).toHaveBeenCalled();
    });
  });

  it('should have role="alertdialog"', () => {
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeRemaining={600000}
        onContinue={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

// ─── Error Handler Hook Tests ──────────────────────────────────────────────────

describe('useAuthErrorHandler Hook', () => {
  it('should map all 10 error codes to messages', () => {
    const { result } = renderHook(() => useAuthErrorHandler());

    const errorCodes = [
      AuthErrorCode.TOKEN_INVALID,
      AuthErrorCode.TOKEN_EXPIRED,
      AuthErrorCode.TOKEN_USED,
      AuthErrorCode.TOKEN_TAMPERED,
      AuthErrorCode.LAB_NOT_FOUND,
      AuthErrorCode.PATIENT_NOT_FOUND,
      AuthErrorCode.EMAIL_NOT_FOUND,
      AuthErrorCode.RATE_LIMITED,
      AuthErrorCode.EMAIL_SERVICE_DOWN,
      AuthErrorCode.EMAIL_RECENTLY_SENT,
    ];

    errorCodes.forEach((code) => {
      const error = result.current.getErrorInfo(code);
      expect(error.message).toBeTruthy();
      expect(error.code).toBe(code);
    });
  });

  it('should identify retryable errors', () => {
    const { result } = renderHook(() => useAuthErrorHandler());

    expect(result.current.isRetryable(AuthErrorCode.EMAIL_SERVICE_DOWN)).toBe(true);
    expect(result.current.isRetryable(AuthErrorCode.RATE_LIMITED)).toBe(true);
    expect(result.current.isRetryable(AuthErrorCode.NETWORK_ERROR)).toBe(true);

    expect(result.current.isRetryable(AuthErrorCode.TOKEN_INVALID)).toBe(false);
    expect(result.current.isRetryable(AuthErrorCode.LAB_NOT_FOUND)).toBe(false);
  });

  it('should provide action labels for retryable errors', () => {
    const { result } = renderHook(() => useAuthErrorHandler());

    const error = result.current.getErrorInfo(AuthErrorCode.EMAIL_SERVICE_DOWN);
    expect(error.actionLabel).toBeTruthy();
  });
});

// ─── PortalErrorBoundary Tests ────────────────────────────────────────────────

describe('PortalErrorBoundary Component', () => {
  it('should catch and display errors', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <PortalErrorBoundary>
        <ThrowError />
      </PortalErrorBoundary>,
    );

    expect(screen.getByText(/algo deu errado/i)).toBeInTheDocument();
  });

  it('should provide error ID for support', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <PortalErrorBoundary>
        <ThrowError />
      </PortalErrorBoundary>,
    );

    expect(screen.getByText(/id do erro/i)).toBeInTheDocument();
  });

  it('should show reload button', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <PortalErrorBoundary>
        <ThrowError />
      </PortalErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: /recarregar/i })).toBeInTheDocument();
  });

  it('should render children when no error', () => {
    render(
      <PortalErrorBoundary>
        <div>Safe content</div>
      </PortalErrorBoundary>,
    );

    expect(screen.getByText(/safe content/i)).toBeInTheDocument();
  });
});
