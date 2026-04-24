import { useMemo } from 'react';

import { useCertificados } from '../hooks/useCertificados';
import { useTreinamentos } from '../hooks/useTreinamentos';

export interface CertificadoViewerProps {
  colaboradorId: string;
  colaboradorNome: string;
}

/**
 * Lista certificados emitidos para um colaborador (Fase 9). Botão "Gerar
 * certificado" é acionado do prontuário em contexto de uma avaliação de
 * competência aprovada.
 */
export function CertificadoViewer({ colaboradorId, colaboradorNome }: CertificadoViewerProps) {
  const { certificados, isLoading } = useCertificados({ colaboradorId });
  const { treinamentos } = useTreinamentos({ includeDeleted: true });

  const treinamentoMap = useMemo(() => new Map(treinamentos.map((t) => [t.id, t])), [treinamentos]);

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded border border-slate-800 bg-slate-900/40" />;
  }
  if (certificados.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
        Nenhum certificado emitido para {colaboradorNome} ainda.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {certificados.map((c) => {
        const t = treinamentoMap.get(c.treinamentoId);
        return (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">
                {t?.titulo ?? 'Treinamento removido'}
              </p>
              <p className="text-[10px] text-slate-500">
                Emitido em {c.emitidoEm.toDate().toLocaleDateString('pt-BR')} · ID{' '}
                <code className="text-[10px]">{c.id.slice(0, 8)}…</code>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={c.pdfDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 px-2 py-1 text-xs text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/10"
              >
                PDF
              </a>
              <a
                href={c.qrCodePayload}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Verificar
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
