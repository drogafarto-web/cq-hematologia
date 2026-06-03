/**
 * FilterBar component tests
 *
 * Verifies dropdowns render, "Limpar filtros" appears when a filter is active,
 * and active filter badges display correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '../../../src/features/analytics/components/FilterBar';
import type { EquipmentFilterState } from '../../../src/features/analytics/hooks/useEquipmentFilter';
import type { OperatorFilterState } from '../../../src/features/analytics/hooks/useOperatorFilter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEquipmentFilter(overrides?: Partial<EquipmentFilterState>): EquipmentFilterState {
  return {
    equipment: [
      { id: 'eq1', name: 'Yumizen H550', modelo: 'YUMIZEN_H550' },
      { id: 'eq2', name: 'Micros 60', modelo: 'MICROS_60' },
    ],
    selectedIds: new Set(),
    toggleEquipment: vi.fn(),
    clearEquipment: vi.fn(),
    isFiltering: false,
    isLoading: false,
    ...overrides,
  };
}

function makeOperatorFilter(overrides?: Partial<OperatorFilterState>): OperatorFilterState {
  return {
    operators: [
      { id: 'op1', name: 'Ana Lima' },
      { id: 'op2', name: 'Bruno Silva' },
    ],
    selectedIds: new Set(),
    toggleOperator: vi.fn(),
    clearOperator: vi.fn(),
    isFiltering: false,
    isLoading: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FilterBar', () => {
  it('renders equipment and operator dropdowns', () => {
    render(<FilterBar equipment={makeEquipmentFilter()} operators={makeOperatorFilter()} />);

    expect(screen.getByLabelText('Equipamento')).toBeInTheDocument();
    expect(screen.getByLabelText('Operador')).toBeInTheDocument();
  });

  it('does NOT show "Limpar filtros" when no filter is active', () => {
    render(<FilterBar equipment={makeEquipmentFilter()} operators={makeOperatorFilter()} />);

    expect(screen.queryByText('Limpar filtros')).not.toBeInTheDocument();
  });

  it('shows "Limpar filtros" when equipment filter is active', () => {
    render(
      <FilterBar
        equipment={makeEquipmentFilter({ isFiltering: true, selectedIds: new Set(['eq1']) })}
        operators={makeOperatorFilter()}
      />,
    );

    expect(screen.getByText('Limpar filtros')).toBeInTheDocument();
  });

  it('shows "Limpar filtros" when operator filter is active', () => {
    render(
      <FilterBar
        equipment={makeEquipmentFilter()}
        operators={makeOperatorFilter({ isFiltering: true, selectedIds: new Set(['op1']) })}
      />,
    );

    expect(screen.getByText('Limpar filtros')).toBeInTheDocument();
  });

  it('calls clearEquipment and clearOperator when "Limpar filtros" is clicked', () => {
    const clearEquipment = vi.fn();
    const clearOperator = vi.fn();

    render(
      <FilterBar
        equipment={makeEquipmentFilter({
          isFiltering: true,
          selectedIds: new Set(['eq1']),
          clearEquipment,
        })}
        operators={makeOperatorFilter({ clearOperator })}
      />,
    );

    fireEvent.click(screen.getByText('Limpar filtros'));
    expect(clearEquipment).toHaveBeenCalledOnce();
    expect(clearOperator).toHaveBeenCalledOnce();
  });

  it('renders equipment options in the dropdown', () => {
    render(<FilterBar equipment={makeEquipmentFilter()} operators={makeOperatorFilter()} />);

    const select = screen.getByLabelText('Equipamento') as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.text);
    expect(optionTexts).toContain('Yumizen H550');
    expect(optionTexts).toContain('Micros 60');
  });

  it('renders operator options in the dropdown', () => {
    render(<FilterBar equipment={makeEquipmentFilter()} operators={makeOperatorFilter()} />);

    const select = screen.getByLabelText('Operador') as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.text);
    expect(optionTexts).toContain('Ana Lima');
    expect(optionTexts).toContain('Bruno Silva');
  });

  it('shows active badge for selected equipment', () => {
    render(
      <FilterBar
        equipment={makeEquipmentFilter({
          isFiltering: true,
          selectedIds: new Set(['eq1']),
        })}
        operators={makeOperatorFilter()}
      />,
    );

    expect(screen.getByText('Yumizen H550')).toBeInTheDocument();
  });

  it('toggles equipment when badge remove button is clicked', () => {
    const toggleEquipment = vi.fn();
    render(
      <FilterBar
        equipment={makeEquipmentFilter({
          isFiltering: true,
          selectedIds: new Set(['eq1']),
          toggleEquipment,
        })}
        operators={makeOperatorFilter()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remover filtro: Yumizen H550'));
    expect(toggleEquipment).toHaveBeenCalledWith('eq1');
  });
});
