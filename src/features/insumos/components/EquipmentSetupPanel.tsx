/**
 * EquipmentSetupPanel — painel de Setup atual do equipamento.
 *
 * Renderiza uma linha por módulo com:
 *   - Nome do equipamento ("Yumizen H550 · Hematologia")
 *   - Reagente ativo / Controle ativo / Tira ativa (quando aplicável)
 *   - Data da última troca ("há 3 dias")
 *   - Status agregado: OK · CQ pendente · Vencido
 *   - Ação "Trocar" que abre o modal de seleção
 *
 * Posicionado no topo do InsumosView. Alimenta a intuição do operador e do
 * auditor: "o que está rodando agora" fica visível de primeira, sem clicar.
 *
 * Fase A — 2026-04-21.
 */

import React, { useMemo, useState } from 'react';
import { useActiveLab, useUser } from '../../../store/useAuthStore';
import { DEFAULT_EQUIPAMENTO_POR_MODULO } from '../../../constants';
import { useEquipmentSetup } from '../hooks/useEquipmentSetup';
import { useInsumos } from '../hooks/useInsumos';
import { setActiveInsumo } from '../services/equipmentSetupService';
import { validadeStatus, diasAteVencer } from '../utils/validadeReal';
import { hasQCValidationPending } from '../types/Insumo';
import type { Insumo, InsumoModulo } from '../types/Insumo';
import type { EquipmentSetup, EquipmentSetupSlot } from '../types/EquipmentSetup';

// ─── Module list ─────────────────────────────────────────────────────────────

