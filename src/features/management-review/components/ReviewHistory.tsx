import { useManagementReview } from '../hooks/useManagementReview';
import { ManagementReview, ReviewStatus } from '../types';

/**
 * ReviewHistory
 * Displays all past reviews organized by year
 *
 * Shows: year, director, date, status, participant count
 * Click to view details
 */

interface ReviewHistoryProps {
  onSelectReview?: (reviewId: string) => void;
}

export default function ReviewHistory({ onSelectReview }: ReviewHistoryProps) {
  const { reviews, byYear, loading, error } = useManagementReview();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-4"></div>
          <p className="text-white/70">Carregando histórico de revisões...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-red-400">Erro ao carregar histórico: {error}</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="p-8 bg-white/5 border border-white/10 rounded-lg text-center">
        <p className="text-white/60">Nenhuma revisão encontrada</p>
      </div>
    );
  }

  // Sort years descending (most recent first)
  const sortedYears = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      {sortedYears.map((year) => (
        <div key={year}>
          <h3 className="text-lg font-semibold text-white mb-4">
            {year}
          </h3>

          <div className="space-y-3">
            {byYear[year].map((review) => (
              <ReviewHistoryCard
                key={review.id}
                review={review}
                onSelect={() => onSelectReview?.(review.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ReviewHistoryCardProps {
  review: ManagementReview;
  onSelect?: () => void;
}

function ReviewHistoryCard({ review, onSelect }: ReviewHistoryCardProps) {
  const statusColor: Record<ReviewStatus, string> = {
    draft: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    submitted: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    approved: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    archived: 'bg-white/10 border-white/10 text-white/50'
  };

  const statusLabel: Record<ReviewStatus, string> = {
    draft: 'Rascunho',
    submitted: 'Submetida',
    approved: 'Aprovada',
    archived: 'Arquivada'
  };

  const reviewDate = review.dataRevisao?.toDate?.() || new Date();
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(reviewDate);

  const allParticipants = [
    review.diretor,
    review.gerenteQualidade,
    ...review.participantes,
    ...(review.outrasCargos || [])
  ].filter((p) => p && p.trim());

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-white mb-1">
            Análise Crítica — {review.year}
          </h4>
          <p className="text-sm text-white/60">
            {formattedDate}
          </p>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor[review.status]}`}>
          {statusLabel[review.status]}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5">
        <div>
          <p className="text-xs uppercase text-white/50 font-semibold mb-1">Diretor</p>
          <p className="text-sm text-white">{review.diretor || 'N/A'}</p>
        </div>

        <div>
          <p className="text-xs uppercase text-white/50 font-semibold mb-1">Gerente QA</p>
          <p className="text-sm text-white">{review.gerenteQualidade || 'N/A'}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="text-xs uppercase text-white/50 font-semibold mb-2">
          Participantes: {allParticipants.length}
        </p>
        <div className="flex flex-wrap gap-2">
          {allParticipants.slice(0, 3).map((participant, idx) => (
            <span
              key={idx}
              className="px-2 py-1 bg-white/10 border border-white/10 rounded text-xs text-white/70"
            >
              {participant}
            </span>
          ))}
          {allParticipants.length > 3 && (
            <span className="px-2 py-1 text-xs text-white/50">
              +{allParticipants.length - 3} mais
            </span>
          )}
        </div>
      </div>

      {review.chainHash && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-white/50 font-mono">
            Assinado por: <span className="text-white/70">{review.chainHash.operatorId}</span>
          </p>
        </div>
      )}
    </button>
  );
}
