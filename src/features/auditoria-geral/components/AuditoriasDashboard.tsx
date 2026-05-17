import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { toast } from '../../../shared/store/useToastStore';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAuditoriasGeral } from '../hooks/useAuditoriasGeral';
import { ComparativoAuditorias } from './ComparativoAuditorias';
import { NovaAuditoriaDialog } from './NovaAuditoriaDialog';
import type { AuditoriaGeral, StatusAuditoria } from '../types';

interface Props {
  onSelect: (id: string) => void;
}

const statusConfig: Record<StatusAuditoria, { label: string; classes: string }> = {
  rascunho: { label: 'Rascunho', classes: 'bg-slate-100 text-slate-600 dark:bg-white/[0.10] dark:text-white/70' },
  em_andamento: { label: 'Em andamento', classes: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400' },
  finalizada: { label: 'Finalizada', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
};

function formatDate(ts: { toDate: () => Date } | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AuditoriasDashboard({ onSelect }: Props) {
  const labId = useActiveLabId();
  const { auditorias, isLoading, error } = useAuditoriasGeral();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showComparativo, setShowComparativo] = useState(false);

  const finalizadas = auditorias.filter((a) => a.status === 'finalizada');
  const hasComparativo = finalizadas.length >= 2;

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
          <p className="text-[10px] font-bold tracking-widest uppercase text-violet-600 dark:text-violet-400/80 mb-1">
            RDC 978/2025
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Auditoria Geral</h1>
          <p className="text-sm text-slate-500 dark:text-white/60 mt-1">57 indicadores · Escala 0-5 · 12 blocos</p>
        </div>
        <div className="flex items-center gap-2">
          {hasComparativo && (
            <button
              onClick={() => setShowComparativo((v) => !v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                showComparativo
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-800 dark:bg-white/[0.04] dark:text-white/60 dark:hover:text-white/80'
              }`}
              aria-label="Ver comparativo entre auditorias"
            >
              Comparativo
            </button>
          )}
          <button
            onClick={() => setDialogOpen(true)}
            className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            aria-label="Criar nova auditoria"
          >
            Nova Auditoria
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={stats.total} label="Total" />
        <StatCard value={stats.emAndamento} label="Em andamento" />
        <StatCard value={stats.finalizadas} label="Finalizadas" />
        <StatCard value={`${stats.scoreMedio}%`} label="Score medio" />
      </div>

      {showComparativo && hasComparativo && (
        <ComparativoAuditorias auditorias={auditorias} />
      )}

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
              className="bg-slate-100 border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06] rounded-lg p-5 animate-pulse"
            >
              <div className="h-4 bg-slate-200 dark:bg-white/[0.06] rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-200 dark:bg-white/[0.04] rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : auditorias.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-500 dark:text-violet-400">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-slate-700 dark:text-white/80 text-sm font-medium">Nenhuma auditoria registrada</p>
            <p className="text-slate-500 dark:text-white/50 text-xs mt-1 max-w-sm mx-auto">
              Inicie sua primeira auditoria interna conforme RDC 978/2025. O sistema guiará você pelos 57 indicadores organizados em 12 blocos.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-lg p-4 max-w-md mx-auto text-left space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/30">Próximos passos</p>
            <ol className="text-xs text-slate-600 dark:text-white/60 space-y-1.5 list-decimal list-inside">
              <li>Clique em <strong>"Nova Auditoria"</strong> para definir escopo e critérios</li>
              <li>Selecione os blocos a auditar (A-L)</li>
              <li>Percorra os indicadores no modo Guiado ou Expert</li>
              <li>Ao finalizar, o sistema gera relatório PDF e plano de ação</li>
            </ol>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-2 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium transition-colors"
          >
            + Nova Auditoria
          </button>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {auditorias.map((auditoria) => (
            <AuditoriaCard key={auditoria.id} auditoria={auditoria} labId={labId!} onSelect={onSelect} />
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
    <div className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-4">
      <p className="text-3xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">{label}</p>
    </div>
  );
}

function AuditoriaCard({
  auditoria,
  labId,
  onSelect,
}: {
  auditoria: AuditoriaGeral;
  labId: string;
  onSelect: (id: string) => void;
}) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const badge = statusConfig[auditoria.status];

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const fn = httpsCallable<{ labId: string; auditoriaId: string }, { pdf: string }>(
        functions,
        'generateAuditoriaGeralPDF',
      );
      const result = await fn({ labId, auditoriaId: auditoria.id });
      const byteChars = atob(result.data.pdf);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria-geral-${auditoria.titulo}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <li>
      <button
        onClick={() => onSelect(auditoria.id)}
        className="w-full text-left bg-white border border-slate-200 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-lg p-5 hover:border-slate-300 dark:hover:border-white/[0.14] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        aria-label={`Abrir auditoria: ${auditoria.titulo}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-slate-900 dark:text-white">{auditoria.titulo}</p>
            <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
              {auditoria.auditor.nome} · {formatDate(auditoria.dataInicio)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {auditoria.status === 'finalizada' && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/60 transition-colors disabled:opacity-50"
                aria-label="Baixar PDF da auditoria"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6M9 15l3 3 3-3" />
                </svg>
                {generatingPdf ? '...' : 'PDF'}
              </button>
            )}
            <span className="text-sm font-medium tabular-nums text-slate-700 dark:text-white/80">
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