/**
 * InsumosView — página principal do cadastro mestre de insumos.
 *
 * Tabs por tipo (Controle / Reagente / Tira-uro) + filtros por status + busca
 * textual. Lista virtualizável pela quantidade esperada (tipicamente < 500
 * insumos ativos por lab em regime normal — lista flat sem virtualização).
 *
 * Acesso via header da app / lab-settings. View `'insumos'` é roteado em
 * AuthWrapper.
 */

import React, { useMemo, useState } from 'react';
import { useActiveLab, useUser, useUserRole } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useInsumos } from './hooks/useInsumos';
import {
  closeInsumo,
  descartarInsumo,
  openInsumo,
} from './services/insumosFirebaseService';
import { InsumoFormModal } from './components/InsumoFormModal';
import { validadeStatus, diasAteVencer } from './utils/validadeReal';
import type { Insumo, InsumoStatus, InsumoTipo } from './types/Insumo';

// ─── UI tokens ───────────────────────────────────────────────────────────────

const BUTTON_GHOST = `
  px-3 h-9 rounded-lg text-xs font-medium
  text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85
  hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all
`.trim();

const BUTTON_PRIMARY = `
  px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white
  text-sm font-medium transition-all flex items-center gap-2
`.trim();

const CHIP = `
  inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

function statusChip(status: InsumoStatus): { bg: string; label: string } {
  switch (status) {
    case 'ativo':
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
        label: 'Ativo',
      };
    case 'fechado':
      return {
        bg: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-300',
        label: 'Fechado',
      };
    case 'vencido':
      return {
        bg: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
        label: 'Vencido',
      };
    case 'descartado':
      return {
        bg: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400',
        label: 'Descartado',
      };
  }
}

function validadeChip(validadeReal: { toDate: () => Date }): {
  bg: string;
  label: string;
} {
  const date = validadeReal.toDate();
  const status = validadeStatus(date);
  const dias = diasAteVencer(date);
  if (status === 'expired')
    return {
      bg: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
      label: `Vencido há ${Math.abs(dias)}d`,
    };
  if (status === 'warning')
    return {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
      label: `Vence em ${dias}d`,
    };
  return {
    bg: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-white/50',
    label: `Válido (${dias}d)`,
  };
}

// ─── Insumo row ──────────────────────────────────────────────────────────────

function InsumoRow({
  insumo,
  canMutate,
  onOpen,
  onClose,
  onDescartar,
}: {
  insumo: Insumo;
  canMutate: boolean;
  onOpen: (i: Insumo) => void;
  onClose: (i: Insumo) => void;
  onDescartar: (i: Insumo) => void;
}) {
  const s = statusChip(insumo.status);
  const v = validadeChip(insumo.validadeReal);
  const isFechado = insumo.dataAbertura === null;

  return (
    <div className="grid grid-cols-[1fr,140px,120px,180px,160px] gap-4 items-center px-5 py-3 border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-slate-900 dark:text-white/90 truncate">
            {insumo.nomeComercial}
          </div>
          <span className={`${CHIP} ${s.bg}`}>{s.label}</span>
        </div>
        <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5 truncate">
          {insumo.fabricante} · Lote {insumo.lote} · {insumo.modulo}
          {insumo.tipo === 'controle' && ` · nível ${insumo.nivel}`}
        </div>
      </div>

      <div className="text-xs text-slate-600 dark:text-white/55">
        <div>Validade</div>
        <div className="text-slate-900 dark:text-white/80 font-medium">
          {formatDate(insumo.validade)}
        </div>
      </div>

      <div className="text-xs text-slate-600 dark:text-white/55">
        <div>Abertura</div>
        <div className="text-slate-900 dark:text-white/80 font-medium">
          {isFechado ? '—' : formatDate(insumo.dataAbertura)}
        </div>
      </div>

      <span className={`${CHIP} ${v.bg} justify-self-start`}>{v.label}</span>

      <div className="flex items-center justify-end gap-1">
        {canMutate && insumo.status === 'ativo' && isFechado && (
          <button type="button" onClick={() => onOpen(insumo)} className={BUTTON_GHOST}>
            Abrir
          </button>
        )}
        {canMutate && insumo.status === 'ativo' && !isFechado && (
          <button type="button" onClick={() => onClose(insumo)} className={BUTTON_GHOST}>
            Fechar
          </button>
        )}
        {canMutate && insumo.status !== 'descartado' && (
          <button
            type="button"
            onClick={() => onDescartar(insumo)}
            className={`${BUTTON_GHOST} text-red-600 dark:text-red-400/80 hover:text-red-700 dark:hover:text-red-300`}
          >
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

const TABS: { id: InsumoTipo | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'controle', label: 'Controles' },
  { id: 'reagente', label: 'Reagentes' },
  { id: 'tira-uro', label: 'Tiras uro' },
];

const STATUS_FILTERS: { id: InsumoStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'ativo', label: 'Ativos' },
  { id: 'fechado', label: 'Fechados' },
  { id: 'vencido', label: 'Vencidos' },
  { id: 'descartado', label: 'Descartados' },
];

// ─── Main view ───────────────────────────────────────────────────────────────

export function InsumosView() {
  const activeLab = useActiveLab();
  const user = useUser();
  const role = useUserRole();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const [tab, setTab] = useState<InsumoTipo | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<InsumoStatus | 'all'>('ativo');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [initialTipo, setInitialTipo] = useState<InsumoTipo>('controle');
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      tipo: tab === 'all' ? undefined : tab,
      status: statusFilter === 'all' ? undefined : statusFilter,
      query: searchQuery.trim() || undefined,
    }),
    [tab, statusFilter, searchQuery],
  );

  const { insumos, isLoading, error } = useInsumos(filters);

  const canMutate = role === 'admin' || role === 'owner';

  if (!activeLab) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        Nenhum laboratório ativo.
      </div>
    );
  }

  const operadorName = user?.displayName || user?.email?.split('@')[0] || 'Operador';

  async function handleOpen(i: Insumo) {
    if (!user) return;
    setActionError(null);
    try {
      await openInsumo(
        activeLab!.id,
        i.id,
        { validade: i.validade, diasEstabilidadeAbertura: i.diasEstabilidadeAbertura },
        user.uid,
        operadorName,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao abrir insumo.');
    }
  }

  async function handleClose(i: Insumo) {
    if (!user) return;
    setActionError(null);
    try {
      await closeInsumo(activeLab!.id, i.id, user.uid, operadorName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao fechar insumo.');
    }
  }

  async function handleDescartar(i: Insumo) {
    if (!user) return;
    setActionError(null);
    const motivo = window.prompt('Motivo do descarte (obrigatório para auditoria):');
    if (!motivo || !motivo.trim()) return;
    try {
      await descartarInsumo(activeLab!.id, i.id, motivo.trim(), user.uid, operadorName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao descartar insumo.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white">
      {/* Header */}
      <header className="h-14 bg-white dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-4 px-6 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => setCurrentView('hub')}
          className={BUTTON_GHOST}
          aria-label="Voltar ao hub"
        >
          ← Voltar
        </button>
        <div className="h-5 w-px bg-slate-200 dark:bg-white/[0.08]" />
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-white/85">Insumos</div>
          <div className="text-xs text-slate-500 dark:text-white/40">
            Cadastro mestre — {activeLab.name}
          </div>
        </div>
        <div className="flex-1" />
        {canMutate && (
          <button
            type="button"
            onClick={() => {
              setInitialTipo(tab === 'all' ? 'controle' : tab);
              setShowForm(true);
            }}
            className={BUTTON_PRIMARY}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Novo insumo
          </button>
        )}
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-8 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.06] mb-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`
                px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all
                ${
                  tab === t.id
                    ? 'border-violet-500 text-slate-900 dark:text-white/90'
                    : 'border-transparent text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70'
                }
              `}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtros + busca */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`
                  px-3 h-8 rounded-md text-xs font-medium transition-all
                  ${
                    statusFilter === s.id
                      ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white/90 shadow-sm'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/75'
                  }
                `}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="search"
              placeholder="Buscar por lote, fabricante ou nome comercial…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-3.5 h-9 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        {/* Erros */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {actionError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
            {actionError}
          </div>
        )}

        {/* Lista */}
        <div className="bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr,140px,120px,180px,160px] gap-4 px-5 py-2.5 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06] text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/35 font-medium">
            <div>Insumo</div>
            <div>Validade</div>
            <div>Abertura</div>
            <div>Situação</div>
            <div className="text-right">Ações</div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-white/40">
              Carregando…
            </div>
          ) : insumos.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-sm text-slate-500 dark:text-white/45">
                Nenhum insumo encontrado.
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setInitialTipo(tab === 'all' ? 'controle' : tab);
                    setShowForm(true);
                  }}
                  className="mt-3 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                >
                  Cadastrar o primeiro insumo →
                </button>
              )}
            </div>
          ) : (
            insumos.map((i) => (
              <InsumoRow
                key={i.id}
                insumo={i}
                canMutate={canMutate}
                onOpen={handleOpen}
                onClose={handleClose}
                onDescartar={handleDescartar}
              />
            ))
          )}
        </div>

        <div className="mt-4 text-xs text-slate-400 dark:text-white/30">
          {insumos.length} insumo{insumos.length !== 1 ? 's' : ''} exibido
          {insumos.length !== 1 ? 's' : ''}.
        </div>
      </main>

      {showForm && (
        <InsumoFormModal
          labId={activeLab.id}
          initialTipo={initialTipo}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
