import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { INDICADORES } from '../data/indicadores';
import { useAuditoriaGeral } from '../hooks/useAuditoriaGeral';
import { useScoreCalculator } from '../hooks/useScoreCalculator';
import { finalizarAuditoria } from '../services/auditoriaGeralService';
import { getPercentColor } from '../utils/scoreUtils';
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
  const { auditoria, respostas, isLoading } = useAuditoriaGeral(auditoriaId);
  const { scoreTotal, scoresPorBloco, totalRespondidos, totalNaoAplica } =
    useScoreCalculator(respostas);
  const [finalizing, setFinalizing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  const abaixoDe3 = respostas.filter(
    (r) => r.score !== null && r.score < 3 && !r.naoAplica,
  ).length;

  const criticos = respostas.filter(
    (r) => r.score !== null && r.score <= 2 && !r.naoAplica,
  );

  const totalFotos = respostas.reduce((sum, r) => sum + (r.fotos?.length ?? 0), 0);

  const isFinalizada = auditoria?.status === 'finalizada';
  const canFinalize = totalRespondidos >= 29;

  const handleFinalize = async () => {
    if (!labId || finalizing) return;
    setFinalizing(true);
    try {
      await finalizarAuditoria(labId, auditoriaId, scoreTotal, scoresPorBloco);
      onFinalize();
    } catch {
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
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 px-4">
      {/* Score Total */}
      <section className="text-center">
        <p className={`text-5xl font-bold font-mono tracking-tight ${getPercentColor(scoreTotal)}`}>
          {scoreTotal}%
        </p>
        <p className="text-sm text-white/40 mt-2">Score Geral de Conformidade</p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono text-white">{totalRespondidos}/57</p>
          <p className="text-xs text-white/40 mt-1">Respondidos</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono text-white">{totalNaoAplica}</p>
          <p className="text-xs text-white/40 mt-1">Nao Aplica</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold font-mono ${abaixoDe3 > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{abaixoDe3}</p>
          <p className="text-xs text-white/40 mt-1">Abaixo de 3</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono text-violet-400">{totalFotos}</p>
          <p className="text-xs text-white/40 mt-1">Fotos</p>
        </div>
      </section>

      {/* Block Chart */}
      <section className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-5">
        <h2 className="text-sm font-medium text-white/60 mb-4">Score por Bloco</h2>
        <ScoreBlocoChart scoresPorBloco={scoresPorBloco} />
      </section>

      {/* Critical Findings */}
      <section>
        <h2 className="text-sm font-medium text-white/60 mb-3">
          Indicadores Criticos (score &le; 2)
        </h2>
        {criticos.length === 0 ? (
          <p className="text-sm text-emerald-400">Nenhum indicador critico</p>
        ) : (
          <div className="space-y-2">
            {criticos.map((r) => {
              const ind = INDICADORES.find((i) => i.numero === r.numero);
              return (
                <div
                  key={r.id}
                  className="bg-red-500/5 border border-red-500/10 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white/50">#{r.numero}</span>
                    <span className="text-sm text-white/80">
                      {ind?.indicador ?? r.indicador}
                    </span>
                    <span className="ml-auto text-xs font-mono text-red-400">
                      {r.score}/5
                    </span>
                  </div>
                  {r.observacoes && (
                    <p className="text-xs text-white/40 mt-1">{r.observacoes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Plano de Acao */}
      <section className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-5">
        <PlanoAcaoPanel auditoriaId={auditoriaId} respostas={respostas} />
      </section>

      {/* IA Summary */}
      {isFinalizada && (
        <section className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-5">
          <IASummaryPanel auditoriaId={auditoriaId} />
        </section>
      )}

      {/* Actions */}
      <section className="flex items-center gap-4 pt-4 border-t border-white/[0.06]">
        <button
          onClick={onBack}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Voltar ao Wizard
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={generatingPdf}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          {generatingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
        </button>
        {isFinalizada ? (
          <p className="text-sm text-white/50">
            Auditoria finalizada em{' '}
            {auditoria.dataFim?.toDate().toLocaleDateString('pt-BR')}
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
