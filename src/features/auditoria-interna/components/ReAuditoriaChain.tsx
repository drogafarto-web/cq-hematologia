/**
 * ReAuditoriaChain — Visual tree of audit → re-audit progression
 *
 * Shows recursive chain:
 *   Original Audit
 *        ↓
 *   Re-audit 1
 *        ↓
 *   Re-audit 2
 *
 * Each node: card with status badge + date (criadoEm)
 * Connections: left border (violet-500/30)
 *
 * Hook: subscribe to `labs/{labId}/auditorias-internas` with filter
 * `auditoriaOriginalId == X`, recursively building the chain.
 *
 * Responsive: scrollable on tablet, fixed width on desktop.
 */

import React, { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeAuditorias } from '../services/auditoriaService';
import type { Auditoria } from '../types';

interface ReAuditoriaChainProps {
  auditoriaId: string;
  labId: string;
}

/**
 * ChainNode — represents a single audit in the chain
 * Includes depth for visual hierarchy + display order
 */
interface ChainNode {
  auditoria: Auditoria;
  depth: number; // 0 = original, 1 = first re-audit, etc
  children: ChainNode[];
}

export function ReAuditoriaChain({
  auditoriaId,
  labId,
}: ReAuditoriaChainProps) {
  const activeLabId = useActiveLabId();
  const [allAuditorias, setAllAuditorias] = useState<Auditoria[]>([]);
  const [chain, setChain] = useState<ChainNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to all auditorias in the lab
  useEffect(() => {
    if (!activeLabId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeAuditorias(
      activeLabId,
      (auditorias) => {
        setAllAuditorias(auditorias);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeLabId]);

  // Build chain from auditorias
  useEffect(() => {
    if (!allAuditorias.length) {
      setChain(null);
      return;
    }

    // Find the original audit
    const original = allAuditorias.find((a) => a.id === auditoriaId);
    if (!original) {
      setChain(null);
      return;
    }

    // Recursively build chain: original → re-audits
    const buildChain = (parentId: string, depth: number): ChainNode => {
      const audit = allAuditorias.find((a) => a.id === parentId);
      if (!audit) {
        throw new Error(`Audit ${parentId} not found`);
      }

      // Find all re-audits of this audit
      const reAudits = allAuditorias.filter(
        (a) => (a as any).auditoriaOriginalId === parentId
      );

      const children = reAudits
        .sort((a, b) => a.criadoEm.toDate().getTime() - b.criadoEm.toDate().getTime())
        .map((reAudit) => buildChain(reAudit.id, depth + 1));

      return { auditoria: audit, depth, children };
    };

    try {
      const builtChain = buildChain(auditoriaId, 0);
      setChain(builtChain);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setChain(null);
    }
  }, [allAuditorias, auditoriaId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="space-y-4 text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-white/60">Carregando cadeia de auditorias...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
        <p className="text-sm text-red-400">{error.message}</p>
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
        <p className="text-sm text-white/60">Nenhuma auditoria encontrada</p>
      </div>
    );
  }

  // Flatten chain for rendering (depth-first traversal)
  const flattenChain = (node: ChainNode): ChainNode[] => {
    return [node, ...node.children.flatMap(flattenChain)];
  };

  const flatChain = flattenChain(chain);

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white/90 mb-1">
          Histórico de Auditorias
        </h3>
        <p className="text-sm text-white/50">
          {flatChain.length === 1
            ? 'Auditoria original sem re-auditorias'
            : `${flatChain.length - 1} re-auditoria(s)`}
        </p>
      </div>

      {/* Chain visualization */}
      <div className="space-y-0">
        {flatChain.map((node, idx) => {
          const isLast = idx === flatChain.length - 1;
          const auditYear = node.auditoria.ano;
          const status = node.auditoria.status;
          const tipoExecucao = (node.auditoria as Auditoria & { tipoExecucao?: 'inicial' | 'reAuditoria' }).tipoExecucao || 'inicial';
          const criadoEm = node.auditoria.criadoEm.toDate();

          // Status badge config
          const statusConfig = {
            planejada: {
              label: 'Planejada',
              bg: 'bg-blue-500/10',
              text: 'text-blue-400',
              dot: 'bg-blue-500',
            },
            em_execução: {
              label: 'Em Execução',
              bg: 'bg-yellow-500/10',
              text: 'text-yellow-400',
              dot: 'bg-yellow-500',
            },
            finalizada: {
              label: 'Finalizada',
              bg: 'bg-emerald-500/10',
              text: 'text-emerald-400',
              dot: 'bg-emerald-500',
            },
          };

          const statusColors = statusConfig[status] || statusConfig.planejada;

          return (
            <div key={node.auditoria.id}>
              {/* Node */}
              <div
                className={`
                  relative p-4 rounded-lg border border-white/10
                  bg-white/5 hover:bg-white/10 transition-all
                  ${node.depth > 0 ? 'ml-8' : ''}
                `}
              >
                {/* Depth indicator (left bar for re-audits) */}
                {node.depth > 0 && (
                  <div className="absolute -left-8 top-0 bottom-0 w-0.5 border-l-2 border-violet-500/30" />
                )}

                {/* Content */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="text-base font-semibold text-white/90">
                        {tipoExecucao === 'reAuditoria' ? '↻ ' : ''}
                        Auditoria {auditYear}
                      </h4>
                      {node.depth > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                          Re-auditoria {node.depth}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-white/60">
                      Criada em {criadoEm.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusColors.bg} whitespace-nowrap`}
                  >
                    <div className={`w-2 h-2 rounded-full ${statusColors.dot}`} />
                    <span className={`text-xs font-medium ${statusColors.text}`}>
                      {statusColors.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Arrow to next node (if not last) */}
              {!isLast && (
                <div className={`relative h-4 flex items-center justify-center ${
                  node.depth > 0 ? 'ml-8' : ''
                }`}>
                  <div className="absolute w-0.5 h-full border-l-2 border-white/10" />
                  <div className="text-violet-500/50 text-lg">↓</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend (if there are re-audits) */}
      {flatChain.length > 1 && (
        <div className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 space-y-2">
          <div className="font-medium text-white/90 mb-3">Legenda:</div>
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 border-l-2 border-violet-500/30" />
            <span>Indicador visual de re-auditoria</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">↻</span>
            <span>Re-auditoria (baseada em achados fechados da auditoria anterior)</span>
          </div>
        </div>
      )}
    </div>
  );
}
