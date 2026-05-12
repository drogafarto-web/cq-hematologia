/**
 * EquipamentosGestaoView — entrada dedicada do hub "Gestão de Equipamentos".
 *
 * Reutiliza ModuleEquipamentosPanel (mesmo fluxo da aba Equipamentos da InsumosView).
 * Catálogo / fornecedores / lotes permanecem em Insumos & Equipamentos (`insumos`).
 */

import React from 'react';
import { useActiveLab, useUserRole } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import type { InsumoModulo } from '../../insumos/types/Insumo';
import { ModuleEquipamentosPanel } from './ModuleEquipamentosPanel';

const BUTTON_GHOST = `
  px-3 h-9 rounded-lg text-xs font-medium
  text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85
  hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all
`.trim();

/** Mesmo conjunto que InsumosView — equipamentos por módulo CIQ. */
const MODULES: InsumoModulo[] = ['hematologia', 'coagulacao', 'uroanalise', 'imunologia'];

export function EquipamentosGestaoView(): React.ReactElement {
  const activeLab = useActiveLab();
  const role = useUserRole();
  const goBack = useAppStore((s) => s.goBack);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const canMutate = !!role;

  if (!activeLab) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500 dark:text-white/45">
        Nenhum laboratório ativo.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white">
      <header className="h-14 bg-white dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-4 px-6 sticky top-0 z-10">
        <button
          type="button"
          onClick={goBack}
          className={BUTTON_GHOST}
          aria-label="Voltar ao contexto anterior"
        >
          ← Voltar
        </button>
        <div className="h-5 w-px bg-slate-200 dark:bg-white/[0.08]" />
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-white/85">
            Gestão de Equipamentos
          </div>
          <div className="text-xs text-slate-500 dark:text-white/40">{activeLab.name}</div>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setCurrentView('insumos')}
          className={BUTTON_GHOST}
          title="Abrir Insumos & Equipamentos (catálogo, fornecedores, lotes)"
        >
          Insumos & Equipamentos
        </button>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-8 py-6 space-y-6">
        <p className="text-xs text-slate-500 dark:text-white/45 max-w-2xl leading-relaxed">
          Cadastro e manutenção por módulo. Para catálogo de produtos, fornecedores e todos os
          lotes, use <span className="text-slate-700 dark:text-white/65">Insumos & Equipamentos</span>.
        </p>
        <div className="space-y-6">
          {MODULES.map((m) => (
            <ModuleEquipamentosPanel
              key={m}
              labId={activeLab.id}
              module={m}
              canMutate={canMutate}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
