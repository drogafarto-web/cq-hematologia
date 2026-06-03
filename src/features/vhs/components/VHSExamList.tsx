import { useState, useEffect } from 'react';
import { useVHSExams } from '../hooks/useVHSExams';
import { VHSExamCard } from './VHSExamCard';
import type { VHSExam, VHSStatus } from '../types/VHSExam';

interface VHSExamListProps {
  onSelectExam?: (exam: VHSExam) => void;
  filterStatus?: VHSStatus;
}

const FILTERS: { key: VHSStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'liberado', label: 'Liberados' },
  { key: 'divergente', label: 'Divergentes' },
  { key: 'cancelado', label: 'Cancelados' },
];

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#141417] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
        <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
    </div>
  );
}

export function VHSExamList({ onSelectExam, filterStatus }: VHSExamListProps) {
  const [activeFilter, setActiveFilter] = useState<VHSStatus | 'todos'>(filterStatus ?? 'todos');

  useEffect(() => {
    setActiveFilter(filterStatus ?? 'todos');
  }, [filterStatus]);

  const { exams, isLoading, error } = useVHSExams({
    status: activeFilter === 'todos' ? undefined : activeFilter,
  });

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-zinc-100 text-zinc-900'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Estado de erro */}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          Erro ao carregar exames: {error.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && exams.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[#141417] p-8 text-center text-sm text-zinc-400">
          Nenhum exame VHS registrado ainda.
        </div>
      )}

      {/* Lista */}
      {!isLoading && exams.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {exams.map((exam) => (
            <VHSExamCard key={exam.id} exam={exam} onVerify={onSelectExam} />
          ))}
        </div>
      )}
    </div>
  );
}
