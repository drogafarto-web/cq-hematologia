/**
 * ConferenciaInsumoAtivo — tela de confirmação obrigatória antes de salvar
 * uma corrida. Substitui o InsumoPicker legado: o operador NÃO seleciona,
 * apenas confirma que os insumos ativos no `EquipmentSetup` estão de fato
 * em uso no equipamento.
 *
 * Fase B1 (2026-04-21):
 *   - Mostra reagente / controle / tira (conforme módulo)
 *   - Mostra status por slot (OK / vencido / CQ pendente / não configurado)
 *   - Checkbox obrigatório — sem ele o save é bloqueado
 *   - Se algum insumo requer override, o pai abre OverrideModal
 *
 * Contrato: componente é CONTROLADO. Pai gerencia `confirmed` e lê o snapshot
 * via hooks próprios no submit. Aqui só exibimos + capturamos confirmação.
 */

import React from 'react';
import { useEquipmentSetup } from '../hooks/useEquipmentSetup';
import { useInsumos } from '../hooks/useInsumos';
import { DEFAULT_EQUIPAMENTO_POR_MODULO } from '../../../constants';
import { validadeStatus, diasAteVencer } from '../utils/validadeReal';
import { evaluateInsumoUsability } from '../utils/insumoUsability';
import { insumoCobreEquipamento } from '../types/Insumo';
import type { Insumo, InsumoModulo } from '../types/Insumo';

interface ConferenciaInsumoAtivoProps {
  module: InsumoModulo;
  /**
   * Slots obrigatórios para o submit. Shape varia por módulo:
   *   - Hemato/Coag: { reagente: true, controle: true }
   *   - Uro: { tira: true, controle: lote.requerControlePorCorrida }
   *   - Imuno: { reagente: true } (sem controle por corrida)
   */
  requiredSlots: {
    reagente?: boolean;
    controle?: boolean;
    tira?: boolean;
  };
  /**
   * Fase D (2026-04-21 — 2º turno): equipamento escolhido pro run.
   * Quando fornecido, o componente lê o setup de /equipment-setups/{equipamentoId}
   * e filtra os insumos compatíveis. Quando omitido, cai no docId legado = module.
   */
  equipamentoId?: string | null;
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
  /** Callback opcional quando o pai precisa abrir o gerenciamento de setup. */
  onConfigurarSetup?: () => void;
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  children: React.ReactNode;
}) {
  const cls = {
    ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    bad: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
    neutral: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-white/40',
  }[tone];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {children}
    </span>
  );
}

function insumoBadge(insumo: Insumo | null): React.ReactNode {
  if (!insumo) return <StatusBadge tone="neutral">não configurado</StatusBadge>;
  const u = evaluateInsumoUsability(insumo);
  if (!u.ok) {
    if (u.motivo === 'vencido') return <StatusBadge tone="bad">VENCIDO</StatusBadge>;
    return <StatusBadge tone="warn">{u.motivo}</StatusBadge>;
  }
  const v = validadeStatus(insumo.validadeReal.toDate());
  if (v === 'warning') {
    return <StatusBadge tone="warn">vence em {diasAteVencer(insumo.validadeReal.toDate())}d</StatusBadge>;
  }
  return <StatusBadge tone="ok">OK</StatusBadge>;
}

function SlotLine({
  label,
  insumo,
  required,
}: {
  label: string;
  insumo: Insumo | null;
  required: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05]">
      <div className="shrink-0 w-20 text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div className="flex-1 min-w-0">
        {insumo ? (
          <>
            <p className="text-sm font-medium text-slate-900 dark:text-white/85 truncate">
              {insumo.nomeComercial}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-white/40">
              Lote {insumo.lote} · {insumo.fabricante} · vence{' '}
              {insumo.validadeReal.toDate().toLocaleDateString('pt-BR')}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400 dark:text-white/30 italic">
            {required ? 'Obrigatório — configure no Setup do equipamento' : 'Não usado'}
          </p>
        )}
      </div>
      <div className="shrink-0">{insumoBadge(insumo)}</div>
    </li>
  );
}

export function ConferenciaInsumoAtivo({
  module,
  requiredSlots,
  equipamentoId,
  confirmed,
  onConfirmedChange,
  onConfigurarSetup,
}: ConferenciaInsumoAtivoProps) {
  // Fase D: se equipamentoId fornecido, usa como docId do setup. Caso contrário
  // mantém o docId legado (= module) — comportamento pré-Fase D preservado.
  const setupDocId = equipamentoId ?? module;
  const { setup, isLoading } = useEquipmentSetup(setupDocId);
  const { insumos: allAtivos } = useInsumos({ status: 'ativo' });
  const insumos = equipamentoId
    ? allAtivos.filter((i) => insumoCobreEquipamento(i, equipamentoId))
    : allAtivos;

  const byId = new Map(insumos.map((i) => [i.id, i]));
  const reagente = setup?.activeReagenteId ? byId.get(setup.activeReagenteId) ?? null : null;
  const controle = setup?.activeControleId ? byId.get(setup.activeControleId) ?? null : null;
  const tira = setup?.activeTiraUroId ? byId.get(setup.activeTiraUroId) ?? null : null;

  const equipamento =
    setup?.equipamentoName ?? DEFAULT_EQUIPAMENTO_POR_MODULO[module]?.name ?? module;

  const slotsFaltando =
    (requiredSlots.reagente && !reagente) ||
    (requiredSlots.controle && !controle) ||
    (requiredSlots.tira && !tira);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] p-4 bg-slate-50 dark:bg-white/[0.02] text-sm text-slate-500">
        Carregando setup do equipamento…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0F1318] p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/30 font-semibold">
            Conferência obrigatória
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white/90 mt-0.5">
            Setup do {equipamento}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
            Corrida usará os insumos abaixo. Confirme antes de salvar.
          </p>
        </div>
        {onConfigurarSetup && (
          <button
            type="button"
            onClick={onConfigurarSetup}
            className="text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            Trocar insumo →
          </button>
        )}
      </div>

      <ul className="space-y-1.5 mb-3">
        {requiredSlots.reagente !== undefined && (
          <SlotLine label="Reagente" insumo={reagente} required={!!requiredSlots.reagente} />
        )}
        {requiredSlots.controle !== undefined && (
          <SlotLine label="Controle" insumo={controle} required={!!requiredSlots.controle} />
        )}
        {requiredSlots.tira !== undefined && (
          <SlotLine label="Tira" insumo={tira} required={!!requiredSlots.tira} />
        )}
      </ul>

      {slotsFaltando && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-[12px] text-red-700 dark:text-red-300">
            Há insumo obrigatório não configurado. Configure no Setup do equipamento antes de salvar.
          </p>
        </div>
      )}

      <label className="flex items-start gap-2.5 cursor-pointer select-none p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          disabled={slotsFaltando}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-white/20 text-violet-600 focus:ring-violet-500 disabled:opacity-40"
        />
        <span className="text-[13px] text-slate-700 dark:text-white/75 leading-snug">
          Confirmo que estes insumos estão em uso no equipamento neste momento.
        </span>
      </label>
    </div>
  );
}
