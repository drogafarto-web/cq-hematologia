/**
 * Tests for BatchFormatSelector component.
 *
 * Covers:
 * - Renders all 4 available format options
 * - Clicking a format card calls onToggle with the correct format id
 * - Selected formats render checkboxes as checked
 * - Unselected formats render checkboxes as unchecked
 * - Summary bar shows correct count text
 * - Alert shown when no formats selected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchFormatSelector } from '../components/BatchFormatSelector';
import type { BatchExportFormat } from '../components/BatchFormatSelector';

describe('BatchFormatSelector', () => {
  const onToggle = vi.fn();

  beforeEach(() => {
    onToggle.mockClear();
  });

  // ── Renders all format options ─────────────────────────────────────────────

  describe('rendering', () => {
    it('renders all 4 format option labels', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      expect(screen.getByText(/XLSX — Corridas CIQ/i)).toBeDefined();
      expect(screen.getByText(/XLSX — Registro de NCs/i)).toBeDefined();
      expect(screen.getByText(/PDF — Relatório de Conformidade/i)).toBeDefined();
      expect(screen.getByText(/CSV — Log de Auditoria/i)).toBeDefined();
    });

    it('renders 4 checkboxes', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(4);
    });

    it('renders extension badges for each format', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      // Two .xlsx extensions (CIQ + NC) + one .pdf + one .csv
      const xlsxBadges = screen.getAllByText('.xlsx');
      expect(xlsxBadges).toHaveLength(2);
      expect(screen.getByText('.pdf')).toBeDefined();
      expect(screen.getByText('.csv')).toBeDefined();
    });

    it('renders the fieldset with accessible legend', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      expect(screen.getByText(/selecione os formatos para exportação em lote/i)).toBeDefined();
    });
  });

  // ── Checkbox checked state ─────────────────────────────────────────────────

  describe('checkbox checked state reflects selectedFormats', () => {
    it('all checkboxes are unchecked when selectedFormats is empty', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      checkboxes.forEach((cb) => {
        expect(cb.checked).toBe(false);
      });
    });

    it('only the selected format checkbox is checked', () => {
      const selected: Set<BatchExportFormat> = new Set(['xlsx-ciq']);

      render(<BatchFormatSelector selectedFormats={selected} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      const checkedBoxes = checkboxes.filter((cb) => cb.checked);
      expect(checkedBoxes).toHaveLength(1);
    });

    it('multiple selected formats have multiple checkboxes checked', () => {
      const selected: Set<BatchExportFormat> = new Set(['xlsx-ciq', 'pdf-compliance', 'csv-audit']);

      render(<BatchFormatSelector selectedFormats={selected} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      const checkedBoxes = checkboxes.filter((cb) => cb.checked);
      expect(checkedBoxes).toHaveLength(3);
    });
  });

  // ── Click interaction calls onToggle ───────────────────────────────────────

  describe('click interaction', () => {
    it('clicking a format label calls onToggle with the correct format id', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      // Click the checkbox directly
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[0]); // xlsx-ciq is first

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith('xlsx-ciq');
    });

    it('clicking CSV format calls onToggle with csv-audit', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      // csv-audit is the 4th option (index 3)
      fireEvent.click(checkboxes[3]);

      expect(onToggle).toHaveBeenCalledWith('csv-audit');
    });

    it('clicking xlsx-nc format calls onToggle with xlsx-nc', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[1]);

      expect(onToggle).toHaveBeenCalledWith('xlsx-nc');
    });

    it('clicking pdf format calls onToggle with pdf-compliance', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[2]);

      expect(onToggle).toHaveBeenCalledWith('pdf-compliance');
    });
  });

  // ── Summary bar ───────────────────────────────────────────────────────────

  describe('summary bar', () => {
    it('shows validation alert when no format is selected', () => {
      render(<BatchFormatSelector selectedFormats={new Set()} onToggle={onToggle} />);

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/selecione pelo menos 1 formato/i)).toBeDefined();
    });

    it('shows "1 arquivo será gerado" when exactly 1 format is selected', () => {
      render(
        <BatchFormatSelector
          selectedFormats={new Set(['xlsx-ciq'] as BatchExportFormat[])}
          onToggle={onToggle}
        />,
      );

      // The summary text is in a single <p> — match the full phrase
      expect(screen.getByText(/arquivo será gerado\./i)).toBeDefined();
    });

    it('shows "3 arquivos serão gerados" when 3 formats are selected', () => {
      const selected: Set<BatchExportFormat> = new Set(['xlsx-ciq', 'xlsx-nc', 'pdf-compliance']);

      render(<BatchFormatSelector selectedFormats={selected} onToggle={onToggle} />);

      expect(screen.getByText(/3/)).toBeDefined();
      expect(screen.getByText(/arquivos serão gerados/i)).toBeDefined();
    });

    it('does not show alert when formats are selected', () => {
      render(
        <BatchFormatSelector
          selectedFormats={new Set(['xlsx-ciq'] as BatchExportFormat[])}
          onToggle={onToggle}
        />,
      );

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
