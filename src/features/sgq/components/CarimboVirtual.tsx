import { memo } from 'react';
import type { Documento, VersaoHistorico } from '../types/Documento';
import { STATUS_LABEL, TIPO_LABEL, formatVersao } from '../types/Documento';

interface Props {
  documento: Documento;
  versoes: VersaoHistorico[];
  labName: string;
  isLoading?: boolean;
}

function statusColor(status: string): string {
  switch (status) {
    case 'vigente':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'em_revisao':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'obsoleto':
      return 'border-white/10 bg-white/[0.02] text-white/30';
    default:
      return 'border-white/10 bg-white/[0.02] text-white/50';
  }
}

function tipoAlteracaoBadge(tipo: string): string {
  if (tipo === 'major') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
}

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  if (typeof (ts as any).toDate === 'function') {
    return (ts as any).toDate().toLocaleDateString('pt-BR');
  }
  if (ts instanceof Date) {
    return ts.toLocaleDateString('pt-BR');
  }
  return '—';
}

export const CarimboVirtual = memo(function CarimboVirtual({
  documento,
  versoes,
  labName,
  isLoading,
}: Props) {
  const statusBadge = statusColor(documento.status);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0F0F11] p-4 max-w-2xl">
      {/* Header principal */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
            {labName}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-sm text-white/90 font-semibold">
              {documento.codigo}
            </span>
            <span className="text-xs text-white/50">{TIPO_LABEL[documento.tipo]}</span>
          </div>
          <p className="text-sm text-white/80 mt-0.5 truncate">{documento.titulo}</p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge}`}
          >
            {STATUS_LABEL[documento.status]}
          </span>
          <span className="text-xs text-white/60 font-mono tabular-nums">
            {formatVersao(documento.versao)}
          </span>
        </div>
      </div>

      {/* Metadados */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-[11px]">
        <div className="flex gap-1">
          <span className="text-white/40">Emissão:</span>
          <span className="text-white/70">{formatDate(documento.dataEmissao)}</span>
        </div>
        <div className="flex gap-1">
          <span className="text-white/40">Próx. revisão:</span>
          <span className="text-white/70">{formatDate(documento.proximaRevisao)}</span>
        </div>
        {documento.elaboradoPor && (
          <div className="flex gap-1">
            <span className="text-white/40">Elaborado:</span>
            <span className="text-white/70">{documento.elaboradoPor}</span>
          </div>
        )}
        <div className="flex gap-1">
          <span className="text-white/40">Aprovado:</span>
          <span className="text-white/70">{documento.autoridadeEmitente || '—'}</span>
        </div>
      </div>

      {/* Histórico de versões */}
      {!isLoading && versoes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">
            Histórico de revisões
          </p>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {versoes.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-[11px] text-white/60">
                <span className="font-mono text-white/50 w-10 shrink-0">
                  {formatVersao(v.versao)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-medium uppercase shrink-0 ${tipoAlteracaoBadge(v.tipoAlteracao)}`}
                >
                  {v.tipoAlteracao === 'major' ? 'REV' : 'COR'}
                </span>
                <span className="text-white/40 shrink-0">{formatDate(v.data)}</span>
                <span className="truncate flex-1">{v.alteracao}</span>
                <span className="text-white/30 shrink-0 text-[10px]">
                  {v.elaboradoPor} → {v.aprovadoPor}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="h-3 w-32 bg-white/[0.04] rounded animate-pulse" />
        </div>
      )}
    </div>
  );
});
