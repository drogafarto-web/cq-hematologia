/**
 * Unit tests for DateRangePickerBar component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePickerBar } from '../../../../src/features/analytics/components/DateRangePickerBar';
import type { DateRangeFilterState } from '../../../../src/features/analytics/hooks/useDateRangeFilter';

function makeProps(preset = '30d' as DateRangeFilterState['range']['preset']): {
  range: DateRangeFilterState['range'];
  setPreset: ReturnType<typeof vi.fn>;
  setCustomRange: ReturnType<typeof vi.fn>;
} {
  return {
    range: {
      preset,
      start: new Date('2026-04-05'),
      end: new Date('2026-05-05'),
    },
    setPreset: vi.fn(),
    setCustomRange: vi.fn(),
  };
}

describe('DateRangePickerBar', () => {
  it('renders all 3 preset chips by aria-label', () => {
    const props = makeProps();
    render(<DateRangePickerBar {...props} />);
    expect(screen.getByRole('button', { name: 'Últimos 30 dias' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Últimos 90 dias' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Último ano' })).toBeDefined();
  });

  it('renders Personalizado chip', () => {
    const props = makeProps();
    render(<DateRangePickerBar {...props} />);
    expect(screen.getByRole('button', { name: 'Período personalizado' })).toBeDefined();
  });

  it('active preset chip (90d) has aria-pressed=true', () => {
    const props = makeProps('90d');
    render(<DateRangePickerBar {...props} />);
    const chip90 = screen.getByRole('button', { name: 'Últimos 90 dias' });
    expect(chip90.getAttribute('aria-pressed')).toBe('true');
  });

  it('inactive preset chips have aria-pressed=false', () => {
    const props = makeProps('30d');
    render(<DateRangePickerBar {...props} />);
    const chip90 = screen.getByRole('button', { name: 'Últimos 90 dias' });
    expect(chip90.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking 90d chip calls setPreset("90d")', () => {
    const props = makeProps();
    render(<DateRangePickerBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 90 dias' }));
    expect(props.setPreset).toHaveBeenCalledWith('90d');
  });

  it('clicking Personalizado chip shows date inputs', () => {
    const props = makeProps();
    render(<DateRangePickerBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Período personalizado' }));
    // After clicking, custom inputs should appear
    expect(screen.getByRole('group', { name: 'Filtro de período' })).toBeDefined();
    // Find date inputs
    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('date inputs are visible when preset is custom', () => {
    const props = makeProps('custom');
    render(<DateRangePickerBar {...props} />);
    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('changing start date input calls setCustomRange', () => {
    const props = makeProps('custom');
    const { container } = render(<DateRangePickerBar {...props} />);
    // Date inputs have role "textbox" in some JSDOM versions but not in others;
    // query by attribute to be reliable.
    const dateInputs = container.querySelectorAll(
      'input[type="date"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(dateInputs.length).toBe(2);
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-01' } });
    expect(props.setCustomRange).toHaveBeenCalled();
    const [calledStart] = props.setCustomRange.mock.calls[0] as [Date, Date];
    expect(calledStart).toBeInstanceOf(Date);
  });

  it('has accessible group role and label', () => {
    const props = makeProps();
    render(<DateRangePickerBar {...props} />);
    const group = screen.getByRole('group', { name: 'Filtro de período' });
    expect(group).toBeDefined();
  });
});
