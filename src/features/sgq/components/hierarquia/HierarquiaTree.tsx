/**
 * HierarquiaTree.tsx
 *
 * Hierarchical tree view: MQ-001 → PQs → ITs → FRs
 * Keyboard navigation + expand/collapse.
 * ARIA roles for accessibility.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HierarquiaNode } from './HierarquiaNode';
import { HierarquiaPath } from './HierarquiaPath';
import type { TipoDocumento } from '../lm/TipoDocumentoBadge';
import type { StatusVigencia } from '../lm/StatusVigenciaBadge';

/**
 * Tree document structure
 */
interface TreeNode {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoDocumento;
  status: StatusVigencia;
  children: TreeNode[];
}

interface HierarquiaTreeProps {
  data: TreeNode[];
  loading?: boolean;
  onNodeSelect?: (id: string) => void;
}

/**
 * Flatten tree into list with parent tracking
 */
function flattenTree(node: TreeNode, parentPath: TreeNode[] = []): { node: TreeNode; path: TreeNode[] }[] {
  const currentPath = [...parentPath, node];
  return [
    { node, path: parentPath },
    ...node.children.flatMap(child => flattenTree(child, currentPath)),
  ];
}

export function HierarquiaTree({ data, loading = false, onNodeSelect }: HierarquiaTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<TreeNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  // Default expand MQ and first level PQs
  const defaultExpanded = useMemo(() => {
    const result = new Set<string>();
    data.forEach(mq => {
      result.add(mq.id); // MQ expanded
      mq.children.forEach(pq => {
        result.add(pq.id); // PQs expanded
      });
    });
    return result;
  }, [data]);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const handleExpand = useCallback((id: string, isExpanded: boolean) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (isExpanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((id: string) => {
    // Find node in flattened tree to get path
    const flattened = data.flatMap(node => flattenTree(node));
    const found = flattened.find(item => item.node.id === id);

    if (found) {
      setSelectedPath(found.path);
      setSelectedNodeId(id);
      onNodeSelect?.(id);
    }
  }, [data, onNodeSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedNodeId) return;
    const flattened = data.flatMap(node => flattenTree(node));
    const currentIdx = flattened.findIndex(item => item.node.id === selectedNodeId);

    if (currentIdx === -1) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIdx < flattened.length - 1) {
          handleNodeClick(flattened[currentIdx + 1].node.id);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIdx > 0) {
          handleNodeClick(flattened[currentIdx - 1].node.id);
        }
        break;
      case 'ArrowRight': {
        e.preventDefault();
        const currentNode = flattened[currentIdx].node;
        if (currentNode.children.length > 0) {
          handleExpand(currentNode.id, true);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const currentNode = flattened[currentIdx].node;
        if (expanded.has(currentNode.id)) {
          handleExpand(currentNode.id, false);
        }
        break;
      }
    }
  }, [data, selectedNodeId, expanded, handleNodeClick, handleExpand]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60 text-sm">Nenhum documento encontrado na hierarquia</p>
      </div>
    );
  }

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expanded.has(node.id);
    const children = isExpanded ? node.children : [];

    return (
      <div key={node.id}>
        <HierarquiaNode
          id={node.id}
          codigo={node.codigo}
          titulo={node.titulo}
          tipo={node.tipo}
          status={node.status}
          hasChildren={node.children.length > 0}
          level={level}
          expanded={isExpanded}
          onExpand={handleExpand}
          onClick={handleNodeClick}
        />
        {children.map(child => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div
      className="space-y-2"
      role="tree"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Breadcrumb path if node selected */}
      {selectedPath.length > 0 && (
        <HierarquiaPath path={selectedPath} onNavigate={handleNodeClick} />
      )}

      {/* Tree nodes */}
      {data.map((mq, idx) => (
        <div key={mq.id}>
          {renderNode(mq, 0)}
        </div>
      ))}
    </div>
  );
}
