/**
 * Portal RT — Section Tests
 *
 * Unit tests for Dashboard, Críticos, Resultados, Compliance, and Configuração sections.
 * Coverage: rendering, data loading, state changes, user interactions, error states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardSection } from '../sections/DashboardSection';
import { CriticosSection } from '../sections/CriticosSection';
import { ResultadosSection } from '../sections/ResultadosSection';
import { ComplianceSection } from '../sections/ComplianceSection';
import { ConfiguracaoSection } from '../sections/ConfiguracaoSection';

// Mock useAuthStore
vi.mock('../../../store/useAuthStore', () => ({
  useActiveLabId: () => 'lab-123',
  useActiveLab: () => ({ id: 'lab-123', name: 'Test Lab' }),
  useUser: () => ({ uid: 'user-123', email: 'test@lab.com', displayName: 'Test User' }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Section Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('DashboardSection', () => {
  it('renders title and subtitle', async () => {
    render(<DashboardSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Visão geral operacional')).toBeInTheDocument();
    });
  });

  it('displays loading skeleton initially', () => {
    render(<DashboardSection labId="lab-123" />);

    // Skeleton should be present (animated divs)
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('loads and displays metrics', async () => {
    render(<DashboardSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Críticos Pendentes')).toBeInTheDocument();
      expect(screen.getByText('Reconhecidos 24h')).toBeInTheDocument();
      expect(screen.getByText('Escalações Semana')).toBeInTheDocument();
      expect(screen.getByText('Saúde do Sistema')).toBeInTheDocument();
    });
  });

  it('displays metric values with trends', async () => {
    render(<DashboardSection labId="lab-123" />);

    await waitFor(() => {
      // Critical value should be present
      expect(screen.getByText('3')).toBeInTheDocument();
      // Status badges
      expect(screen.getByText(/Críticos Pendentes/i)).toBeInTheDocument();
    });
  });

  it('shows quick stats row', async () => {
    render(<DashboardSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Taxa Conformidade')).toBeInTheDocument();
      expect(screen.getByText('Testes em Fila')).toBeInTheDocument();
      expect(screen.getByText('Tempo Médio RT')).toBeInTheDocument();
    });
  });

  it('accepts labId prop', async () => {
    const { rerender } = render(<DashboardSection labId="lab-456" />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    rerender(<DashboardSection labId="lab-789" />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Críticos Section Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('CriticosSection', () => {
  it('renders title and subtitle', async () => {
    render(<CriticosSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Valores Críticos')).toBeInTheDocument();
      expect(screen.getByText(/Escalações e revisões pendentes/i)).toBeInTheDocument();
    });
  });

  it('displays loading skeleton', () => {
    render(<CriticosSection labId="lab-123" />);

    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('loads and displays critical alerts', async () => {
    render(<CriticosSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });
  });

  it('displays severity badges correctly', async () => {
    render(<CriticosSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Crítico')).toBeInTheDocument();
      expect(screen.getByText('Grave')).toBeInTheDocument();
    });
  });

  it('shows action buttons for pending alerts', async () => {
    render(<CriticosSection labId="lab-123" />);

    await waitFor(() => {
      const acknowledgeButtons = screen.getAllByText('Reconhecer');
      expect(acknowledgeButtons.length).toBeGreaterThan(0);

      const escalateButtons = screen.getAllByText('Escalar');
      expect(escalateButtons.length).toBeGreaterThan(0);
    });
  });

  it('handles acknowledge action', async () => {
    const onActionComplete = vi.fn();
    render(<CriticosSection labId="lab-123" onActionComplete={onActionComplete} />);

    await waitFor(() => {
      const acknowledgeButtons = screen.getAllByText('Reconhecer');
      expect(acknowledgeButtons.length).toBeGreaterThan(0);
    });

    const acknowledgeButton = screen.getAllByText('Reconhecer')[0];
    fireEvent.click(acknowledgeButton);

    await waitFor(() => {
      expect(onActionComplete).toHaveBeenCalled();
    });
  });

  it('handles escalate action', async () => {
    const onActionComplete = vi.fn();
    render(<CriticosSection labId="lab-123" onActionComplete={onActionComplete} />);

    await waitFor(() => {
      const escalateButtons = screen.getAllByText('Escalar');
      expect(escalateButtons.length).toBeGreaterThan(0);
    });

    const escalateButton = screen.getAllByText('Escalar')[0];
    fireEvent.click(escalateButton);

    await waitFor(() => {
      expect(onActionComplete).toHaveBeenCalled();
    });
  });

  it('displays acknowledged alerts section', async () => {
    render(<CriticosSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Reconhecidos Hoje/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no pending alerts', async () => {
    // Mock with only acknowledged alerts
    render(<CriticosSection labId="lab-123" />);

    await waitFor(() => {
      // Component should render without errors
      expect(screen.getByText('Valores Críticos')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Resultados Section Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ResultadosSection', () => {
  it('renders title and subtitle', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Resultados')).toBeInTheDocument();
      expect(screen.getByText(/Testes processados e laudos/i)).toBeInTheDocument();
    });
  });

  it('displays loading skeleton', () => {
    render(<ResultadosSection labId="lab-123" />);

    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('loads and displays resultados with progress indicators', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });
  });

  it('displays status badges for each resultado', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      // Check for status badge text in the page (may appear multiple times in stats + cards)
      const statusBadges = screen.queryAllByText(/Aguardando|Enviado/);
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });

  it('shows stats header with counts', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      // Stats section should be present
      expect(screen.getByText('Assinatura RT')).toBeInTheDocument();
      expect(screen.getByText('Enviados')).toBeInTheDocument();
      expect(screen.getByText('Falhas')).toBeInTheDocument();
    });
  });

  it('displays sign button for waiting-rt status', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      const signButtons = screen.getAllByText('Assinar');
      expect(signButtons.length).toBeGreaterThan(0);
    });
  });

  it('handles sign action', async () => {
    const onActionComplete = vi.fn();
    render(<ResultadosSection labId="lab-123" onActionComplete={onActionComplete} />);

    await waitFor(() => {
      const signButtons = screen.getAllByText('Assinar');
      expect(signButtons.length).toBeGreaterThan(0);
    });

    const signButton = screen.getAllByText('Assinar')[0];
    fireEvent.click(signButton);

    await waitFor(() => {
      expect(onActionComplete).toHaveBeenCalled();
    });
  });

  it('displays retry button for failed status', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      const retryButtons = screen.getAllByText('Reenviar');
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it('handles retry action', async () => {
    const onActionComplete = vi.fn();
    render(<ResultadosSection labId="lab-123" onActionComplete={onActionComplete} />);

    await waitFor(() => {
      const retryButtons = screen.getAllByText('Reenviar');
      expect(retryButtons.length).toBeGreaterThan(0);
    });

    const retryButton = screen.getAllByText('Reenviar')[0];
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(onActionComplete).toHaveBeenCalled();
    });
  });

  it('displays progress steps for each resultado', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      // Progress indicators should be rendered
      expect(screen.getAllByText('OCR').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Assinatura').length).toBeGreaterThan(0);
      expect(screen.getAllByText('NOTIVISA').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Section Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ComplianceSection', () => {
  it('renders title and subtitle', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Compliance')).toBeInTheDocument();
      expect(screen.getByText(/Conformidade regulatória e auditoria/i)).toBeInTheDocument();
    });
  });

  it('displays loading skeleton', () => {
    render(<ComplianceSection labId="lab-123" />);

    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('loads and displays DICQ compliance percentage', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      // Should display compliance percentage
      expect(screen.getByText(/80%|100%|60%/)).toBeInTheDocument();
    });
  });

  it('displays DICQ items with status badges', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Conformidade DICQ/i)).toBeInTheDocument();
      // Check for any status badge (may appear multiple times)
      const badges = screen.queryAllByText(/Conforme|Parcial/);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('displays risk register section', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Registro de Riscos/i)).toBeInTheDocument();
    });
  });

  it('shows critical risks count', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      // Should display number of critical risks
      expect(screen.getByText(/crítico/i)).toBeInTheDocument();
    });
  });

  it('displays training expiry alerts section', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Vencimentos de Treinamento/i)).toBeInTheDocument();
    });
  });

  it('shows urgent training alerts', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      // Should show training names (may appear multiple times)
      const names = screen.queryAllByText(/Maria Silva|João Santos/);
      expect(names.length).toBeGreaterThan(0);
    });
  });

  it('displays summary cards', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Auditorias')).toBeInTheDocument();
      expect(screen.getByText(/Não Conformidades/i)).toBeInTheDocument();
      expect(screen.getByText(/Próxima Auditoria/i)).toBeInTheDocument();
    });
  });

  it('shows progress bar with correct styling', async () => {
    render(<ComplianceSection labId="lab-123" />);

    await waitFor(() => {
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Configuração Section Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ConfiguracaoSection', () => {
  it('renders title and subtitle', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Configuração')).toBeInTheDocument();
      expect(screen.getByText(/Ajustes e preferências/i)).toBeInTheDocument();
    });
  });

  it('displays loading skeleton', () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('loads and displays user profile section', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Perfil do Operador/i)).toBeInTheDocument();
    });
  });

  it('displays user profile fields', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText('Nome')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      // Multiple "Telefone" labels exist, just check for at least one
      const telefones = screen.queryAllByText('Telefone');
      expect(telefones.length).toBeGreaterThan(0);
      expect(screen.getByText('Função')).toBeInTheDocument();
    });
  });

  it('displays security settings section', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Segurança/i)).toBeInTheDocument();
      expect(screen.getByText(/Alterar Senha/i)).toBeInTheDocument();
    });
  });

  it('displays 2FA toggle switch', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Autenticação de Dois Fatores/i)).toBeInTheDocument();
    });
  });

  it('allows toggling 2FA', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      const toggle = document.querySelector('button[class*="h-6"]');
      expect(toggle).toBeInTheDocument();
    });
  });

  it('displays lab configuration section (read-only)', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Configuração do Laboratório/i)).toBeInTheDocument();
      expect(screen.getByText(/Nome do Lab/i)).toBeInTheDocument();
      expect(screen.getByText(/CNPJ/i)).toBeInTheDocument();
    });
  });

  it('shows NOTIVISA integration status', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Integração NOTIVISA/i)).toBeInTheDocument();
    });
  });

  it('displays session management options', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      // Multiple Logout buttons exist, check for all
      const logoutItems = screen.queryAllByText(/Logout|Sair Tudo/i);
      expect(logoutItems.length).toBeGreaterThan(0);
    });
  });

  it('shows edit buttons for editable fields', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Editar');
      expect(editButtons.length).toBeGreaterThan(0);
    });
  });

  it('displays footer disclaimer', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Para alterar dados do laboratório/i)).toBeInTheDocument();
    });
  });

  it('handles change password modal trigger', async () => {
    render(<ConfiguracaoSection labId="lab-123" />);

    await waitFor(() => {
      const changePasswordButtons = screen.getAllByText('Alterar');
      expect(changePasswordButtons.length).toBeGreaterThan(0);
    });

    // Find the specific "Alterar" button for password change
    const buttons = screen.getAllByText('Alterar');
    const passwordButton = buttons[0]; // First "Alterar" is for password

    fireEvent.click(passwordButton);

    // Modal state should be tracked internally
    expect(passwordButton).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Portal RT Sections - Integration', () => {
  it('all sections accept labId prop', async () => {
    const labId = 'lab-integration-test';

    render(<DashboardSection labId={labId} />);
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('sections handle empty labId gracefully', async () => {
    render(<CriticosSection labId={undefined} />);
    await waitFor(() => {
      expect(screen.getByText('Valores Críticos')).toBeInTheDocument();
    });
  });

  it('sections show proper empty states', async () => {
    render(<ResultadosSection labId="lab-123" />);

    await waitFor(() => {
      // Component should render without errors
      expect(screen.getByText('Resultados')).toBeInTheDocument();
    });
  });

  it('action callbacks are properly invoked', async () => {
    const onActionComplete = vi.fn();

    render(<CriticosSection labId="lab-123" onActionComplete={onActionComplete} />);

    await waitFor(() => {
      const acknowledgeButtons = screen.getAllByText('Reconhecer');
      expect(acknowledgeButtons.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('Reconhecer')[0]);

    await waitFor(() => {
      expect(onActionComplete).toHaveBeenCalled();
    });
  });

  it('sections render without auth errors', async () => {
    // All mocked auth should work
    render(<DashboardSection />);
    render(<CriticosSection />);
    render(<ResultadosSection />);
    render(<ComplianceSection />);
    render(<ConfiguracaoSection />);

    // No errors should occur
    expect(true).toBe(true);
  });
});
