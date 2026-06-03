import React from 'react';
import { useEvidenciasAgregadas } from '../hooks/useEvidenciasAgregadas';
import type { EvidenciaAgregada } from '../services/evidenceAggregatorService';
import {
  X,
  FileText,
  ClipboardList,
  Award,
  BarChart3,
  Activity,
  Camera,
  RefreshCw,
  ExternalLink,
  Inbox,
} from 'lucide-react';

interface EvidencePanelProps {
  indicadorId: string;
  labId: string;
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<EvidenciaAgregada['tipo'], React.ReactNode> = {
  documento: <FileText className="w-4 h-4" />,
  registro: <ClipboardList className="w-4 h-4" />,
  certificado: <Award className="w-4 h-4" />,
  relatorio: <BarChart3 className="w-4 h-4" />,
  indicador: <Activity className="w-4 h-4" />,
  foto: <Camera className="w-4 h-4" />,
};

const STATUS_STYLES: Record<
  EvidenciaAgregada['status'],
  { bg: string; text: string; label: string }
> = {
  vigente: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Vigente' },
  vencido: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Vencido' },
  pendente: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pendente' },
  'nao-encontrado': { bg: 'bg-white/10', text: 'text-white/60', label: 'Não encontrado' },
};

function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-2 p-3 border border-white/10 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-white/10 rounded" />
        <div className="h-4 bg-white/10 rounded w-3/4" />
      </div>
      <div className="h-3 bg-white/10 rounded w-1/2" />
      <div className="h-5 bg-white/10 rounded w-16" />
    </div>
  );
}

export function EvidencePanel({ indicadorId, labId, isOpen, onClose }: EvidencePanelProps) {
  const { evidencias, loading, error, refetch } = useEvidenciasAgregadas(indicadorId, labId);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <aside
        role="complementary"
        aria-label="Painel de evidências"
        className="fixed top-0 right-0 h-full w-full max-w-md bg-[#1c1c20] border-l border-white/10 z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white/90">Evidências</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              aria-label="Atualizar evidências"
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/90 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar painel de evidências"
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/90 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {error && (
            <div className="text-red-400 text-sm p-3 border border-red-500/30 rounded-lg bg-red-900/20">
              Erro ao carregar evidências: {error.message}
            </div>
          )}

          {!loading && !error && evidencias.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-white/50 space-y-3">
              <Inbox className="w-10 h-10" />
              <p className="text-sm text-center">Nenhuma evidência encontrada neste módulo</p>
            </div>
          )}

          {!loading &&
            evidencias.map((ev) => {
              const statusStyle = STATUS_STYLES[ev.status];
              return (
                <a
                  key={ev.id}
                  href={ev.linkDireto}
                  className="block p-3 border border-white/10 rounded-lg hover:bg-white/5 transition group focus:outline-none focus:ring-2 focus:ring-violet-500"
                  aria-label={`${ev.titulo} - ${statusStyle.label}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-violet-400 mt-0.5 shrink-0">{TYPE_ICONS[ev.tipo]}</span>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/90 truncate">
                          {ev.titulo}
                        </span>
                        <ExternalLink className="w-3 h-3 text-white/40 opacity-0 group-hover:opacity-100 transition shrink-0" />
                      </div>

                      <p className="text-xs text-white/50">
                        {ev.dataRegistro.toLocaleDateString('pt-BR')}
                      </p>

                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        {statusStyle.label}
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
        </div>
      </aside>
    </>
  );
}
