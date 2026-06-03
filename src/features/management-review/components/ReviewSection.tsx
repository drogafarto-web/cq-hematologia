import { ReviewEntry, REVIEW_SECTIONS } from '../types';

/**
 * ReviewSection
 * Reusable component for displaying a single review section
 *
 * Used in both:
 * - ReviewForm (editable)
 * - ReviewDetail (read-only)
 */

interface ReviewSectionProps {
  entry: ReviewEntry;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
}

export default function ReviewSection({
  entry,
  editable = false,
  onContentChange,
}: ReviewSectionProps) {
  const sectionDef = REVIEW_SECTIONS[entry.sectionNumber - 1];

  if (!sectionDef) {
    return <div className="text-red-500">Seção inválida: {entry.sectionNumber}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          {sectionDef.number}. {sectionDef.titlePt}
        </h3>
        <p className="text-xs text-white/50">{sectionDef.titleEn}</p>
      </div>

      {/* Source Data (if available) */}
      {entry.sourceData && Object.keys(entry.sourceData).length > 0 && (
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-md">
          <p className="text-xs uppercase font-semibold text-emerald-400 mb-3">
            Dados Pré-Populados
          </p>
          <div className="space-y-2">
            {Object.entries(entry.sourceData).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-white/70 capitalize">{formatKey(key)}:</span>
                <span className="font-mono font-semibold text-white/90">{formatValue(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {editable ? (
        <textarea
          value={entry.content}
          onChange={(e) => onContentChange?.(e.target.value)}
          placeholder="Escrever conteúdo da seção..."
          rows={8}
          className="w-full px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-violet-500 resize-none font-mono text-sm"
        />
      ) : (
        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-md whitespace-pre-wrap text-white text-sm leading-relaxed">
          {entry.content || <span className="text-white/40 italic">Sem conteúdo</span>}
        </div>
      )}

      {/* Character Count */}
      <div className="text-xs text-white/50 text-right">{entry.content.length} caracteres</div>

      {/* Notes (if any) */}
      {entry.notes && (
        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-md text-sm text-blue-300">
          <span className="font-semibold">Notas:</span> {entry.notes}
        </div>
      )}
    </div>
  );
}

/**
 * Helper: Format key names for display
 */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Helper: Format values for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.length > 0 ? `[${value.length} itens]` : '[]';
    }
    return JSON.stringify(value, null, 2);
  }

  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }

  return String(value);
}
