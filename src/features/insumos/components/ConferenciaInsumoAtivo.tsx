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

import React, { useState, useMemo } from 'react';
import { useEquipmentSetup } from '../hooks/useEquipmentSetup';
import { useInsumos } from '../hooks/useInsumos';
import { useActiveLab, useUser } from '../../../store/useAuthStore';
import { setActiveInsumo } from '../services/equipmentSetupService';
import { openInsumo } from '../services/insumosFirebaseService';
import { DEFAULT_EQUIPAMENTO_POR_MODULO } from '../../../constants';
import { validadeStatus, diasAteVencer } from '../utils/validadeReal';
import { evaluateInsumoUsability } from '../utils/insumoUsability';
import { insumoCobreEquipamento } from '../types/Insumo';
import type { Insumo, InsumoModulo } from '../types/Insumo';
import type { EquipmentSetupSlot } from '../types/EquipmentSetup';

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
    reagenteTtpa?: boolean;
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
  alternativas,
  onTrocar,
}: {
  label: string;
  insumo: Insumo | null;
  required: boolean;
  alternativas?: Insumo[];
  onTrocar?: (insumoId: string) => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const [selId, setSelId] = useState('');
  const [saving, setSaving] = useState(false);

  const podeTrocar = insumo && alternativas && alternativas.length > 0 && onTrocar;

  const handleSwap = async () => {
    if (!selId || !onTrocar) return;
    setSaving(true);
    try {
      await onTrocar(selId);
      setSwapping(false);
      setSelId('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05]">
      <div className="shrink-0 w-20 text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div className={`flex-1 min-w-0 ${swapping ? 'hidden' : ''}`}>
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
      {swapping && (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <select
            value={selId}
            onChange={(e) => setSelId(e.target.value)}
            className="flex-1 px-2 py-1 rounded-md text-xs bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-slate-900 dark:text-white/90"
          >
            <option value="">Selecione…</option>
            {alternativas?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nomeComercial} · Lote {i.lote} · {i.fabricante}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSwap}
            disabled={!selId || saving}
            className="px-2.5 py-1 rounded text-[10px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {saving ? '…' : 'OK'}
          </button>
          <button
            type="button"
            onClick={() => { setSwapping(false); setSelId(''); }}
            className="px-2 py-1 rounded text-[10px] text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/60"
          >
            ✕
          </button>
        </div>
      )}
      <div className="shrink-0">{insumoBadge(insumo)}</div>
      {podeTrocar && !swapping && (
        <button
          type="button"
          onClick={() => setSwapping(true)}
          className="shrink-0 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline px-1"
        >
          Trocar
        </button>
      )}
    </li>
  );
}

// ─── QuickSetupInline ────────────────────────────────────────────────────────

/**
 * Permite ao operador vincular reagente/controle ao equipamento diretamente
 * no form de corrida, sem precisar navegar para a tela de Insumos.
 * Aparece quando o setup não existe ou está incompleto E há insumos
 * compatíveis disponíveis (ativos OU fechados — fechados são abertos
 * automaticamente antes de vincular).
 */
function QuickSetupInline({
  module,
  equipamentoId,
  insumos,
  insumosFechados,
  requiredSlots,
  reagente,
  reagenteTtpa,
  controle,
  tira,
}: {
  module: InsumoModulo;
  equipamentoId: string | null;
  insumos: Insumo[];
  insumosFechados: Insumo[];
  requiredSlots: ConferenciaInsumoAtivoProps['requiredSlots'];
  reagente: Insumo | null;
  reagenteTtpa?: Insumo | null;
  controle: Insumo | null;
  tira: Insumo | null;
}) {
  const activeLab = useActiveLab();
  const user = useUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allDisponiveis = useMemo(
    () => [...insumos, ...insumosFechados],
    [insumos, insumosFechados],
  );

  const reagentesDisponiveis = useMemo(
    () => allDisponiveis.filter((i) => i.tipo === 'reagente' && i.modulo === module),
    [allDisponiveis, module],
  );
  const controlesDisponiveis = useMemo(
    () => allDisponiveis.filter((i) => i.tipo === 'controle' && i.modulo === module),
    [allDisponiveis, module],
  );
  const tirasDisponiveis = useMemo(
    () => allDisponiveis.filter((i) => i.tipo === 'tira-uro' && i.modulo === module),
    [allDisponiveis, module],
  );

  const needsReagente = requiredSlots.reagente && !reagente && reagentesDisponiveis.length > 0;
  const needsReagenteTtpa = requiredSlots.reagenteTtpa && !reagenteTtpa && reagentesDisponiveis.length > 0;
  const needsControle = requiredSlots.controle && !controle && controlesDisponiveis.length > 0;
  const needsTira = requiredSlots.tira && !tira && tirasDisponiveis.length > 0;

  const [selReagente, setSelReagente] = useState('');
  const [selReagenteTtpa, setSelReagenteTtpa] = useState('');
  const [selControle, setSelControle] = useState('');
  const [selTira, setSelTira] = useState('');

  if (!needsReagente && !needsReagenteTtpa && !needsControle && !needsTira) return null;
  if (!activeLab || !user) return null;

  const fechadosById = new Map(insumosFechados.map((i) => [i.id, i]));

  const openIfNeeded = async (insumoId: string) => {
    const fechado = fechadosById.get(insumoId);
    if (!fechado) return;
    await openInsumo(
      activeLab.id,
      insumoId,
      fechado,
      user.uid,
      user.displayName ?? user.email ?? 'Operador',
    );
  };

  const handleQuickSetup = async () => {
    setSaving(true);
    setError(null);
    try {
      if (selReagente) {
        await openIfNeeded(selReagente);
        await setActiveInsumo(activeLab.id, {
          module,
          slot: 'activeReagenteId',
          newInsumoId: selReagente,
          operadorId: user.uid,
          operadorName: user.displayName ?? user.email ?? 'Operador',
          equipamentoId: equipamentoId ?? undefined,
        });
      }
      if (selReagenteTtpa) {
        await openIfNeeded(selReagenteTtpa);
        await setActiveInsumo(activeLab.id, {
          module,
          slot: 'activeReagenteTtpaId',
          newInsumoId: selReagenteTtpa,
          operadorId: user.uid,
          operadorName: user.displayName ?? user.email ?? 'Operador',
          equipamentoId: equipamentoId ?? undefined,
        });
      }
      if (selControle) {
        await openIfNeeded(selControle);
        await setActiveInsumo(activeLab.id, {
          module,
          slot: 'activeControleId',
          newInsumoId: selControle,
          operadorId: user.uid,
          operadorName: user.displayName ?? user.email ?? 'Operador',
          equipamentoId: equipamentoId ?? undefined,
        });
      }
      if (selTira) {
        await openIfNeeded(selTira);
        await setActiveInsumo(activeLab.id, {
          module,
          slot: 'activeTiraUroId',
          newInsumoId: selTira,
          operadorId: user.uid,
          operadorName: user.displayName ?? user.email ?? 'Operador',
          equipamentoId: equipamentoId ?? undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao configurar setup.');
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    (!needsReagente || selReagente) &&
    (!needsReagenteTtpa || selReagenteTtpa) &&
    (!needsControle || selControle) &&
    (!needsTira || selTira);

  return (
    <div className="mb-3 p-3 rounded-lg bg-violet-500/[0.06] border border-violet-500/20">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-2">
        Setup rápido — vincular insumos ao equipamento
      </p>
      <div className="space-y-2">
        {needsReagente && (
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-white/40 mb-0.5">
              {module === 'coagulacao' ? 'Reagente TP' : 'Reagente'}
            </label>
            <select
              value={selReagente}
              onChange={(e) => setSelReagente(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-slate-900 dark:text-white/90"
            >
              <option value="">Selecione…</option>
              {reagentesDisponiveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nomeComercial} · Lote {i.lote} · {i.fabricante}
                  {fechadosById.has(i.id) ? ' (fechado — será aberto)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {needsReagenteTtpa && (
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-white/40 mb-0.5">
              Reagente TTPA
            </label>
            <select
              value={selReagenteTtpa}
              onChange={(e) => setSelReagenteTtpa(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-slate-900 dark:text-white/90"
            >
              <option value="">Selecione…</option>
              {reagentesDisponiveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nomeComercial} · Lote {i.lote} · {i.fabricante}
                  {fechadosById.has(i.id) ? ' (fechado — será aberto)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {needsControle && (
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-white/40 mb-0.5">
              Controle
            </label>
            <select
              value={selControle}
              onChange={(e) => setSelControle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-slate-900 dark:text-white/90"
            >
              <option value="">Selecione…</option>
              {controlesDisponiveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nomeComercial} · Lote {i.lote} · {i.fabricante}
                  {fechadosById.has(i.id) ? ' (fechado — será aberto)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {needsTira && (
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-white/40 mb-0.5">
              Tira
            </label>
            <select
              value={selTira}
              onChange={(e) => setSelTira(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-slate-900 dark:text-white/90"
            >
              <option value="">Selecione…</option>
              {tirasDisponiveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nomeComercial} · Lote {i.lote} · {i.fabricante}
                  {fechadosById.has(i.id) ? ' (fechado — será aberto)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5">{error}</p>
      )}
      <button
        type="button"
        onClick={handleQuickSetup}
        disabled={!canSave || saving}
        className="mt-2.5 w-full py-2 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Salvando…' : 'Abrir (se necessário) e vincular ao equipamento'}
      </button>
    </div>
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
  const activeLab = useActiveLab();
  const user = useUser();

  // Fase D: se equipamentoId fornecido, usa como docId do setup. Caso contrário
  // mantém o docId legado (= module) — comportamento pré-Fase D preservado.
  // Fallback pro module quando o doc do equipamento não existe (migração Fase A→D).
  const setupDocId = equipamentoId ?? module;
  const fallbackDocId = equipamentoId ? module : null;
  const { setup, isLoading } = useEquipmentSetup(setupDocId, fallbackDocId);
  const { insumos: allAtivos } = useInsumos({ status: 'ativo' });
  const { insumos: allFechados } = useInsumos({ status: 'fechado' });
  const insumos = equipamentoId
    ? allAtivos.filter((i) => insumoCobreEquipamento(i, equipamentoId))
    : allAtivos;
  const insumosFechados = equipamentoId
    ? allFechados.filter((i) => insumoCobreEquipamento(i, equipamentoId))
    : allFechados;

  const byId = new Map(insumos.map((i) => [i.id, i]));
  const reagente = setup?.activeReagenteId ? byId.get(setup.activeReagenteId) ?? null : null;
  const reagenteTtpa = setup?.activeReagenteTtpaId ? byId.get(setup.activeReagenteTtpaId) ?? null : null;
  const controle = setup?.activeControleId ? byId.get(setup.activeControleId) ?? null : null;
  const tira = setup?.activeTiraUroId ? byId.get(setup.activeTiraUroId) ?? null : null;

  // Alternativas para troca inline — insumos ativos do mesmo tipo excluindo o atual
  const alternativasReagente = useMemo(
    () => allAtivos.filter((i) => i.tipo === 'reagente' && i.modulo === module && i.id !== setup?.activeReagenteId),
    [allAtivos, module, setup?.activeReagenteId],
  );
  const alternativasReagenteTtpa = useMemo(
    () => allAtivos.filter((i) => i.tipo === 'reagente' && i.modulo === module && i.id !== setup?.activeReagenteTtpaId),
    [allAtivos, module, setup?.activeReagenteTtpaId],
  );
  const alternativasControle = useMemo(
    () => allAtivos.filter((i) => i.tipo === 'controle' && i.modulo === module && i.id !== setup?.activeControleId),
    [allAtivos, module, setup?.activeControleId],
  );
  const alternativasTira = useMemo(
    () => allAtivos.filter((i) => i.tipo === 'tira-uro' && i.modulo === module && i.id !== setup?.activeTiraUroId),
    [allAtivos, module, setup?.activeTiraUroId],
  );

  const handleTrocar = (slot: EquipmentSetupSlot) => async (novoInsumoId: string) => {
    if (!activeLab || !user) return;
    await setActiveInsumo(activeLab.id, {
      module,
      slot,
      newInsumoId: novoInsumoId,
      operadorId: user.uid,
      operadorName: user.displayName ?? user.email ?? 'Operador',
      equipamentoId: equipamentoId ?? undefined,
    });
  };

  const equipamento =
    setup?.equipamentoName ?? DEFAULT_EQUIPAMENTO_POR_MODULO[module]?.name ?? module;

  const slotsFaltando =
    (requiredSlots.reagente && !reagente) ||
    (requiredSlots.reagenteTtpa && !reagenteTtpa) ||
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
          <SlotLine
            label={module === 'coagulacao' ? "Reagente TP" : "Reagente"}
            insumo={reagente}
            required={!!requiredSlots.reagente}
            alternativas={alternativasReagente}
            onTrocar={handleTrocar('activeReagenteId')}
          />
        )}
        {requiredSlots.reagenteTtpa !== undefined && (
          <SlotLine
            label="Reagente TTPA"
            insumo={reagenteTtpa}
            required={!!requiredSlots.reagenteTtpa}
            alternativas={alternativasReagenteTtpa}
            onTrocar={handleTrocar('activeReagenteTtpaId')}
          />
        )}
        {requiredSlots.controle !== undefined && (
          <SlotLine
            label="Controle"
            insumo={controle}
            required={!!requiredSlots.controle}
            alternativas={alternativasControle}
            onTrocar={handleTrocar('activeControleId')}
          />
        )}
        {requiredSlots.tira !== undefined && (
          <SlotLine
            label="Tira"
            insumo={tira}
            required={!!requiredSlots.tira}
            alternativas={alternativasTira}
            onTrocar={handleTrocar('activeTiraUroId')}
          />
        )}
      </ul>

      {slotsFaltando && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-[12px] text-red-700 dark:text-red-300">
            Há insumo obrigatório não configurado. Configure no Setup do equipamento antes de salvar.
          </p>
        </div>
      )}

      {slotsFaltando && (
        <QuickSetupInline
          module={module}
          equipamentoId={equipamentoId ?? null}
          insumos={insumos}
          insumosFechados={insumosFechados}
          requiredSlots={requiredSlots}
          reagente={reagente}
          reagenteTtpa={reagenteTtpa}
          controle={controle}
          tira={tira}
        />
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
