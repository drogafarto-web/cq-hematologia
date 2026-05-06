/**
 * personnel/components/OrgChart.tsx
 *
 * Tree visualization of organizational hierarchy.
 * Diretor → RT → Técnicos structure.
 */

import React, { useState } from 'react';
import type { OrgChartNode } from '../types';
import { DesignacaoCard } from './DesignacaoCard';

interface OrgChartProps {
  nodes: OrgChartNode[];
}

function OrgChartNodeComponent({ node }: { node: OrgChartNode }): React.ReactElement {
  const [expanded, setExpanded] = useState(true);
  const [selectedDesignacaoId, setSelectedDesignacaoId] = useState<string | null>(null);

  const hasChildren = (node.filhos?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Node Card */}
      <button
        onClick={() => {
          if (node.designacaoId) {
            setSelectedDesignacaoId(node.designacaoId);
          }
        }}
        className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
      >
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-white">{node.titulo}</div>
          {node.nome ? (
            <div className="mt-1 text-xs text-white/60">{node.nome}</div>
          ) : (
            <div className="mt-1 text-xs text-amber-500">Vago</div>
          )}
        </div>

        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-white/40 hover:text-white"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </button>

      {/* Children (if expanded) */}
      {expanded && hasChildren && (
        <div className="ml-6 border-l border-white/10 py-2 pl-4">
          {node.filhos!.map((child) => (
            <div key={child.cargoId} className="mb-4">
              <OrgChartNodeComponent node={child} />
            </div>
          ))}
        </div>
      )}

      {/* Detail Panel (Modal) */}
      {selectedDesignacaoId && (
        <DesignacaoDetail
          designacaoId={selectedDesignacaoId}
          onClose={() => setSelectedDesignacaoId(null)}
        />
      )}
    </div>
  );
}

function DesignacaoDetail({
  designacaoId,
  onClose,
}: {
  designacaoId: string;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-96 w-full max-w-md overflow-y-auto rounded-lg bg-[#1a1a1d] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Designação</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">
          <DesignacaoCard designacaoId={designacaoId} />
        </div>
      </div>
    </div>
  );
}

export function OrgChart({ nodes }: OrgChartProps): React.ReactElement {
  if (nodes.length === 0) {
    return <div className="text-center text-white/60">Nenhum cargo configurado</div>;
  }

  return (
    <div className="space-y-6">
      {nodes.map((node) => (
        <div key={node.cargoId}>
          <OrgChartNodeComponent node={node} />
        </div>
      ))}
    </div>
  );
}
