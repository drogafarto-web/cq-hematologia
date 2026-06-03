import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

interface Props {
  auditoriaId: string;
}

export function IASummaryPanel({ auditoriaId }: Props) {
  const labId = useActiveLabId();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!labId) return;
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable<{ labId: string; auditoriaId: string }, { summary: string }>(
        functions,
        'generateAuditoriaSummary',
      );
      const result = await fn({ labId, auditoriaId });
      setSummary(result.data.summary);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao gerar resumo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-600 dark:text-white/60">
          Resumo Executivo (IA)
        </h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-medium transition-colors disabled:opacity-40"
        >
          {loading ? 'Gerando...' : summary ? 'Regenerar' : 'Gerar Resumo IA'}
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 dark:bg-white/[0.04] rounded animate-pulse w-full" />
          <div className="h-4 bg-slate-200 dark:bg-white/[0.04] rounded animate-pulse w-5/6" />
          <div className="h-4 bg-slate-200 dark:bg-white/[0.04] rounded animate-pulse w-4/6" />
          <div className="h-4 bg-slate-200 dark:bg-white/[0.04] rounded animate-pulse w-full" />
          <div className="h-4 bg-slate-200 dark:bg-white/[0.04] rounded animate-pulse w-3/4" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 dark:bg-red-500/5 dark:border-red-500/10 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {summary && !loading && (
        <div className="bg-violet-50 border border-violet-200 dark:bg-violet-500/5 dark:border-violet-500/10 rounded-lg p-5">
          <div className="prose prose-sm max-w-none">
            {summary.split('\n').map((line, i) => (
              <p
                key={i}
                className="text-sm text-slate-700 dark:text-white/70 leading-relaxed mb-2 last:mb-0"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
