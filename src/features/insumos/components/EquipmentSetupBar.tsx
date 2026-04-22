/**
 * EquipmentSetupBar — banner fino, persistente, no topo das telas de corrida.
 *
 * Mostra o setup atual do equipamento para o módulo dado:
 *   🧪 Reagente: Hemocell WBC Diff · Lote 12345 · OK
 *   🧫 Controle: Multiqual N2 · Lote 98765 · vence em 12d
 *   📊 23 corridas usando este setup · aberto há 4 dias
 *
 * O operador vê o tempo todo com o quê está trabalhando. O auditor lê em
 * 2 segundos. Design: minimalista, contrastado, mas não ruidoso — passa
 * a sensação de "controle" sem competir com o conteúdo principal.
 *
 * Uso: colocar logo abaixo do header de cada tela de corrida (AnalyzerView,
 * CoagulacaoView, UroanaliseView, CIQImunoView). Props mínimas — o módulo
 * define o que consultar.
 */

import React from 'react';
import { useEquipmentSetup } from '../hooks/useEquipmentSetup';
import { useInsumos } from '../hooks/useInsumos';
import { DEFAULT_EQUIPAMENTO_POR_MODULO } from '../../../constants';
import { validadeStatus, diasAteVencer } from '../utils/validadeReal';
import { hasQCValidationPending } from '../types/Insumo';
import type { Insumo, InsumoModulo } from '../types/Insumo';

interface EquipmentSetupBarProps {
  module: InsumoModulo;
  /** Opcional — navega ao clicar em "Configurar". Se ausente, esconde a ação. */
  onEditSetup?: () => void;
}

function openingDaysAgo(insumo: Insumo | null): number | null {
  if (!insumo?.dataAbertura) return null;
  const ms = Date.now() - insumo.dataAbertura.toDate().getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function slotStatus(
  i: Insumo | null,
): { label: string; cls: string } | null {
  if (!i) return null;
  const v = validadeStatus(i.validadeReal.toDate());
  if (v === 'expired') {
    return {
      label: 'VENCIDO',
      cls: 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300',
    };
  }
  if (hasQCValidationPending(i)) {
    return {
      label: 'CQ pendente',
      cls: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300',
    };
  }
  if (v === 'warning') {
    return {
      label: `${diasAteVencer(i.validadeReal.toDate())}d`,
      cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    };
  }
  return {
    label: 'OK',
    cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
  };
}

function SlotChip({
  icon,
  label,
  insumo,
}: {
  icon: string;
  label: string;
  insumo: Insumo | null;
}) {
  const status = slotStatus(insumo);
  if (!insumo) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40">
        <span className="text-sm" aria-hidden>
          {icon}
        </span>
        <span className="font-medium text-slate-400 dark:text-white/30">
          {label}: não configurado
        </span>
      </span>
    );
  }

  const runCount = insumo.runCount ?? 0;
  const openDays = openingDaysAgo(insumo);

  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-sm" aria-hidden>
        {icon}
      </span>
      <span className="text-slate-500 dark:text-white/40">{label}:</span>
      <span className="font-medium text-slate-900 dark:text-white/90">
        {insumo.nomeComercial}
      </span>
      <span className="text-slate-400 dark:text-white/30">· Lote {insumo.lote}</span>
      {runCount > 0 && (
        <span className="text-slate-400 dark:text-white/30">
          · {runCount} corridas
        </span>
      )}
      {openDays !== null && (
        <span className="text-slate-400 dark:text-white/30">
          · aberto há {openDays}d
        </span>
      )}
      {status && (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${status.cls}`}
        >
          {status.label}
        </span>
      )}
    </span>
  );
}

export function EquipmentSetupBar({ module, onEditSetup }: EquipmentSetupBarProps) {
  const { setup } = useEquipmentSetup(module);
  const { insumos } = useInsumos({ status: 'ativo' });

  const byId = new Map(insumos.map((i) => [i.id, i]));
  const reagente = setup?.activeReagenteId ? byId.get(setup.activeReagenteId) ?? null : null;
  const controle = setup?.activeControleId ? byId.get(setup.activeControleId) ?? null : null;
  const tira = setup?.activeTiraUroId ? byId.get(setup.activeTiraUroId) ?? null : null;

  const equipamentoName =
    setup?.equipamentoName ?? DEFAULT_EQUIPAMENTO_POR_MODULO[module]?.name ?? module;

  const isUnconfigured = !reagente && !controle && !tira;

  return (
    <div
      role="status"
      aria-label="Setup atual do equipamento"
      className={`sticky top-0 z-10 border-b ${
        isUnconfigured
          ? 'bg-amber-500/[0.06] border-amber-500/25'
          : 'bg-slate-50/80 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06]'
      } backdrop-blur-md`}
    >
      <div className="max-w-[1400px] mx-auto px-5 py-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 shrink-0">
          Setup do {equipamentoName}
        </span>

        {isUnconfigured ? (
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Nenhum insumo ativo configurado — corridas ainda dependem de seleção manual.
          </span>
        ) : (
          <>
            <SlotChip icon="🧪" label="Reagente" insumo={reagente} />
            <SlotChip icon="🧫" label="Controle" insumo={controle} />
            {module === 'uroanalise' && <SlotChip icon="🧻" label="Tira" insumo={tira} />}
          </>
        )}

        <span className="flex-1" />

        {onEditSetup && (
          <button
            type="button"
            onClick={onEditSetup}
            className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline shrink-0"
          >
            Configurar →
          </button>
        )}
      </div>
    </div>
  );
}
