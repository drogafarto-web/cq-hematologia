import { ManagementReview } from '../types';
import ReviewSection from './ReviewSection';

/**
 * ReviewDetail
 * Read-only display of a complete management review
 *
 * Shows all 15 sections, metadata, signature info
 */

interface ReviewDetailProps {
  review: ManagementReview;
  onClose?: () => void;
  onEdit?: () => void;
}

export default function ReviewDetail({ review, onClose, onEdit }: ReviewDetailProps) {
  const reviewDate = review.dataRevisao?.toDate?.() || new Date();
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(reviewDate);

  const allParticipants = [
    review.diretor,
    review.gerenteQualidade,
    ...review.participantes,
    ...(review.outrasCargos || [])
  ].filter((p) => p && p.trim());

  const statusLabel: Record<string, string> = {
    draft: 'Rascunho',
    submitted: 'Submetida',
    approved: 'Aprovada',
    archived: 'Arquivada'
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-yellow-500/10 text-yellow-400',
    submitted: 'bg-blue-500/10 text-blue-400',
    approved: 'bg-emerald-500/10 text-emerald-400',
    archived: 'bg-white/10 text-white/50'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-[#141417] rounded-lg border border-white/5 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Análise Crítica pela Direção — {review.year}
            </h1>
            <p className="text-white/60">DICQ 4.15</p>
          </div>

          <div className={`px-4 py-2 rounded-lg text-sm font-semibold border ${statusColor[review.status]}`}>
            {statusLabel[review.status]}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-white/10">
          <div>
            <p className="text-xs uppercase text-white/50 font-semibold mb-1">Data da Revisão</p>
            <p className="text-white">{formattedDate}</p>
          </div>

          <div>
            <p className="text-xs uppercase text-white/50 font-semibold mb-1">Diretor</p>
            <p className="text-white">{review.diretor || 'N/A'}</p>
          </div>

          <div>
            <p className="text-xs uppercase text-white/50 font-semibold mb-1">Gerente de Qualidade</p>
            <p className="text-white">{review.gerenteQualidade || 'N/A'}</p>
          </div>

          <div>
            <p className="text-xs uppercase text-white/50 font-semibold mb-1">Total de Participantes</p>
            <p className="text-white">{allParticipants.length} pessoas</p>
          </div>
        </div>

        {/* Participants List */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs uppercase text-white/50 font-semibold mb-3">Participantes</p>
          <div className="flex flex-wrap gap-2">
            {allParticipants.map((participant, idx) => (
              <div
                key={idx}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-sm text-white"
              >
                {participant}
              </div>
            ))}
          </div>
        </div>

        {/* Signature Info */}
        {review.chainHash && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
            <p className="text-xs uppercase text-white/50 font-semibold">Assinatura Digital</p>
            <div className="bg-white/5 rounded p-3 font-mono text-xs text-white/70 space-y-1 break-all">
              <div>
                <span className="text-white/50">Hash:</span> {review.chainHash.hash}
              </div>
              <div>
                <span className="text-white/50">Assinado por:</span> {review.chainHash.operatorId}
              </div>
              <div>
                <span className="text-white/50">Timestamp:</span>{' '}
                {review.chainHash.ts?.toDate?.()?.toLocaleString?.('pt-BR') || 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Related Atas */}
        {review.ataIds && review.ataIds.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs uppercase text-white/50 font-semibold mb-2">
              Atas de Reunião Associadas
            </p>
            <div className="space-y-2">
              {review.ataIds.map((ataId) => (
                <div
                  key={ataId}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white/70 font-mono"
                >
                  {ataId}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 15 Sections */}
      <div className="space-y-6">
        {review.entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-[#141417] rounded-lg border border-white/5 p-8"
          >
            <ReviewSection entry={entry} editable={false} />
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pb-8">
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-6 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors"
          >
            Editar
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
