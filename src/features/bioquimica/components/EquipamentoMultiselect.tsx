/**
 * EquipamentoMultiselect — dark-first multi-select for equipment
 *
 * Features:
 * - Filters active equipamentos for bioquímica module
 * - Shows disabled state if equipment already has active lot
 * - Chips with remove button
 * - Keyboard navigation AA
 * - Empty state message
 */

import React, { useState, useRef, useId } from 'react';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useLotesEmUso } from '../hooks/useLotes';
import type { Equipamento } from '../../equipamentos/types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2 2l8 8M10 2L2 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2 6l3 3 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1L13 13H1L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7 6v2M7 10v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EquipamentoMultiselectProps {
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

export function EquipamentoMultiselect({
  selectedIds,
  onChange,
  disabled = false,
}: EquipamentoMultiselectProps) {
  const { equipamentos, loading } = useEquipamentos();
  const lotesEmUso = useLotesEmUso();
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Equipment currently in use (has an active lot)
  const equipmentosEmUso = new Set(
    lotesEmUso
      .flatMap((lot) => lot.equipmentIds)
      .filter((id) => !selectedIds.includes(id)), // Don't disable if already selected
  );

  // Toggle selection
  const handleSelect = (equipId: string) => {
    onChange(
      selectedIds.includes(equipId)
        ? selectedIds.filter((id) => id !== equipId)
        : [...selectedIds, equipId],
    );
  };

  // Remove chip
  const handleRemove = (e: React.MouseEvent, equipId: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== equipId));
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(!open);
    }
  };

  const selectedEquipos = equipamentos.filter((e) => selectedIds.includes(e.id));
  const isDisabled = disabled || loading;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
        Equipamentos
        <span className="text-red-400/70 ml-0.5">*</span>
      </label>

      <div className="relative">
        {/* Trigger button */}
        <button
          ref={triggerRef}
          id={inputId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen(!open)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-sm
            transition-all flex items-center justify-between gap-2
            ${
              isDisabled
                ? 'bg-white/[0.03] border-white/[0.05] text-white/30 cursor-not-allowed'
                : 'bg-white/[0.06] border-white/[0.09] text-white/90 hover:bg-white/[0.08] focus:outline-none focus:border-violet-500/50'
            }
          `}
        >
          <span className={selectedIds.length === 0 ? 'text-white/30' : ''}>
            {selectedIds.length === 0
              ? 'Selecionar equipamentos...'
              : `${selectedIds.length} selecionado${selectedIds.length !== 1 ? 's' : ''}`}
          </span>
          <ChevronDownIcon />
        </button>

        {/* Dropdown menu */}
        {open && !isDisabled && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute top-full mt-1 w-full z-50 bg-white/[0.08] border border-white/[0.09] rounded-xl shadow-lg backdrop-blur-sm max-h-64 overflow-y-auto"
          >
            {equipamentos.length === 0 ? (
              <div className="px-3.5 py-6 text-center text-xs text-white/40">
                <p className="mb-1">Nenhum equipamento cadastrado</p>
                <p className="text-[11px]">Cadastre primeiro em /equipamentos</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {equipamentos.map((equip) => {
                  const isSelected = selectedIds.includes(equip.id);
                  const isBusy = equipmentosEmUso.has(equip.id);
                  const isClickable = !isBusy;

                  return (
                    <li key={equip.id}>
                      <button
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => isClickable && handleSelect(equip.id)}
                        disabled={isBusy}
                        className={`w-full px-3.5 py-3 text-left text-sm flex items-center gap-3
                          transition-colors
                          ${
                            isBusy
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-white/[0.05] active:bg-white/[0.08]'
                          }
                        `}
                        title={
                          isBusy
                            ? `${equip.name} já possui um lote ativo`
                            : undefined
                        }
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                            transition-colors
                            ${
                              isSelected
                                ? 'bg-violet-500 border-violet-500'
                                : 'border-white/20'
                            }
                          `}
                        >
                          {isSelected && (
                            <span className="text-white text-[10px]">
                              <CheckIcon />
                            </span>
                          )}
                        </div>

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white/90 truncate">{equip.name}</p>
                          <p className="text-[11px] text-white/40 truncate">
                            {equip.modelo}
                          </p>
                        </div>

                        {/* Busy badge */}
                        {isBusy && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                            <AlertIcon />
                            Em uso
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEquipos.map((equip) => (
            <div
              key={equip.id}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                bg-violet-500/20 border border-violet-500/30 text-violet-200 text-sm"
            >
              <span>{equip.name}</span>
              <button
                onClick={(e) => handleRemove(e, equip.id)}
                className="inline-flex items-center justify-center text-violet-300 hover:text-violet-100
                  transition-colors p-0.5 -mr-1"
                aria-label={`Remover ${equip.name}`}
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      {selectedIds.length === 0 && (
        <p className="text-xs text-white/25 ml-0.5">
          Selecione pelo menos um equipamento
        </p>
      )}
    </div>
  );
}
