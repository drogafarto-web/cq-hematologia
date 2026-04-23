import React, { useMemo, useState } from 'react';
import { AddLotModal } from './AddLotModal';
import type { ControlLot } from '../../types';
import type { AddLotInput } from './hooks/useLots';

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M12 3.5l-.8 8a1 1 0 01-1 .9H3.8a1 1 0 01-1-.9L2 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
  2: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20',
  3: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20',
};

function LotBadge({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${LEVEL_COLORS[level]}`}>
      NV{level}
    </span>
  );
}

function ExpiryLabel({ date }: { date: Date }) {
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  const fmtd = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (days < 0) return <span className="text-xs text-red-600 dark:text-red-400/80">Vencido</span>;
  if (days <= 30)
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400/80">
        {fmtd} ({days}d)
      </span>
    );
  return <span className="text-xs text-slate-400 dark:text-white/30">{fmtd}</span>;
}

// ─── Lot row ──────────────────────────────────────────────────────────────────

interface LotRowProps {
  lot: ControlLot;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function LotRow({ lot, active, onSelect, onDelete }: LotRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
  }

  const expired = lot.expiryDate.getTime() < Date.now();

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
        active
          ? 'bg-emerald-500/[0.10] border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
          : 'border border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:border-slate-200 dark:hover:border-white/[0.07]'
      } ${expired && !active ? 'opacity-50' : ''}`}
    >
      {active && (
        <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-emerald-500" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <LotBadge level={lot.level} />
          <span
            className={`text-sm font-medium truncate ${active ? 'text-slate-900 dark:text-white/95' : 'text-slate-600 dark:text-white/70'}`}
          >
            {lot.controlName}
          </span>
          {active && (
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
              EM USO
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 dark:text-white/35 truncate">Lote {lot.lotNumber}</p>
        <div className="flex items-center gap-3 mt-1">
          <ExpiryLabel date={lot.expiryDate} />
          <span className="text-xs text-slate-400 dark:text-white/25">{lot.runCount} corridas</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        onBlur={() => setConfirmDelete(false)}
        aria-label={confirmDelete ? 'Confirmar exclusão' : 'Excluir lote'}
        className={`shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ${
          confirmDelete
            ? 'bg-red-500/20 text-red-500'
            : 'text-slate-400 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.07]'
        }`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ─── Lot grouping by status ──────────────────────────────────────────────────

/**
 * Agrupa lotes em 3 seções operacionais:
 *   - EM USO: lote ativo (activeLotId) + não vencido
 *   - DISPONÍVEIS: não-ativos, não vencidos (estoque pronto pra rotação)
 *   - HISTÓRICO: vencidos (arquivo)
 *
 * Dentro de cada seção, ordenação por nível (1→2→3) pra leitura consistente.
 * Este agrupamento é mais operacional que o legado "por mês" — a pergunta
 * mental do operador é "o que estou usando agora? o que tem pronto? o que
 * já está fora?", e chunking cronológico fazia operador ter que ler data
 * pra descobrir isso.
 */
interface LotSection {
  key: 'em-uso' | 'disponiveis' | 'historico';
  label: string;
  lots: ControlLot[];
}

function groupByStatus(lots: ControlLot[], activeLotId: string | null): LotSection[] {
  const now = Date.now();
  const sections: Record<LotSection['key'], ControlLot[]> = {
    'em-uso': [],
    disponiveis: [],
    historico: [],
  };

  for (const lot of lots) {
    const isActive = lot.id === activeLotId;
    const isExpired = lot.expiryDate.getTime() < now;
    if (isActive && !isExpired) {
      sections['em-uso'].push(lot);
    } else if (isExpired) {
      sections.historico.push(lot);
    } else {
      sections.disponiveis.push(lot);
    }
  }

  // Edge case: lote ativo vencido — aparece em Histórico (opacity) mas sinalizado
  // separadamente no header da seção Em Uso quando vazio, via activeLotId.
  const sortByLevel = (a: ControlLot, b: ControlLot) => (a.level ?? 0) - (b.level ?? 0);
  return [
    { key: 'em-uso', label: 'Em uso agora', lots: sections['em-uso'].sort(sortByLevel) },
    { key: 'disponiveis', label: 'Disponíveis', lots: sections.disponiveis.sort(sortByLevel) },
    { key: 'historico', label: 'Histórico (vencidos)', lots: sections.historico.sort(sortByLevel) },
  ];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LotManagerProps {
  lots: ControlLot[];
  activeLotId: string | null;
  showAdd: boolean;
  onCloseAdd: () => void;
  onAdd: (input: AddLotInput) => Promise<string>;
  onDelete: (lotId: string) => Promise<void>;
  onSelect: (id: string) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LotManager({
  lots,
  activeLotId,
  showAdd,
  onCloseAdd,
  onAdd,
  onDelete,
  onSelect,
}: LotManagerProps) {
  const [showHistorico, setShowHistorico] = useState(false);
  const sections = useMemo(() => groupByStatus(lots, activeLotId), [lots, activeLotId]);

  /**
   * Banner proativo de rotação — aparece quando o lote ativo está vencendo
   * nos próximos 15 dias OU já usou > 80% da janela típica de corridas (60).
   * Ajuda a prevenir "acabou o lote e não tinha o próximo cadastrado" —
   * que é quando operador é forçado a rotacionar sob pressão.
   */
  const rotacaoHint = useMemo(() => {
    const ativo = lots.find((l) => l.id === activeLotId);
    if (!ativo) return null;
    const now = Date.now();
    const diasAteVencer = Math.ceil((ativo.expiryDate.getTime() - now) / 86_400_000);
    const venceLogo = diasAteVencer >= 0 && diasAteVencer <= 15;
    const usoAlto = ativo.runCount >= 48; // ~80% de 60 runs/lote típico
    if (!venceLogo && !usoAlto) return null;
    const temProximoDisponivel = lots.some(
      (l) =>
        l.id !== ativo.id &&
        l.level === ativo.level &&
        l.controlName === ativo.controlName &&
        l.expiryDate.getTime() > now,
    );
    return { ativo, diasAteVencer, venceLogo, usoAlto, temProximoDisponivel };
  }, [lots, activeLotId]);

  if (lots.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] flex items-center justify-center mb-3 text-slate-400 dark:text-white/20">
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden>
              <rect
                x="2"
                y="2"
                width="14"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M9 6v6M6 9h6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-white/40 font-medium">
            Nenhum lote cadastrado
          </p>
          <p className="text-xs text-slate-400 dark:text-white/20 mt-1">
            Clique em "+ Novo lote" para começar
          </p>
        </div>
        {showAdd && <AddLotModal onAdd={onAdd} onClose={onCloseAdd} />}
      </>
    );
  }

  const emUso = sections.find((s) => s.key === 'em-uso')!;
  const disponiveis = sections.find((s) => s.key === 'disponiveis')!;
  const historico = sections.find((s) => s.key === 'historico')!;

  function renderSection(section: LotSection, tone: 'primary' | 'default' | 'muted') {
    const isEmUso = section.key === 'em-uso';
    const isEmpty = section.lots.length === 0;

    const toneBorder =
      tone === 'primary'
        ? 'border-emerald-300 dark:border-emerald-500/30'
        : tone === 'muted'
          ? 'border-slate-200 dark:border-white/[0.05] opacity-80'
          : 'border-slate-200 dark:border-white/[0.06]';
    const toneHeader =
      tone === 'primary'
        ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/20'
        : 'bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/[0.06]';
    const toneTitle =
      tone === 'primary'
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-slate-600 dark:text-slate-300';

    return (
      <div
        key={section.key}
        className={`bg-white dark:bg-white/[0.03] border rounded-xl overflow-hidden shadow-sm dark:shadow-none ${toneBorder}`}
      >
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${toneHeader}`}>
          <span className={`text-xs font-semibold uppercase tracking-wider ${toneTitle}`}>
            {section.label}
          </span>
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
            {section.lots.length} lote{section.lots.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="p-2 space-y-0.5">
          {isEmpty && isEmUso ? (
            <div className="px-4 py-3 text-xs text-slate-500 dark:text-white/40 italic">
              Nenhum lote ativo no momento. Selecione um lote em <strong>Disponíveis</strong> para
              começar a registrar corridas.
            </div>
          ) : isEmpty ? (
            <div className="px-4 py-3 text-xs text-slate-400 dark:text-white/30 italic">
              Nenhum lote.
            </div>
          ) : (
            section.lots.map((lot) => (
              <LotRow
                key={lot.id}
                lot={lot}
                active={lot.id === activeLotId}
                onSelect={() => onSelect(lot.id)}
                onDelete={() => onDelete(lot.id)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {rotacaoHint && (
          <div
            role="status"
            className={`rounded-xl border p-3.5 flex items-start gap-3 ${
              rotacaoHint.temProximoDisponivel
                ? 'border-amber-200 dark:border-amber-500/25 bg-amber-50/70 dark:bg-amber-500/[0.06]'
                : 'border-orange-300 dark:border-orange-500/30 bg-orange-50/70 dark:bg-orange-500/[0.08]'
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 mt-0.5 ${
                rotacaoHint.temProximoDisponivel
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-orange-600 dark:text-orange-400'
              }`}
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  rotacaoHint.temProximoDisponivel
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-orange-800 dark:text-orange-200'
                }`}
              >
                {rotacaoHint.venceLogo
                  ? rotacaoHint.diasAteVencer <= 0
                    ? `Lote ${rotacaoHint.ativo.lotNumber} vence hoje`
                    : `Lote ${rotacaoHint.ativo.lotNumber} vence em ${rotacaoHint.diasAteVencer} dia${rotacaoHint.diasAteVencer === 1 ? '' : 's'}`
                  : `Lote ${rotacaoHint.ativo.lotNumber} já tem ${rotacaoHint.ativo.runCount} corridas`}
              </p>
              <p
                className={`text-[12px] mt-0.5 leading-snug ${
                  rotacaoHint.temProximoDisponivel
                    ? 'text-amber-700/80 dark:text-amber-300/70'
                    : 'text-orange-700/80 dark:text-orange-300/70'
                }`}
              >
                {rotacaoHint.temProximoDisponivel
                  ? 'Você já tem o próximo lote cadastrado em Disponíveis — mantenha o fluxo tranquilo.'
                  : 'Ainda não há lote sucessor cadastrado. Cadastre o próximo antes que esgote para evitar pausa na rotina.'}
              </p>
            </div>
          </div>
        )}

        {renderSection(emUso, 'primary')}
        {renderSection(disponiveis, 'default')}

        {/* Histórico: sempre colapsado por padrão pra não poluir a vista do
            operador. Expande quando o usuário quer auditar runs antigas. */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistorico((v) => !v)}
            className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {historico.label}
            </span>
            <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
              {historico.lots.length} lote{historico.lots.length !== 1 ? 's' : ''}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className={`text-slate-400 transition-transform ${showHistorico ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          {showHistorico && (
            <div className="p-2 space-y-0.5">
              {historico.lots.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 dark:text-white/30 italic">
                  Sem lotes vencidos.
                </div>
              ) : (
                historico.lots.map((lot) => (
                  <LotRow
                    key={lot.id}
                    lot={lot}
                    active={lot.id === activeLotId}
                    onSelect={() => onSelect(lot.id)}
                    onDelete={() => onDelete(lot.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddLotModal onAdd={onAdd} onClose={onCloseAdd} />}
    </>
  );
}
