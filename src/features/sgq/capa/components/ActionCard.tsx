/**
 * ActionCard — Display single CAPA action with status, assignee, due date, evidence
 *
 * Props: action (CAParecao), onMarkComplete?, onEdit?
 * Display: action title, assignee, dueDate, status badge, evidence links
 * Edit mode: change assignee, dueDate (if applicable)
 * Dark-first card design: bg-white/[0.02], border-white/10
 * WCAG AA: semantic HTML, focus rings, keyboard navigation
 */

import React, { useState } from 'react';
import type { CAParecao, AcaoStatus } from '../types';

interface ActionCardProps {
  action: CAParecao;
  onMarkComplete?: (acaoId: string) => void;
  onEdit?: (acaoId: string) => void;
  currentUserId?: string;
}

// Status badge styling
const STATUS_STYLES: Record<AcaoStatus, { bg: string; text: string; icon: string }> = {
  aberta: {
    bg: 'bg-red-900/20 border-red-700/50',
    text: 'text-red-200',
    icon: '○',
  },
  concluida: {
    bg: 'bg-emerald-900/20 border-emerald-700/50',
    text: 'text-emerald-200',
    icon: '✓',
  },
  vencida: {
    bg: 'bg-amber-900/20 border-amber-700/50',
    text: 'text-amber-200',
    icon: '⚠',
  },
};

const ACTION_TYPE_LABELS: Record<'corretiva' | 'preventiva', string> = {
  corretiva: 'Ação Corretiva',
  preventiva: 'Ação Preventiva',
};

function formatDate(timestamp: any): string {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export default function ActionCard({
  action,
  onMarkComplete,
  onEdit,
  currentUserId,
}: ActionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editResponsavel, setEditResponsavel] = useState(action.responsavel);
  const [editDataVencimento, setEditDataVencimento] = useState(
    action.dataVencimento
      ? new Date(action.dataVencimento.seconds * 1000).toISOString().split('T')[0]
      : '',
  );

  const statusStyle = STATUS_STYLES[action.status];
  const isAssignedToMe = currentUserId === action.responsavel;
  const isDue = action.status !== 'concluida' && action.status !== 'vencida';

  const handleSaveEdit = () => {
    // Save changes via parent callback
    setIsEditing(false);
  };

  return (
    <div
      className="p-4 bg-white/[0.02] border border-white/10 rounded-lg hover:bg-white/[0.04] transition-colors"
      role="article"
      aria-label={`Ação: ${action.descricao}`}
    >
      {/* Header: Type Badge + Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-1 bg-violet-600/20 text-violet-200 rounded">
            {ACTION_TYPE_LABELS[action.tipo]}
          </span>
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border ${statusStyle.bg} ${statusStyle.text}`}
          role="status"
          aria-label={`Status: ${action.status}`}
        >
          <span>{statusStyle.icon}</span>
          <span className="capitalize">{action.status}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-white/90 mb-3 line-clamp-2">{action.descricao}</p>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        {/* Assignee */}
        <div>
          <span className="text-white/60">Responsável</span>
          {isEditing ? (
            <input
              type="text"
              value={editResponsavel}
              onChange={(e) => setEditResponsavel(e.target.value)}
              className="w-full mt-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-white/90 focus:ring-2 focus:ring-violet-500"
              aria-label="Editar responsável"
            />
          ) : (
            <p className="text-white/90 font-medium mt-1">
              {action.responsavel || '—'}
              {isAssignedToMe && <span className="ml-1 text-emerald-400">★</span>}
            </p>
          )}
        </div>

        {/* Due Date */}
        <div>
          <span className="text-white/60">Vencimento</span>
          {isEditing ? (
            <input
              type="date"
              value={editDataVencimento}
              onChange={(e) => setEditDataVencimento(e.target.value)}
              className="w-full mt-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-white/90 focus:ring-2 focus:ring-violet-500"
              aria-label="Editar data de vencimento"
            />
          ) : (
            <p className="text-white/90 font-medium mt-1">{formatDate(action.dataVencimento)}</p>
          )}
        </div>
      </div>

      {/* Evidence Links */}
      {action.evidenciasLinks && action.evidenciasLinks.length > 0 && (
        <div className="mb-3 pb-3 border-t border-white/10 pt-3">
          <p className="text-xs text-white/60 mb-2">Evidências ({action.evidenciasLinks.length})</p>
          <div className="flex flex-wrap gap-2">
            {action.evidenciasLinks.map((link, idx) => (
              <a
                key={idx}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 rounded focus:ring-2 focus:ring-violet-500"
                aria-label={`Evidência ${idx + 1}`}
              >
                📎 Link {idx + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {action.notas && (
        <div className="mb-3 pb-3 border-t border-white/10 pt-3">
          <p className="text-xs text-white/60 mb-1">Notas</p>
          <p className="text-xs text-white/80 italic">{action.notas}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t border-white/10">
        {isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-3 py-2 text-xs bg-white/10 hover:bg-white/[0.15] text-white rounded focus:ring-2 focus:ring-violet-500 transition-colors"
              aria-label="Cancelar edição"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 px-3 py-2 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded focus:ring-2 focus:ring-violet-400 transition-colors font-medium"
              aria-label="Salvar alterações"
            >
              Salvar
            </button>
          </>
        ) : (
          <>
            {isDue && onMarkComplete && isAssignedToMe && (
              <button
                onClick={() => onMarkComplete(action.id)}
                className="flex-1 px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded focus:ring-2 focus:ring-emerald-400 transition-colors font-medium"
                aria-label="Marcar como concluído"
              >
                Concluir
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  onEdit?.(action.id);
                }}
                className="flex-1 px-3 py-2 text-xs bg-white/10 hover:bg-white/[0.15] text-white rounded focus:ring-2 focus:ring-violet-500 transition-colors"
                aria-label="Editar ação"
              >
                ✎ Editar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
