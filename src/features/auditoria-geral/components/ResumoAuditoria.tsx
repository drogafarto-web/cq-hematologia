import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { toast } from '../../../shared/store/useToastStore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { INDICADORES } from '../data/indicadores';
import { useAuditoriaGeral } from '../hooks/useAuditoriaGeral';
import { useScoreCalculator } from '../hooks/useScoreCalculator';
import { finalizarAuditoria } from '../services/auditoriaGeralService';
import { gerarAchadosAutomaticos } from '../services/achadosService';
import { getPercentColor } from '../utils/scoreUtils';
import { AchadosPanel } from './AchadosPanel';
import { IASummaryPanel } from './IASummaryPanel';
import { PlanoAcaoPanel } from './PlanoAcaoPanel';
import { ScoreBlocoChart } from './ScoreBlocoChart';

interface ResumoAuditoriaProps {
  auditoriaId: string;
  onBack: () => void;
  onFinalize: () => void;
}

export function ResumoAuditoria({ auditoriaId, onBack, onFinalize }: ResumoAuditoriaProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const { auditoria, respostas, isLoading } = useAuditoriaGeral(auditoriaId);
  const { scoreTotal, scoresPorBloco, totalRespondidos, totalNaoAplica } =
    useScoreCalculator(respostas);
  const [finalizing, setFinalizing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 py-8 px-4 max-w-3xl mx-auto" aria-busy="true">
        <div className="h-6 bg-slate-200 dark:bg-white/[0.06] rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-slate-200 dark:bg-white/[0.06] rounded w-2/3 animate-pulse" />
        <div className="h-4 bg-slate-200 dark:bg-white/[0.06] rounded w-1/2 animate-pulse" />
        <div className="h-32 bg-slate-200 dark:bg-white/[0.06] rounded animate-pulse" />
      </div>
    );
  }

  const abaixoDe3 = respostas.filter((r) => r.score !== null && r.score < 3 && !r.naoAplica).length;

  const criticos = respostas.filter((r) => r.score !== null && r.score <= 2 && !r.naoAplica);

  const totalFotos = respostas.reduce((sum, r) => sum + (r.fotos?.length ?? 0), 0);

  const isFinalizada = auditoria?.status === 'finalizada';
  const canFinalize = totalRespondidos >= 29;

  const handleFinalize = async () => {
    if (!labId || !user || finalizing) return;
    setFinalizing(true);
    try {
      await finalizarAuditoria(labId, auditoriaId, scoreTotal, scoresPorBloco);
      // Auto-generate achados for scores 0-2
      const count = await gerarAchadosAutomaticos(labId, auditoriaId, respostas, user.uid);
      if (count > 0) {
        toast.success(`Auditoria finalizada. ${count} achado(s) gerado(s) automaticamente.`);
      } else {
        toast.success('Auditoria finalizada com sucesso.');
      }
      onFinalize();
    } catch {
      toast.error('Erro ao finalizar auditoria');
      setFinalizing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!labId) return;
    setGeneratingPdf(true);
    try {
      const fn = httpsCallable<{ labId: string; auditoriaId: string }, { pdf: string }>(
        functions,
        'generateAuditoriaGeralPDF',
      );
      const result = await fn({ labId, auditoriaId });
      const byteChars = atob(result.data.pdf);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria-geral-${auditoria?.titulo ?? 'relatorio'}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 px-4">
      {/* Score Total */}
      <section className="text-center" aria-live="polite">
        <p className={`text-5xl font-bold font-mono tracking-tight ${getPercentColor(scoreTotal)}`}>
          {scoreTotal}%
        </p>
        <p className="text-sm text-slate-500 dark:text-white/60 mt-2">
          Score Geral de Conformidade
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {totalRespondidos}/57
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">Respondidos</p>
        </div>
        <div className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {totalNaoAplica}
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">Nao Aplica</p>
        </div>
        <div className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-4 text-center">
          <p
            className={`text-2xl font-bold font-mono ${abaixoDe3 > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}
          >
            {abaixoDe3}
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">Abaixo de 3</p>
        </div>
        <div className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono text-violet-600 dark:text-violet-400">
            {totalFotos}
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">Fotos</p>
        </div>
      </section>

      {/* Block Chart */}
      <section className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-5">
        <h2 className="text-sm font-medium text-slate-600 dark:text-white/70 mb-4">
          Score por Bloco
        </h2>
        <ScoreBlocoChart scoresPorBloco={scoresPorBloco} />
      </section>

      {/* Critical Findings */}
      <section>
        <h2 className="text-sm font-medium text-slate-600 dark:text-white/70 mb-3">
          Indicadores Criticos (score &le; 2)
        </h2>
        {criticos.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Nenhum indicador critico</p>
        ) : (
          <div className="space-y-2">
            {criticos.map((r) => {
              const ind = INDICADORES.find((i) => i.numero === r.numero);
              return (
                <div
                  key={r.id}
                  className="bg-red-50 border border-red-200 dark:bg-red-500/5 dark:border-red-500/10 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 dark:text-white/50">
                      #{r.numero}
                    </span>
                    <span className="text-sm text-slate-800 dark:text-white/80">
                      {ind?.indicador ?? r.indicador}
                    </span>
                    <span className="ml-auto text-xs font-mono text-red-600 dark:text-red-400">
                      {r.score}/5
                    </span>
                  </div>
                  {r.observacoes && (
                    <p className="text-xs text-slate-500 dark:text-white/40 mt-1">
                      {r.observacoes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Plano de Acao */}
      <section className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-5">
        <PlanoAcaoPanel auditoriaId={auditoriaId} respostas={respostas} />
      </section>

      {/* Achados (NC + CAPA) */}
      {isFinalizada && (
        <section className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-5">
          <AchadosPanel auditoriaId={auditoriaId} />
        </section>
      )}

      {/* IA Summary */}
      {isFinalizada && (
        <section className="bg-white border border-slate-200 dark:bg-white/[0.05] dark:border-white/[0.08] rounded-lg p-5">
          <IASummaryPanel auditoriaId={auditoriaId} />
        </section>
      )}

      {/* Actions */}
      <section className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
        <button
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-white/60 dark:hover:text-white/80 transition-colors"
        >
          Voltar ao Wizard
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={generatingPdf}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/80 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          {generatingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
        </button>
        {isFinalizada ? (
          <p className="text-sm text-slate-500 dark:text-white/60">
            Auditoria finalizada em {auditoria.dataFim?.toDate().toLocaleDateString('pt-BR')}
          </p>
        ) : (
          <button
            onClick={handleFinalize}
            disabled={!canFinalize || finalizing}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {finalizing ? 'Finalizando...' : 'Finalizar Auditoria'}
          </button>
        )}
      </section>
    </div>
  );
}
