/**
 * bioquimica/components/AnalitoAdmin.tsx
 *
 * Tela de administração de analitos do módulo bioquimica.
 * Lista + filtros + busca + form modal de criar/editar + soft-delete (RN-06).
 *
 * Wireup:
 *   - Real-time via `useAnalitos` (onSnapshot listener)
 *   - Mutations via `analitoService` (client-direct até Plan 09-04)
 *   - Seed via callable `seedBioquimicaDefaults`
 *
 * Design: dark-first (#141417), accent violet-500, transições 150-200ms.
 * A11y AA: contraste, foco visível, navegação por teclado, aria-labels.
 *
 * Soft-delete only — confirma antes de remover. Histórico preservado.
 */

import React, { useMemo, useState } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { useAnalitos } from '../hooks/useAnalitos';
import { createAnalito, softDeleteAnalito, updateAnalito } from '../services/analitoService';
import { httpsCallable, functions } from '../../../shared/services/firebase';
import type { Analito, AnalitoInput } from '../types';
import { AnalitoForm } from './AnalitoForm';
import { AnalitoList } from './AnalitoList';

type Filter = 'todos' | 'ativos' | 'inativos';

interface SeedResponse {
  created: number;
  skipped: number;
  total: number;
}

export function AnalitoAdmin() {
  const labId = useActiveLabId();
  const user = useUser();
  const goBack = useAppStore((s) => s.goBack);
  const { analitos, loading, error } = useAnalitos();

  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Analito | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Analito | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [seedingState, setSeedingState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [seedSummary, setSeedSummary] = useState<SeedResponse | null>(null);

  // ── Filtro + busca em memória ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return analitos.filter((a) => {
      if (filter === 'ativos' && !a.ativo) return false;
      if (filter === 'inativos' && a.ativo) return false;
      if (term.length === 0) return true;
      return (
        a.nome.toLowerCase().includes(term) ||
        (a.sigla?.toLowerCase().includes(term) ?? false) ||
        (a.metodo?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [analitos, filter, search]);

  const ativosCount = useMemo(() => analitos.filter((a) => a.ativo).length, [analitos]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (a: Analito) => {
    setEditing(a);
    setShowForm(true);
  };

  const handleSubmit = async (input: AnalitoInput) => {
    if (!labId) throw new Error('Lab ativo é obrigatório');
    setActionError(null);
    if (editing) {
      await updateAnalito(labId, editing.id, input);
    } else {
      await createAnalito(labId, input);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete || !labId || !user) return;
    setActionError(null);
    try {
      await softDeleteAnalito(labId, confirmDelete.id, user.uid);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao remover');
    }
  };

  const handleSeed = async () => {
    if (!labId) return;
    setActionError(null);
    setSeedingState('loading');
    try {
      const callable = httpsCallable<{ labId: string }, SeedResponse>(
        functions,
        'seedBioquimicaDefaults',
      );
      const result = await callable({ labId });
      setSeedSummary(result.data);
      setSeedingState('done');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha no seed');
      setSeedingState('idle');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (!labId) {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center px-4">
        <p className="text-white/50 text-sm">
          Selecione um laboratório ativo para gerenciar analitos.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
              aria-label="Voltar"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M12 5l-5 5 5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Voltar
            </button>
            <p className="text-[10px] font-bold tracking-widest uppercase text-violet-400/80 mb-1">
              Bioquímica · Administração
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Analitos</h1>
            <p className="text-sm text-white/40 mt-1">
              {analitos.length} cadastrado{analitos.length !== 1 ? 's' : ''}
              <span className="mx-1.5 text-white/20">·</span>
              <span className="tabular-nums">{ativosCount}</span> ativos
            </p>
          </div>

          <div className="flex items-center gap-2">
            {analitos.length === 0 && (
              <button
                type="button"
                onClick={handleSeed}
                disabled={seedingState === 'loading'}
                className="px-3 py-2 text-sm rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition-colors duration-150 disabled:opacity-50"
              >
                {seedingState === 'loading' ? 'Carregando seeds…' : 'Carregar 17 padrão'}
              </button>
            )}
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-violet-500 hover:bg-violet-400 text-white transition-colors duration-150"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              Novo analito
            </button>
          </div>
        </header>

        {/* Filtros + busca */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div
            role="tablist"
            aria-label="Filtrar por status"
            className="inline-flex p-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]"
          >
            {(['todos', 'ativos', 'inativos'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-[5px] transition-colors duration-150 ${
                  filter === f ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white/70'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'ativos' ? 'Ativos' : 'Inativos'}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
            >
              <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12.5 12.5l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, sigla, método…"
              aria-label="Buscar analitos"
              className="w-full h-9 pl-9 pr-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/30 transition-colors duration-150"
            />
          </div>
        </div>

        {/* Errors */}
        {(error || actionError) && (
          <div
            role="alert"
            className="px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
          >
            {actionError ?? error?.message}
          </div>
        )}

        {/* Seed feedback */}
        {seedSummary && (
          <div
            role="status"
            className="px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm"
          >
            Seed concluído — {seedSummary.created} criado{seedSummary.created !== 1 ? 's' : ''},{' '}
            {seedSummary.skipped} já existia{seedSummary.skipped !== 1 ? 'm' : ''}.
          </div>
        )}

        {/* List */}
        <AnalitoList
          analitos={filtered}
          loading={loading}
          onEdit={handleEdit}
          onDelete={(a) => setConfirmDelete(a)}
        />
      </div>

      {/* Form modal */}
      {showForm && (
        <AnalitoForm
          analito={editing}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmDeleteDialog
          analito={confirmDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  analito,
  onConfirm,
  onCancel,
}: {
  analito: Analito;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 motion-reduce:backdrop-blur-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-[#141417] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 id="confirm-title" className="text-lg font-semibold text-white">
          Remover analito?
        </h2>
        <p className="text-sm text-white/60">
          <span className="text-white/80 font-medium">{analito.nome}</span> será marcado como
          removido. Histórico de runs e estatísticas permanecem para auditoria (RN-06).
        </p>
        <p className="text-xs text-white/40">
          Esta ação pode ser revertida apenas via super-admin.
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm text-white/70 hover:text-white/90 rounded-md transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm();
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/40 text-white rounded-md transition-colors duration-150"
          >
            {submitting ? 'Removendo…' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AnalitoAdmin;
