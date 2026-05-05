/**
 * Tests for ScheduledExportConfig component.
 *
 * Covers:
 * - Toggle renders with correct ARIA attributes
 * - Toggle click updates enabled state
 * - Format selector is visible when enabled is true
 * - "Salvar configuração" button is disabled when isSaving is true
 * - "Configuração salva com sucesso." appears when isSaved is true
 * - Email input is rendered
 * - Save button calls saveConfig on click
 *
 * Firebase mocked via vi.mock — no real Firestore calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mock hook so component renders predictably ────────────────────────────────

const mockUpdateConfig = vi.fn();
const mockSaveConfig = vi.fn().mockResolvedValue(undefined);

// Default hook state — overridden per test by reassigning mockHookReturn
let mockHookReturn = {
  config: {
    enabled: false,
    frequency: 'weekly' as const,
    formats: [] as string[],
    emailRecipient: '',
  },
  updateConfig: mockUpdateConfig,
  saveConfig: mockSaveConfig,
  isSaving: false,
  saveError: null as string | null,
  isSaved: false,
  lastRunAt: null as Date | null,
  isLoading: false,
};

vi.mock('../hooks/useScheduledExport', () => ({
  useScheduledExport: () => mockHookReturn,
}));

// Import component after mock
import { ScheduledExportConfig } from '../components/ScheduledExportConfig';

const LAB_ID = 'lab-test-scheduled';

describe('ScheduledExportConfig', () => {
  beforeEach(() => {
    mockUpdateConfig.mockClear();
    mockSaveConfig.mockClear();

    // Reset to default state
    mockHookReturn = {
      config: {
        enabled: false,
        frequency: 'weekly',
        formats: [],
        emailRecipient: '',
      },
      updateConfig: mockUpdateConfig,
      saveConfig: mockSaveConfig,
      isSaving: false,
      saveError: null,
      isSaved: false,
      lastRunAt: null,
      isLoading: false,
    };
  });

  // ── Toggle ────────────────────────────────────────────────────────────────

  describe('enable toggle', () => {
    it('renders the toggle button with role="switch"', () => {
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeDefined();
    });

    it('toggle has aria-checked="false" when config.enabled is false', () => {
      mockHookReturn.config.enabled = false;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const toggle = screen.getByRole('switch') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('toggle has aria-checked="true" when config.enabled is true', () => {
      mockHookReturn.config.enabled = true;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const toggle = screen.getByRole('switch') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('clicking the toggle calls updateConfig with toggled enabled value', () => {
      mockHookReturn.config.enabled = false;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      fireEvent.click(screen.getByRole('switch'));

      expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
      expect(mockUpdateConfig).toHaveBeenCalledWith({ enabled: true });
    });

    it('clicking toggle when enabled=true calls updateConfig with enabled=false', () => {
      mockHookReturn.config.enabled = true;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      fireEvent.click(screen.getByRole('switch'));

      expect(mockUpdateConfig).toHaveBeenCalledWith({ enabled: false });
    });
  });

  // ── Format selection visibility ───────────────────────────────────────────

  describe('format selector', () => {
    it('renders BatchFormatSelector regardless of enabled state', () => {
      mockHookReturn.config.enabled = false;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      // Format selector always renders — it's needed for both enabled and disabled states
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    });

    it('renders all 4 format checkboxes when enabled is true', () => {
      mockHookReturn.config.enabled = true;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(4);
    });

    it('renders all 4 format checkboxes when enabled is false', () => {
      mockHookReturn.config.enabled = false;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(4);
    });
  });

  // ── Save button state ─────────────────────────────────────────────────────

  describe('save button', () => {
    it('renders the save button', () => {
      mockHookReturn.config.formats = ['xlsx-ciq'];
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const btn = screen.getByRole('button', { name: /salvar configuração/i });
      expect(btn).toBeDefined();
    });

    it('save button is disabled when isSaving is true', () => {
      mockHookReturn.isSaving = true;
      mockHookReturn.config.formats = ['xlsx-ciq'];
      render(<ScheduledExportConfig labId={LAB_ID} />);

      // When isSaving=true, button text changes and canSave=false
      const btn = screen.getByRole('button', { name: /salvando.../i });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows "Salvando..." text when isSaving is true', () => {
      mockHookReturn.isSaving = true;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.getByText(/salvando\.\.\./i)).toBeDefined();
    });

    it('save button is disabled when no formats are selected', () => {
      mockHookReturn.config.formats = [];
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const btn = screen.getByRole('button', { name: /salvar configuração/i });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it('save button calls saveConfig when clicked', () => {
      // canSave requires formats.length > 0
      mockHookReturn.config.formats = ['xlsx-ciq'];
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const btn = screen.getByRole('button', { name: /salvar configuração/i });
      fireEvent.click(btn);

      expect(mockSaveConfig).toHaveBeenCalledTimes(1);
    });
  });

  // ── isSaved indicator ─────────────────────────────────────────────────────

  describe('isSaved indicator', () => {
    it('shows success message when isSaved is true', () => {
      mockHookReturn.isSaved = true;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.getByText(/configuração salva com sucesso/i)).toBeDefined();
    });

    it('does not show success message when isSaved is false', () => {
      mockHookReturn.isSaved = false;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.queryByText(/configuração salva com sucesso/i)).toBeNull();
    });

    it('does not show success message when isSaved and isSaving are both true', () => {
      // isSaving takes precedence — canSave is false but more importantly the
      // condition is `isSaved && !isSaving && !saveError`
      mockHookReturn.isSaved = true;
      mockHookReturn.isSaving = true;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.queryByText(/configuração salva com sucesso/i)).toBeNull();
    });
  });

  // ── Error display ─────────────────────────────────────────────────────────

  describe('error display', () => {
    it('shows saveError message when saveError is set', () => {
      mockHookReturn.saveError = 'Falha ao salvar configuração.';
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.getByText(/falha ao salvar configuração/i)).toBeDefined();
    });

    it('does not show error when saveError is null', () => {
      mockHookReturn.saveError = null;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.queryByText(/falha ao salvar/i)).toBeNull();
    });
  });

  // ── Email input ───────────────────────────────────────────────────────────

  describe('email input', () => {
    it('renders the email input', () => {
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const emailInput = screen.getByRole('textbox', { name: /email de entrega/i });
      expect(emailInput).toBeDefined();
    });

    it('email input has type="email"', () => {
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const emailInput = screen.getByRole('textbox') as HTMLInputElement;
      expect(emailInput.type).toBe('email');
    });

    it('email input calls updateConfig with new value on change', () => {
      render(<ScheduledExportConfig labId={LAB_ID} />);

      const emailInput = screen.getByRole('textbox');
      fireEvent.change(emailInput, { target: { value: 'new@lab.com' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith({ emailRecipient: 'new@lab.com' });
    });

    it('shows required asterisk next to email label when enabled is true', () => {
      mockHookReturn.config.enabled = true;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      // The asterisk span is present when enabled
      expect(screen.getByText('*')).toBeDefined();
    });

    it('does not show required asterisk when enabled is false', () => {
      mockHookReturn.config.enabled = false;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.queryByText('*')).toBeNull();
    });
  });

  // ── Last run display ──────────────────────────────────────────────────────

  describe('last run display', () => {
    it('does not show last run section when lastRunAt is null', () => {
      mockHookReturn.lastRunAt = null;
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.queryByText(/última execução/i)).toBeNull();
    });

    it('shows last run info when lastRunAt is a Date', () => {
      mockHookReturn.lastRunAt = new Date('2026-04-28T02:00:00Z');
      render(<ScheduledExportConfig labId={LAB_ID} />);

      expect(screen.getByText(/última execução/i)).toBeDefined();
    });
  });
});
