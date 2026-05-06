/**
 * HierarquiaNode.tsx
 *
 * Tree node component with type badge, código, título, status.
 * Expand/collapse state management.
 */

import { TipoDocumentoBadge, type TipoDocumento } from '../lm/TipoDocumentoBadge';
import { StatusVigenciaBadge, type StatusVigencia } from '../lm/StatusVigenciaBadge';

function ChevronDown({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

function ChevronRight({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}

interface HierarquiaNodeProps {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoDocumento;
  status: StatusVigencia;
  hasChildren?: boolean;
  level?: number;
  expanded?: boolean;
  onExpand?: (id: string, expanded: boolean) => void;
  onClick?: (id: string) => void;
}

export function HierarquiaNode({
  id,
  codigo,
  titulo,
  tipo,
  status,
  hasChildren = false,
  level = 0,
  expanded = false,
  onExpand,
  onClick,
}: HierarquiaNodeProps) {
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren && onExpand) {
      onExpand(id, !expanded);
    }
  };

  const paddingLeft = `${level * 24}px`;

  return (
    <div
      onClick={() => onClick?.(id)}
      className="group cursor-pointer"
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
    >
      <div
        className="px-3 py-2.5 hover:bg-white/5 transition-colors duration-150 rounded-lg border border-transparent hover:border-white/10 flex items-center gap-2"
        style={{ paddingLeft }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={handleToggle}
          className={`p-1 transition-colors duration-150 ${
            hasChildren ? 'text-white/40 hover:text-white/60' : 'text-white/20 cursor-default'
          } ${!hasChildren ? 'invisible' : ''}`}
          disabled={!hasChildren}
          aria-hidden={!hasChildren}
        >
          {expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TipoDocumentoBadge tipo={tipo} showLabel tooltip={false} className="flex-shrink-0" />
            <span className="font-mono text-xs text-white/70 flex-shrink-0">{codigo}</span>
          </div>
          <p className="text-sm text-white mt-1 truncate">{titulo}</p>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          <StatusVigenciaBadge status={status} showLabel={false} tooltip={false} />
        </div>
      </div>
    </div>
  );
}
