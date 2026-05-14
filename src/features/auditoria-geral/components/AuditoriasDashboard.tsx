import { useState } from 'react';
import { useAuditoriasGeral } from '../hooks/useAuditoriasGeral';
import { NovaAuditoriaDialog } from './NovaAuditoriaDialog';
import type { AuditoriaGeral, StatusAuditoria } from '../types';

interface Props {
  onSelect: (id: string) => void;
}

const statusConfig: Record<StatusAuditoria, { label: string; classes: string }> = {
  rascunho: { label: 'Rascunho', classes: 'bg-white/[0.08] text-white/60' },
  em_andamento: { label: 'Em andamento', classes: 'bg-violet-500/20 text-violet-400' },
  finalizada: { label: 'Finalizada', classes: 'bg-emerald-500/20 text-emerald-400' },
};

function formatDate(ts: { toDate: () => Date } | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AuditoriasDashboard({ onSelect }: Props) {
  const { auditorias, isLoading, error } = useAuditoriasGeral();
  const [dialogOpen, setDialogOpen] = useState(false);

  const stats = {
    total: auditorias.length,
    emAndamento: auditorias.filter((a) => a.status === 'em_andamento').length,
    finalizadas: auditorias.filter((a) => a.status === 'finalizada').length,
    scoreMedio: auditorias.length
      ? Math.round(auditorias.reduce((sum, a) => sum + a.scoreTotal, 0) / auditorias.length)
      : 0,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-violet-400/80 mb-1">
            RDC 978/2025
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Auditoria Geral</h1>
          <p className="text-sm text-white/40 mt-1">57 indicadores · Escala 0-5 · 12 blocos</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          aria-label="Criar nova auditoria"
        >
          Nova Auditoria
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={stats.total} label="Total" />
        <StatCard value={stats.emAndamento} label="Em andamento" />
        <StatCard value={stats.finalizadas} label="Finalizadas" />
        <StatCard value={`${stats.scoreMedio}%`} label="Score medio" />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          Erro ao carregar auditorias: {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando auditorias">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5 animate-pulse"
            >
              <div className="h-4 bg-white/[0.06] rounded w-1/3 mb-3" />
              <div className="h-3 bg-white/[0.04] rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : auditorias.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/30 text-sm">Nenhuma auditoria registrada</p>
          <p className="text-white/20 text-xs mt-1">
            Clique em "Nova Auditoria" para iniciar
          </p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {auditorias.map((auditoria) => (
            <AuditoriaCard key={auditoria.id} auditoria={auditoria} onSelect={onSelect} />
          ))}
        </ul>
      )}

      <NovaAuditoriaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          setDialogOpen(false);
          onSelect(id);
        }}
      />
    </div>
  );
}

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xl font-semibold font-mono tabular-nums">{value}</p>
      <p className="text-xs text-white/40 mt-0.5">{label}</p>
    </div>
  );
}

function AuditoriaCard({
  auditoria,
  onSelect,
}: {
  auditoria: AuditoriaGeral;
  onSelect: (id: string) => void;
}) {
  const badge = statusConfig[auditoria.status];

  return (
    <li>
      <button
        onClick={() => onSelect(auditoria.id)}
        className="w-full text-left bg-white/[0.02] border border-white/[0.06] rounded-lg p-5 hover:border-white/[0.12] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        aria-label={`Abrir auditoria: ${auditoria.titulo}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{auditoria.titulo}</p>
            <p className="text-xs text-white/40 mt-1">
              {auditoria.auditor.nome} · {formatDate(auditoria.dataInicio)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-medium tabular-nums text-white/60">
              {auditoria.scoreTotal}%
            </span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.classes}`}>
              {badge.label}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}