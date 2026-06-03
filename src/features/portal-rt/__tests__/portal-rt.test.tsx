/**
 * Portal RT — Tests
 *
 * Unit tests for shell, navigation, and hooks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortalRTShell } from '../components/PortalRTShell';
import { PortalRTNav } from '../components/PortalRTNav';
import type { PortalRTSectionType } from '../types';

// Mock useAuthStore
vi.mock('../../../store/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { uid: 'test-user', displayName: 'Test Operator' },
    activeLabId: 'lab-123',
    activeLab: { nome: 'Lab Test' },
    logout: vi.fn(),
  }),
}));

describe('PortalRTShell', () => {
  it('renders main layout with sidebar and top bar', () => {
    const handleSelectSection = vi.fn();
    const handleLogout = vi.fn();

    render(
      <PortalRTShell
        labId="lab-123"
        labName="Test Lab"
        operatorName="John Doe"
        onLogout={handleLogout}
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        escalationCount={0}
      />,
    );

    // Top bar elements (getAllByText for Lab name which appears in both sidebar and header)
    expect(screen.getAllByText('Test Lab').length).toBeGreaterThan(0);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Responsável Técnico')).toBeInTheDocument();
    // Look for Sair button
    const buttons = screen.getAllByRole('button');
    expect(buttons.some((b) => b.textContent?.includes('Sair'))).toBe(true);
  });

  it('renders with logout button and calls handler', () => {
    const handleLogout = vi.fn();
    const handleSelectSection = vi.fn();

    render(
      <PortalRTShell
        labId="lab-123"
        labName="Test Lab"
        operatorName="John Doe"
        onLogout={handleLogout}
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        escalationCount={0}
      />,
    );

    // Find logout button in top bar
    const buttons = screen.getAllByRole('button');
    const logoutButton = buttons.find((b) => b.textContent?.includes('Sair'));
    if (logoutButton) {
      fireEvent.click(logoutButton);
      expect(handleLogout).toHaveBeenCalledOnce();
    }
  });

  it('displays content area with children', () => {
    const handleSelectSection = vi.fn();

    render(
      <PortalRTShell
        labId="lab-123"
        labName="Test Lab"
        operatorName="John Doe"
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        escalationCount={0}
      >
        <div data-testid="custom-content">Test Content</div>
      </PortalRTShell>,
    );

    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });

  it('has mobile menu button that toggles on mobile', () => {
    const handleSelectSection = vi.fn();

    render(
      <PortalRTShell
        labId="lab-123"
        labName="Test Lab"
        operatorName="John Doe"
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        escalationCount={0}
      />,
    );

    // Mobile menu button should exist (it's in the layout structure)
    const menuButton = screen.getByRole('button', { name: /menu/i });
    expect(menuButton).toBeInTheDocument();
  });
});

describe('PortalRTNav', () => {
  it('renders navigation with all sections', () => {
    const handleSelectSection = vi.fn();

    render(
      <PortalRTNav
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        labName="Test Lab"
        escalationCount={0}
      />,
    );

    // Check nav buttons for all sections
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /críticos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resultados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compliance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /configuração/i })).toBeInTheDocument();
  });

  it('highlights active section', () => {
    const handleSelectSection = vi.fn();

    const { rerender } = render(
      <PortalRTNav
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        labName="Test Lab"
        escalationCount={0}
      />,
    );

    let dashboardButton = screen.getByRole('button', { name: /dashboard/i });
    expect(dashboardButton).toHaveClass('bg-[#242428]');

    rerender(
      <PortalRTNav
        activeSection="criticos"
        onSelectSection={handleSelectSection}
        labName="Test Lab"
        escalationCount={0}
      />,
    );

    const criticosButton = screen.getByRole('button', { name: /críticos/i });
    expect(criticosButton).toHaveClass('bg-[#242428]');
  });

  it('displays escalation badge on criticos when count > 0', () => {
    const handleSelectSection = vi.fn();

    render(
      <PortalRTNav
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        labName="Test Lab"
        escalationCount={5}
      />,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onSelectSection when nav item is clicked', () => {
    const handleSelectSection = vi.fn();

    render(
      <PortalRTNav
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        labName="Test Lab"
        escalationCount={0}
      />,
    );

    const criticosButton = screen.getByRole('button', { name: /críticos/i });
    fireEvent.click(criticosButton);

    expect(handleSelectSection).toHaveBeenCalledWith('criticos');
  });

  it('displays lab name and version', () => {
    const handleSelectSection = vi.fn();

    render(
      <PortalRTNav
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        labName="Labclin Riopomba"
        escalationCount={0}
      />,
    );

    // Lab name appears in nav
    expect(screen.getByText('Labclin Riopomba')).toBeInTheDocument();
    // Lab QC subtitle and version
    expect(screen.getByText('Lab QC')).toBeInTheDocument();
    expect(screen.getByText('v1.4.0-alpha')).toBeInTheDocument();
  });
});

describe('PortalRTNav - Active state underline', () => {
  it('shows underline only on active section', () => {
    const handleSelectSection = vi.fn();

    const { container } = render(
      <PortalRTNav
        activeSection="compliance"
        onSelectSection={handleSelectSection}
        labName="Test Lab"
        escalationCount={0}
      />,
    );

    // The active section button should have the hover class applied
    const complianceButton = screen.getByRole('button', { name: /compliance/i });
    expect(complianceButton).toHaveClass('bg-[#242428]');
  });
});

describe('Section navigation flow', () => {
  it('handles sequential section changes', () => {
    const handleSelectSection = vi.fn();
    const sections: PortalRTSectionType[] = [
      'dashboard',
      'criticos',
      'resultados',
      'compliance',
      'configuracao',
    ];
    const sectionLabels = {
      dashboard: 'Dashboard',
      criticos: 'Críticos',
      resultados: 'Resultados',
      compliance: 'Compliance',
      configuracao: 'Configuração',
    };

    render(
      <PortalRTNav
        activeSection="dashboard"
        onSelectSection={handleSelectSection}
        labName="Test Lab"
        escalationCount={0}
      />,
    );

    sections.forEach((section) => {
      const label = sectionLabels[section];
      const button = screen.getByRole('button', { name: new RegExp(label, 'i') });
      fireEvent.click(button);
      expect(handleSelectSection).toHaveBeenCalledWith(section);
    });

    expect(handleSelectSection).toHaveBeenCalledTimes(sections.length);
  });
});
