import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AddLotModal } from './AddLotModal';
import { CadastroSemBulaModal } from './CadastroSemBulaModal';
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
  /** Lote da bula corrente, em rotina operacional. Mostra badge "EM USO". */
  isInUse: boolean;
  onDelete: () => void;
  onToggleHidden: () => void;
  /** Quando o lote está bulaPendente, opcionalmente abre o BulaProcessor
   *  em modo "merge" (atualiza o lote em vez de criar novo). */
  onImportBula?: () => void;
}

function LotRow({ lot, isInUse, onDelete, onToggleHidden, onImportBula }: LotRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function toggleMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (!menuOpen && menuButtonRef.current) {
      const r = menuButtonRef.current.getBoundingClientRect();
      setMenuPos({
        top: r.bottom + 4,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    setMenuOpen((v) => !v);
    setConfirmDelete(false);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setMenuOpen(false);
    setConfirmDelete(false);
    onDelete();
  }

  const expired = lot.expiryDate.getTime() < Date.now();
  const hidden = lot.manualHidden === true;
  const archived = lot.archivedAt != null;
  const aguardandoBula = lot.bulaPendente === true || lot.manufacturerStats == null;
  const diasSemBula = aguardandoBula
    ? Math.max(0, Math.floor((Date.now() - lot.startDate.getTime()) / 86_400_000))
    : 0;
  const semBulaCritico = aguardandoBula && diasSemBula > 7;

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3 rounded-xl transition-all ${
        isInUse
          ? 'bg-emerald-500/[0.06] border border-emerald-500/25'
          : 'border border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:border-slate-200 dark:hover:border-white/[0.07]'
      } ${expired ? 'opacity-50' : ''} ${hidden ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <LotBadge level={lot.level} />
          <span
            className={`text-sm font-medium truncate ${isInUse ? 'text-slate-900 dark:text-white/95' : 'text-slate-600 dark:text-white/70'}`}
          >
            {lot.controlName}
          </span>
          {isInUse && (
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
              EM USO
            </span>
          )}
          {hidden && (
            <span className="text-[9px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-slate-300/40 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-white/[0.1]">
              RETIRADO
            </span>
          )}
          {archived && (
            <span className="text-[9px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-slate-300/40 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-white/[0.1]">
              ENCERRADO
            </span>
          )}
          {aguardandoBula && (
            <span
              title={
                semBulaCritico
                  ? `Sem bula há ${diasSemBula} dias — ultrapassou janela típica (≤7d)`
                  : `Sem bula há ${diasSemBula} dia${diasSemBula === 1 ? '' : 's'} — Westgard suspenso`
              }
              className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                semBulaCritico
                  ? 'bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                  : 'bg-amber-500/15 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
              }`}
            >
              ⏳ AGUARDANDO BULA · {diasSemBula}d
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 dark:text-white/35 truncate">Lote {lot.lotNumber}</p>
        <div className="flex items-center gap-3 mt-1">
          <ExpiryLabel date={lot.expiryDate} />
          <span className="text-xs text-slate-400 dark:text-white/25">{lot.runCount} corridas</span>
        </div>
      </div>

      {/* Action menu — portal pra escapar overflow do container */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={toggleMenu}
        aria-label="Ações do lote"
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="3" cy="7" r="1.2" fill="currentColor" />
          <circle cx="7" cy="7" r="1.2" fill="currentColor" />
          <circle cx="11" cy="7" r="1.2" fill="currentColor" />
        </svg>
      </button>
      {menuOpen &&
        menuPos &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setConfirmDelete(false);
              }}
            />
            <div
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
              className="z-[9999] w-60 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {aguardandoBula && onImportBula && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onImportBula();
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/[0.08] border-b border-slate-100 dark:border-white/[0.05]"
                >
                  <div className="font-medium">📄 Importar bula deste lote</div>
                  <div className="text-[10px] text-amber-600/80 dark:text-amber-300/70">
                    Aplica valores-alvo + recalcula Westgard das corridas
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleHidden();
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
              >
                <div className="font-medium">{hidden ? 'Recolocar em uso' : 'Retirar de uso'}</div>
                <div className="text-[10px] text-slate-400 dark:text-white/35">
                  {hidden
                    ? 'Volta pra "EM USO" se for da bula corrente'
                    : 'Move pra "Disponíveis" sem deletar histórico'}
                </div>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                onBlur={() => setConfirmDelete(false)}
                className={`w-full text-left px-3.5 py-2.5 text-xs border-t border-slate-100 dark:border-white/[0.05] ${
                  confirmDelete
                    ? 'bg-red-50 dark:bg-red-500/[0.08] text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/[0.12]'
                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.05]'
                }`}
              >
                <div className="font-medium flex items-center gap-1.5">
                  <TrashIcon />
                  {confirmDelete ? 'Clique novamente pra confirmar' : 'Excluir lote'}
                </div>
                {!confirmDelete && (
                  <div className="text-[10px] text-red-500/70 dark:text-red-300/60">
                    Ação irreversível — apaga runs vinculadas
                  </div>
                )}
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

// ─── Lot grouping by status ──────────────────────────────────────────────────

/**
 * EM USO: todos os 3 níveis da bula corrente (não vencidos, não arquivados).
 * "Bula corrente" = `startDate` mais recente ainda vigente. Em hematologia
 * Controllab os 3 níveis rodam simultaneamente, então EM USO ≠ activeLotId.
 * DISPONÍVEIS: vigentes de outras bulas. HISTÓRICO: vencidos ou archivedAt.
 */
interface LotSection {
  key: 'em-uso' | 'disponiveis' | 'historico';
  label: string;
  lots: ControlLot[];
}

function bulaKey(lot: ControlLot): string {
  // Agrupador de bula = ano-mês de startDate. Mesma chave usada por
  // shared/utils/lotUtils.groupByMonth.
  const yr = lot.startDate.getFullYear();
  const mo = lot.startDate.getMonth();
  return `${yr}-${String(mo).padStart(2, '0')}`;
}

function groupByStatus(lots: ControlLot[]): LotSection[] {
  const now = Date.now();

  // 1) Particiona por validade.
  // `archivedAt` força HISTÓRICO mesmo se não vencido — usado quando uma
  // bula nova substitui a anterior e o operador escolhe "encerrar lotes
  // anteriores" (RDC 786 mantém o doc, mas remove da rotina visual).
  const vigentes: ControlLot[] = [];
  const vencidos: ControlLot[] = [];
  for (const lot of lots) {
    if (lot.archivedAt || lot.expiryDate.getTime() < now) vencidos.push(lot);
    else vigentes.push(lot);
  }

  // 2) Identifica a bula corrente — mais recente cujo startDate <= agora.
  // Sem startDate <= agora válido, fallback pra bula com startDate mais
  // recente entre os vigentes (evita seção "em uso" vazia em deploys onde
  // startDate ainda é futura).
  let bulaCorrente: string | null = null;
  let bestStartTs = -Infinity;
  for (const lot of vigentes) {
    const ts = lot.startDate.getTime();
    if (ts <= now && ts > bestStartTs) {
      bestStartTs = ts;
      bulaCorrente = bulaKey(lot);
    }
  }
  if (bulaCorrente === null) {
    // Fallback: bula com startDate mais recente (mesmo que ainda futura).
    bestStartTs = -Infinity;
    for (const lot of vigentes) {
      const ts = lot.startDate.getTime();
      if (ts > bestStartTs) {
        bestStartTs = ts;
        bulaCorrente = bulaKey(lot);
      }
    }
  }

  const emUso: ControlLot[] = [];
  const disponiveis: ControlLot[] = [];
  for (const lot of vigentes) {
    // `manualHidden` força o lote pra Disponíveis mesmo se for da bula
    // corrente — operador removeu manualmente da rotina (ex: contaminação).
    if (lot.manualHidden === true) {
      disponiveis.push(lot);
      continue;
    }
    if (bulaKey(lot) === bulaCorrente) emUso.push(lot);
    else disponiveis.push(lot);
  }

  const sortByLevel = (a: ControlLot, b: ControlLot) => (a.level ?? 0) - (b.level ?? 0);
  return [
    { key: 'em-uso', label: 'Em uso agora', lots: emUso.sort(sortByLevel) },
    { key: 'disponiveis', label: 'Disponíveis', lots: disponiveis.sort(sortByLevel) },
    { key: 'historico', label: 'Histórico (vencidos)', lots: vencidos.sort(sortByLevel) },
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
  onToggleHidden: (lotId: string) => Promise<void>;
  /** Aplica bula importada num lote pendente (modo merge do BatchForm). */
  onApplyBula?: (
    lotId: string,
    manufacturerStats: import('../../types').ManufacturerStats,
    requiredAnalytes: string[],
  ) => Promise<void>;
  /** Callback opcional pra navegar pra view de import de bula. */
  onImportBula?: (lotId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LotManager({
  lots,
  activeLotId,
  showAdd,
  onCloseAdd,
  onAdd,
  onDelete,
  onToggleHidden,
  onApplyBula,
  onImportBula,
}: LotManagerProps) {
  const [showHistorico, setShowHistorico] = useState(false);
  const [showSemBula, setShowSemBula] = useState(false);
  const sections = useMemo(() => groupByStatus(lots), [lots]);

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
          <p className="text-xs text-slate-400 dark:text-white/20 mt-1 mb-4">
            Use a bula PDF ou cadastre sem bula se ela ainda não chegou
          </p>
          <button
            type="button"
            onClick={() => setShowSemBula(true)}
            className="text-[11px] font-semibold px-3.5 h-9 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.06] text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/[0.1] transition-colors"
          >
            + Cadastrar sem bula (3 níveis)
          </button>
        </div>
        {showAdd && <AddLotModal onAdd={onAdd} onClose={onCloseAdd} onApplyBula={onApplyBula} />}
        {showSemBula && (
          <CadastroSemBulaModal onAdd={onAdd} onClose={() => setShowSemBula(false)} />
        )}
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
                isInUse={section.key === 'em-uso'}
                onDelete={() => onDelete(lot.id)}
                onToggleHidden={() => onToggleHidden(lot.id)}
                onImportBula={onImportBula ? () => onImportBula(lot.id) : undefined}
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
        {/* Atalho secundário: cadastro sem bula. Operacionalmente raro mas
            crítico — Controllab manda sangue antes da bula em alguns meses. */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowSemBula(true)}
            title="Use quando o sangue chegou e a bula está atrasada (≤7 dias)"
            className="text-[11px] font-semibold px-3 h-8 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.06] text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/[0.1] transition-colors"
          >
            ⏳ Cadastrar sem bula
          </button>
        </div>

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
                    isInUse={false}
                    onDelete={() => onDelete(lot.id)}
                    onToggleHidden={() => onToggleHidden(lot.id)}
                    onImportBula={onImportBula ? () => onImportBula(lot.id) : undefined}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddLotModal onAdd={onAdd} onClose={onCloseAdd} onApplyBula={onApplyBula} />}
      {showSemBula && (
        <CadastroSemBulaModal onAdd={onAdd} onClose={() => setShowSemBula(false)} />
      )}
    </>
  );
}
