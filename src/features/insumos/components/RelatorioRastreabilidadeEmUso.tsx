/**
 * RelatorioRastreabilidadeEmUso — tabela de lotes ativos com rastreabilidade completa.
 *
 * Mostra: quem abriu cada lote, quando, código Worklab, dias em uso, etc.
 * Essencial para auditoria operacional (RDC 786/2023, RDC 978/2025).
 */

import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { Insumo } from '../types/Insumo';
import { useInsumos } from '../hooks/useInsumos';
import { useProdutos } from '../hooks/useProdutos';

export function RelatorioRastreabilidadeEmUso({ labId }: { labId: string }) {
  const { insumos: insumosRaw, isLoading } = useInsumos({ status: 'ativo' });
  const { produtos } = useProdutos();

  const produtoById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of produtos) m.set(p.id, p);
    return m;
  }, [produtos]);

  const insumos = useMemo(() => {
    return insumosRaw.sort((a, b) => {
      const tsA = (a.abertoPor?.timestamp as Timestamp)?.toMillis?.() ?? 0;
      const tsB = (b.abertoPor?.timestamp as Timestamp)?.toMillis?.() ?? 0;
      return tsB - tsA; // Mais recentes primeiro
    });
  }, [insumosRaw]);

  function formatTimestamp(ts: Timestamp | undefined): string {
    if (!ts) return '—';
    const date = ts.toDate?.();
    if (!date) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function calcularDiasEmUso(ts: Timestamp | undefined): number {
    if (!ts) return 0;
    const date = ts.toDate?.();
    if (!date) return 0;
    const agora = new Date();
    const diffMs = agora.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando lotes em uso...</div>;
  }

  if (insumos.length === 0) {
    return <div className="p-8 text-center text-slate-500">Nenhum lote ativo no momento.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/[0.08]">
            <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Insumo
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Lote
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Aberto por
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Data/Hora da abertura
            </th>
            <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Dias em uso
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Código Worklab (1º exame)
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-white/60 text-xs uppercase tracking-wider">
              Validade
            </th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((i) => {
            const produto = i.produtoId ? produtoById.get(i.produtoId) : undefined;
            const diasEmUso = calcularDiasEmUso(i.abertoPrimeiraVezEm as Timestamp);
            const mostrarAlertaDias = diasEmUso > 30;

            return (
              <tr
                key={i.id}
                className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white/90">
                  <div>{produto?.nomeComercial || i.nomeComercial}</div>
                  <div className="text-xs text-slate-500 dark:text-white/40">
                    {produto?.fabricante}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100/50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300">
                    {i.tipo === 'controle'
                      ? 'Controle'
                      : i.tipo === 'reagente'
                        ? 'Reagente'
                        : 'Tira Uro'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white/90">
                  {i.lote}
                </td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white/90">
                  <div>{i.abertoPor?.operadorName || '—'}</div>
                  <div className="text-xs text-slate-500 dark:text-white/40">
                    UID: {i.abertoPor?.operadorId?.slice(0, 8) || '—'}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white/90 font-mono">
                  {formatTimestamp(i.abertoPor?.timestamp as Timestamp | undefined)}
                </td>
                <td className="px-4 py-3 text-sm text-center font-medium">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                      mostrarAlertaDias
                        ? 'bg-amber-100/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100/50 dark:bg-white/[0.05] text-slate-700 dark:text-white/70'
                    }`}
                  >
                    {diasEmUso} {diasEmUso === 1 ? 'dia' : 'dias'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white/90">
                  {i.primeiroExameWorklab || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white/90">
                  {(i.validade as Timestamp)?.toDate?.()?.toLocaleDateString('pt-BR') || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