const MODULES: { id: InsumoModulo; label: string }[] = [
  { id: 'hematologia', label: 'Hematologia' },
  { id: 'coagulacao', label: 'Coagulação' },
  { id: 'uroanalise', label: 'Uroanálise' },
  { id: 'imunologia', label: 'Imunologia' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(date: Date | null): string {
  if (!date) return 'nunca';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `há ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `há ${diffDay} dias`;
  return date.toLocaleDateString('pt-BR');
}

type SlotStatus = 'empty' | 'ok' | 'qc-pendente' | 'vencido';

function slotStatusOf(insumo: Insumo | null): SlotStatus {
  if (!insumo) return 'empty';
  const v = validadeStatus(insumo.validadeReal.toDate());
  if (v === 'expired') return 'vencido';
  if (hasQCValidationPending(insumo)) return 'qc-pendente';
  return 'ok';
}

/** Status agregado — pior de todos os slots. */
function aggregateStatus(items: (Insumo | null)[]): SlotStatus {
  const order: SlotStatus[] = ['vencido', 'qc-pendente', 'ok', 'empty'];
  let worst: SlotStatus = 'empty';
  for (const i of items) {
    const s = slotStatusOf(i);
    if (order.indexOf(s) < order.indexOf(worst)) worst = s;
  }
  return worst;
}

// ─── Status chip ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: SlotStatus }) {
  const map: Record<SlotStatus, { label: string; cls: string }> = {
    ok: {
      label: 'OK',
      cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    },
    'qc-pendente': {
      label: 'CQ pendente',
      cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    },
    vencido: {
      label: 'Vencido',
      cls: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
    },
    empty: {
      label: 'Sem configuração',
      cls: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-white/40',
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Slot selector modal (inline, simple) ────────────────────────────────────

interface SlotSelectorProps {
  labId: string;
  module: InsumoModulo;
  slot: EquipmentSetupSlot;
  current: Insumo | null;
  operadorId: string;
  operadorName: string;
  onClose: () => void;
}

function SlotSelector({
  labId,
  module,
  slot,
  current,
  operadorId,
  operadorName,
  onClose,
}: SlotSelectorProps) {
  // Tipo derivado do slot — reagente/controle/tira.
  const tipo =
    slot === 'activeReagenteId'
      ? ('reagente' as const)
      : slot === 'activeControleId'
        ? ('controle' as const)
        : ('tira-uro' as const);
  const { insumos } = useInsumos({ tipo, modulo: module, status: 'ativo' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string | null) {
    if (id === (current?.id ?? null)) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await setActiveInsumo(labId, {
        module,
        slot,
        newInsumoId: id,
        operadorId,
        operadorName,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao trocar insumo.');
      setSubmitting(false);
    }
  }

  const slotLabel =
    slot === 'activeReagenteId'
      ? 'Reagente'
      : slot === 'activeControleId'
        ? 'Controle'
        : 'Tira';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] shadow-2xl">
        <header className="px-5 h-14 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white/85">
              Trocar {slotLabel.toLowerCase()} ativo
            </p>
            <p className="text-[11px] text-slate-500 dark:text-white/40">
              Toda troca fica registrada no histórico
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-8 rounded-lg text-xs text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
          >
            Cancelar
          </button>
        </header>

        <div className="p-2 max-h-[50vh] overflow-y-auto">
          {error && (
            <div className="m-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {insumos.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-white/40 py-10">
              Nenhum {slotLabel.toLowerCase()} ativo cadastrado para este módulo.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {insumos.map((i) => {
                const isCurrent = current?.id === i.id;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => choose(i.id)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all ${
                        isCurrent ? 'bg-violet-500/[0.04]' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white/85 truncate">
                          {i.nomeComercial}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 font-medium">
                              Atual
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                          Lote {i.lote} · {i.fabricante} · vence em{' '}
                          {diasAteVencer(i.validadeReal.toDate())}d
                        </p>
                      </div>
                      <StatusChip status={slotStatusOf(i)} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {current && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => choose(null)}
              className="w-full mt-2 px-4 h-10 rounded-lg text-xs text-slate-500 dark:text-white/45 hover:text-red-600 hover:bg-red-500/5 transition-all"
            >
              Remover ativo (desativar slot)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Module row ──────────────────────────────────────────────────────────────

interface ModuleRowProps {
  module: InsumoModulo;
  moduleLabel: string;
  setup: EquipmentSetup | null;
  reagente: Insumo | null;
  controle: Insumo | null;
  tira: Insumo | null;
  canMutate: boolean;
  onOpenSlot: (slot: EquipmentSetupSlot) => void;
}

function ModuleRow({
  module,
  moduleLabel,
  setup,
  reagente,
  controle,
  tira,
  canMutate,
  onOpenSlot,
}: ModuleRowProps) {
  const equipDefault = DEFAULT_EQUIPAMENTO_POR_MODULO[module];
  const equipName = setup?.equipamentoName ?? equipDefault?.name ?? moduleLabel;
  const lastChange = setup?.updatedAt ? setup.updatedAt.toDate() : null;
  const aggStatus = aggregateStatus([
    reagente,
    controle,
    module === 'uroanalise' ? tira : null,
  ]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0F1318] p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/30 font-semibold">
            Setup atual · {moduleLabel}
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white/90 mt-0.5">
            {equipName}
          </p>
        </div>
        <StatusChip status={aggStatus} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <SlotCard
          label="Reagente"
          insumo={reagente}
          canMutate={canMutate}
          onTrocar={() => onOpenSlot('activeReagenteId')}
        />
        <SlotCard
          label="Controle"
          insumo={controle}
          canMutate={canMutate}
          onTrocar={() => onOpenSlot('activeControleId')}
        />
        {module === 'uroanalise' && (
          <SlotCard
            label="Tira"
            insumo={tira}
            canMutate={canMutate}
            onTrocar={() => onOpenSlot('activeTiraUroId')}
          />
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] text-slate-500 dark:text-white/40">
        <span>
          Última troca:{' '}
          <span className="text-slate-700 dark:text-white/65 font-medium">
            {relativeTime(lastChange)}
          </span>
          {setup?.updatedByName && (
            <span className="text-slate-400 dark:text-white/30"> · por {setup.updatedByName}</span>
          )}
        </span>
      </div>
    </div>
  );
}

interface SlotCardProps {
  label: string;
  insumo: Insumo | null;
  canMutate: boolean;
  onTrocar: () => void;
}

function SlotCard({ label, insumo, canMutate, onTrocar }: SlotCardProps) {
  return (
    <div className="rounded-lg border border-slate-100 dark:border-white/[0.04] bg-slate-50/60 dark:bg-white/[0.015] p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/40 font-semibold">
          {label}
        </span>
        <StatusChip status={slotStatusOf(insumo)} />
      </div>
      {insumo ? (
        <>
          <p className="text-[13px] font-medium text-slate-900 dark:text-white/85 truncate">
            {insumo.nomeComercial}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
            Lote {insumo.lote} · {insumo.fabricante}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-slate-400 dark:text-white/25 italic">
          Nenhum ativo
        </p>
      )}
      {canMutate && (
        <button
          type="button"
          onClick={onTrocar}
          className="mt-2 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          Trocar →
        </button>
      )}
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

interface EquipmentSetupPanelProps {
  canMutate: boolean;
}

export function EquipmentSetupPanel({ canMutate }: EquipmentSetupPanelProps) {
  const activeLab = useActiveLab();
  const user = useUser();
  const [openSlot, setOpenSlot] = useState<{
    module: InsumoModulo;
    slot: EquipmentSetupSlot;
  } | null>(null);

  // Fetch setup + insumos de todos os módulos em paralelo. Hooks em ordem fixa
  // — React exige ordem estável por render.
  const hematoSetup = useEquipmentSetup('hematologia').setup;
  const coagSetup = useEquipmentSetup('coagulacao').setup;
  const uroSetup = useEquipmentSetup('uroanalise').setup;
  const imunoSetup = useEquipmentSetup('imunologia').setup;

  // Todos os insumos ativos do lab — resolução cliente dos IDs do setup.
  // Mais simples (1 subscription em vez de 12 getDocs) e reusa cache já em uso
  // pela lista principal. Trade-off: lab com >1000 insumos ativos pode sentir,
  // mas nesse ponto outras telas já estão sobrecarregadas também.
  const { insumos } = useInsumos({ status: 'ativo' });
  const byId = useMemo(
    () => new Map(insumos.map((i) => [i.id, i])),
    [insumos],
  );

  const resolve = (id: string | null | undefined): Insumo | null =>
    id ? byId.get(id) ?? null : null;

  if (!activeLab || !user) return null;

  const setups: Record<InsumoModulo, EquipmentSetup | null> = {
    hematologia: hematoSetup,
    coagulacao: coagSetup,
    uroanalise: uroSetup,
    imunologia: imunoSetup,
  };

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-white/40">
            Setup dos equipamentos
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/35 mt-0.5">
            O que está rodando agora em cada módulo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MODULES.map((m) => {
          const setup = setups[m.id];
          return (
            <ModuleRow
              key={m.id}
              module={m.id}
              moduleLabel={m.label}
              setup={setup}
              reagente={resolve(setup?.activeReagenteId)}
              controle={resolve(setup?.activeControleId)}
              tira={resolve(setup?.activeTiraUroId)}
              canMutate={canMutate}
              onOpenSlot={(slot) => setOpenSlot({ module: m.id, slot })}
            />
          );
        })}
      </div>

      {openSlot && (
        <SlotSelector
          labId={activeLab.id}
          module={openSlot.module}
          slot={openSlot.slot}
          current={resolve(setups[openSlot.module]?.[openSlot.slot])}
          operadorId={user.uid}
          operadorName={user.displayName || user.email?.split('@')[0] || 'Operador'}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </section>
  );
}
