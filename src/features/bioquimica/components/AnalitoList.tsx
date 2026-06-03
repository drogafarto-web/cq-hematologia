/**
 * bioquimica/components/AnalitoList.tsx
 *
 * Tabela de analitos com `tabular-nums` em colunas numéricas.
 * Dark-first; row component memoizado para amortizar re-render quando
 * apenas 1 row muda.
 */

import React, { memo } from 'react';
import type { Analito } from '../types';

export interface AnalitoListProps {
  analitos: Analito[];
  loading: boolean;
  onEdit: (a: Analito) => void;
  onDelete: (a: Analito) => void;
}

export function AnalitoList({ analitos, loading, onEdit, onDelete }: AnalitoListProps) {
  if (loading) return <ListSkeleton />;
  if (analitos.length === 0) return <EmptyState />;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.01]">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
            <th scope="col" className="px-4 py-3 font-medium">
              Nome
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Sigla
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Unidade
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-right">
              Range
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-right">
              CV alvo
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Método
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-right">
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {analitos.map((a) => (
            <AnalitoRow key={a.id} analito={a} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Row (memoized) ───────────────────────────────────────────────────────

interface AnalitoRowProps {
  analito: Analito;
  onEdit: (a: Analito) => void;
  onDelete: (a: Analito) => void;
}

const AnalitoRow = memo(function AnalitoRow({ analito, onEdit, onDelete }: AnalitoRowProps) {
  const { nome, sigla, unidade, rangeBiologico, cvAlvo, metodo, ativo, seedDefault } = analito;

  return (
    <tr className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-white/90 font-medium">{nome}</span>
          {seedDefault && (
            <span
              title="Analito padrão (carregado pelo sistema). Pode ser editado livremente."
              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 font-medium"
            >
              Seed
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-white/60 font-mono text-xs tabular-nums">{sigla ?? '—'}</td>
      <td className="px-3 py-3 text-white/70 tabular-nums">{unidade}</td>
      <td className="px-3 py-3 text-right text-white/80 tabular-nums">
        {rangeBiologico.min} – {rangeBiologico.max}
      </td>
      <td className="px-3 py-3 text-right text-white/70 tabular-nums">
        {cvAlvo !== undefined ? `${cvAlvo.toFixed(1)}%` : '—'}
      </td>
      <td className="px-3 py-3 text-white/60 text-xs">{metodo ?? '—'}</td>
      <td className="px-3 py-3">
        {ativo ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" aria-hidden />
            Inativo
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(analito)}
            aria-label={`Editar ${nome}`}
            className="px-2 py-1 text-xs text-white/60 hover:text-violet-300 hover:bg-violet-500/10 rounded-md transition-colors duration-150"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(analito)}
            aria-label={`Remover ${nome}`}
            className="px-2 py-1 text-xs text-white/60 hover:text-rose-300 hover:bg-rose-500/10 rounded-md transition-colors duration-150"
          >
            Remover
          </button>
        </div>
      </td>
    </tr>
  );
});

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-12 text-center">
      <svg
        className="w-12 h-12 mx-auto mb-4 text-white/20"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
      >
        <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M16 24h16M24 16v16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-sm text-white/60 font-medium">Nenhum analito cadastrado</p>
      <p className="text-xs text-white/40 mt-1">
        Carregue os 17 analitos padrão ou cadastre o primeiro manualmente.
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando analitos"
      className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-12 border-b border-white/[0.04] last:border-b-0 px-4 flex items-center gap-3 animate-pulse motion-reduce:animate-none"
        >
          <div className="h-3 w-32 bg-white/[0.05] rounded" />
          <div className="h-3 w-12 bg-white/[0.05] rounded" />
          <div className="h-3 w-16 bg-white/[0.05] rounded" />
          <div className="ml-auto h-3 w-20 bg-white/[0.05] rounded" />
        </div>
      ))}
    </div>
  );
}
