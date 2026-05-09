/**
 * CargosOrgChart.tsx — SA-33
 *
 * Hierarchical org chart showing job positions.
 * Responsive: tree view on desktop, list on mobile.
 * Dark-first design with hover descriptions.
 */

import { useMemo, useState } from 'react';
import { useCargos } from '../../hooks/useCargos';

interface CargosOrgChartProps {}

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
        transition: 'transform 150ms ease-out',
      }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

interface CargoNode {
  id: string;
  titulo: string;
  descricao?: string;
  setor: string;
  nivel: number;
  children: CargoNode[];
}

function buildHierarchy(cargos: any[], parentId: string | null = null, nivel = 0): CargoNode[] {
  return cargos
    .filter((c) => (c.parentCargoId || null) === parentId && !c.deletedAt)
    .map((cargo) => ({
      id: cargo.id,
      titulo: cargo.titulo,
      descricao: cargo.descricao,
      setor: cargo.setor,
      nivel,
      children: buildHierarchy(cargos, cargo.id, nivel + 1),
    }));
}

function getSectorBadgeColor(setor: string): string {
  switch (setor.toLowerCase()) {
    case 'direção':
      return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
    case 'análise':
      return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'coleta':
      return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
    case 'qualidade':
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'administrativo':
      return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
  }
}

function CargoTreeNode({
  node,
  isLast = true,
  isRoot = false,
}: {
  node: CargoNode;
  isLast?: boolean;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-2 py-2">
        {/* Tree lines (desktop only) */}
        {!isRoot && (
          <div className="flex flex-col items-center w-6 flex-shrink-0 pt-1">
            <div
              className={`w-4 h-px ${isLast ? 'ml-0' : 'ml-0'} bg-white/20`}
              style={{
                width: '16px',
                marginRight: '8px',
                marginTop: '8px',
              }}
            />
          </div>
        )}

        {/* Node */}
        <div className="flex-1 min-w-0">
          <div
            className={`p-3 rounded-lg border transition-all ${
              node.nivel === 0
                ? 'bg-violet-500/10 border-violet-500/30 shadow-lg shadow-violet-500/10'
                : node.nivel === 1
                  ? 'bg-white/5 border-white/15 hover:bg-white/8'
                  : 'bg-white/3 border-white/10 hover:bg-white/5'
            } group cursor-default`}
          >
            <div className="flex items-start gap-3">
              {hasChildren && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                  aria-label={expanded ? 'Recolher' : 'Expandir'}
                >
                  <ChevronIcon collapsed={!expanded} />
                </button>
              )}
              {!hasChildren && <div className="w-5" />}

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">
                  {node.titulo}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getSectorBadgeColor(node.setor)}`}>
                    {node.setor}
                  </span>
                </div>
                {node.descricao && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 group-hover:line-clamp-none transition-all">
                    {node.descricao}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Children */}
          {hasChildren && expanded && (
            <div className="ml-6 border-l border-white/10 pl-4 mt-2 space-y-0">
              {node.children.map((child, i) => (
                <CargoTreeNode
                  key={child.id}
                  node={child}
                  isLast={i === node.children.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrgChartList({ nodes }: { nodes: CargoNode[] }) {
  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <CargoTreeNode key={node.id} node={node} isRoot={true} />
      ))}
    </div>
  );
}

export function CargosOrgChart({}: CargosOrgChartProps) {
  const { cargos, loading, error } = useCargos();
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const hierarchy = useMemo(() => {
    if (!cargos.length) return [];
    return buildHierarchy(cargos);
  }, [cargos]);

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
        <p className="text-sm font-medium">Erro ao carregar cargos</p>
        <p className="text-xs text-red-400 mt-1">{error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-slate-700/20 rounded-lg border border-slate-700/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (cargos.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">Nenhum cargo cadastrado</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'tree'
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Árvore
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Lista
          </button>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
        >
          <PrintIcon />
          Exportar PDF
        </button>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-white/10 p-6 bg-white/2">
        {hierarchy.length > 0 ? (
          <OrgChartList nodes={hierarchy} />
        ) : (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">Nenhum cargo raiz encontrado</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span className="text-slate-400">Direção</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-slate-400">Análise</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400" />
          <span className="text-slate-400">Coleta</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Qualidade</span>
        </div>
      </div>
    </div>
  );
}
