/**
 * EquipamentoSelector — dropdown para escolher o equipamento em que a corrida
 * está sendo feita. Usado dentro dos forms de Nova Corrida (Coag/Uro/Imuno/Analyzer).
 *
 * Fase D (2026-04-21 — 2º turno).
 *
 * Comportamento:
 *   - Lista apenas equipamentos `ativos` do módulo. Manutenção/aposentados são ocultados.
 *   - Se houver 1 só equipamento, pré-seleciona silenciosamente e exibe como readonly.
 *   - Se zero equipamentos, mostra prompt pra cadastrar.
 *   - Se ≥2, dropdown obrigatório.
 *   - Chama `onChange(id, modelo)` com ID + modelo pro caller (passa pro useInsumoFlowGuard
 *     e pro save do run, onde modelo alimenta `statsPorModelo`).
 */

import React, { useEffect } from 'react';
import { useEquipamentos } from '../hooks/useEquipamentos';
import type { Equipamento } from '../types/Equipamento';
import type { InsumoModulo } from '../../insumos/types/Insumo';

interface EquipamentoSelectorProps {
  module: InsumoModulo;
  value: string | null;
  onChange: (equipamentoId: string | null, equipamento: Equipamento | null) => void;
  /** Quando `true`, exibe prompt severo se lista vazia. */
  required?: boolean;
}

export function EquipamentoSelector({
  module,
  value,
  onChange,
  required,
}: EquipamentoSelectorProps) {
  const { equipamentos, isLoading } = useEquipamentos({ module, status: 'ativo' });

  // Auto-seleciona quando há um único equipamento ativo.
  useEffect(() => {
    if (!value && equipamentos.length === 1) {
      onChange(equipamentos[0].id, equipamentos[0]);
    }
    // Se o value aponta pra um equipamento que sumiu (ex: aposentado), limpa.
    if (value && equipamentos.length > 0 && !equipamentos.some((e) => e.id === value)) {
      onChange(null, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipamentos, value]);

  if (isLoading) {
    return (
      <div className="rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] p-3 text-xs text-slate-500 dark:text-white/40">
        Carregando equipamentos…
      </div>
    );
  }

  if (equipamentos.length === 0) {
    return (
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5">
        <p className="text-[12px] font-medium text-amber-700 dark:text-amber-300">
          Nenhum equipamento cadastrado neste módulo.
        </p>
        <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
          Cadastre pelo menos um equipamento em <strong>Insumos &amp; Equipamentos</strong> antes
          de registrar corridas.
        </p>
      </div>
    );
  }

  if (equipamentos.length === 1) {
    const only = equipamentos[0];
    return (
      <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 p-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40">
          Equipamento
        </p>
        <p className="text-sm font-medium text-slate-900 dark:text-white/85 mt-0.5">
          {only.name}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-white/45">
          {only.fabricante} · {only.modelo}
          {only.numeroSerie && ` · Nº ${only.numeroSerie}`}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="equipamento-select"
        className="block text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-1.5"
      >
        Equipamento{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        id="equipamento-select"
        value={value ?? ''}
        onChange={(e) => {
          const id = e.target.value || null;
          const eq = id ? equipamentos.find((x) => x.id === id) ?? null : null;
          onChange(id, eq);
        }}
        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-sm text-slate-900 dark:text-white/90 focus:outline-none focus:border-violet-500/50"
      >
        <option value="">— Selecione o equipamento —</option>
        {equipamentos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {e.modelo}
            {e.numeroSerie && ` (${e.numeroSerie})`}
          </option>
        ))}
      </select>
    </div>
  );
}
