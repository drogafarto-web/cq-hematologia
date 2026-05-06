/**
 * HierarquiaPath.tsx
 *
 * Breadcrumb navigation showing path from MQ to current node.
 */

interface PathNode {
  id: string;
  codigo: string;
  titulo: string;
}

interface HierarquiaPathProps {
  path: PathNode[];
  onNavigate?: (id: string) => void;
}

export function HierarquiaPath({ path, onNavigate }: HierarquiaPathProps) {
  if (path.length === 0) return null;

  return (
    <div className="flex items-center gap-2 py-3 px-4 bg-white/5 rounded-lg border border-white/10 overflow-x-auto">
      {path.map((node, idx) => (
        <div key={node.id} className="flex items-center gap-2 whitespace-nowrap">
          <button
            onClick={() => onNavigate?.(node.id)}
            className="text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            {node.codigo}
          </button>
          {idx < path.length - 1 && (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
