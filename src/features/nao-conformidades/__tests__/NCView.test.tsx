/**
 * NCView.test.tsx
 *
 * Unit tests for the unified NC module entry point.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock firebase
vi.mock('../../../shared/services/firebase', () => ({
  db: {},
  functions: {},
}));

// Mock auth store
vi.mock('../../../store/useAuthStore', () => ({
  useActiveLab: () => ({ id: 'lab-test-001' }),
  useUser: () => ({ uid: 'user-001', displayName: 'Test User', email: 'test@lab.com' }),
  useActiveLabId: () => 'lab-test-001',
}));

// Mock NCList
vi.mock('../../sgq/naoConformidade/components/NCList', () => ({
  default: ({ onSelectNC }: { onSelectNC?: (nc: unknown) => void }) => (
    <div data-testid="nc-list">NCList Mock</div>
  ),
}));

// Mock CAPAHome
vi.mock('../../sgq/capa/pages/CAPAHome', () => ({
  default: () => <div data-testid="capa-home">CAPAHome Mock</div>,
}));

// Mock ReportBuilder
vi.mock('../../qualidade/components/ReportBuilder', () => ({
  ReportBuilder: ({ labId }: { labId: string }) => (
    <div data-testid="report-builder">ReportBuilder Mock - {labId}</div>
  ),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NCView from '../NCView';

describe('NCView', () => {
  it('renders the module title', () => {
    render(<NCView />);
    expect(screen.getByText('Tratamento de Não Conformidades')).toBeTruthy();
  });

  it('renders all 5 tabs', () => {
    render(<NCView />);
    expect(screen.getByText('Não Conformidades')).toBeTruthy();
    expect(screen.getByText('Investigações')).toBeTruthy();
    expect(screen.getByText('Indicadores')).toBeTruthy();
    expect(screen.getByText('Relatórios')).toBeTruthy();
    expect(screen.getByText('Configurações')).toBeTruthy();
  });

  it('shows NCList on first tab by default', () => {
    render(<NCView />);
    expect(screen.getByTestId('nc-list')).toBeTruthy();
  });

  it('switches to Indicadores tab on click', () => {
    render(<NCView />);
    fireEvent.click(screen.getByText('Indicadores'));
    expect(screen.getByText('Calculando indicadores...')).toBeTruthy();
  });

  it('switches to Configurações tab on click', () => {
    render(<NCView />);
    fireEvent.click(screen.getByText('Configurações'));
    expect(screen.getByText('Setores')).toBeTruthy();
    expect(screen.getByText('Origens')).toBeTruthy();
    expect(screen.getByText('Prazos Padrão')).toBeTruthy();
  });

  it('displays RDC 978/2025 reference', () => {
    render(<NCView />);
    expect(screen.getByText(/RDC 978\/2025/)).toBeTruthy();
  });
});
