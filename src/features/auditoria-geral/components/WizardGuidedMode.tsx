import { useEffect, useState } from 'react';

import { INDICADORES } from '../data/indicadores';
import { useSwipe } from '../hooks/useSwipe';
import type { BlocoMeta, RespostaIndicador } from '../types';
import { IndicadorCard } from './IndicadorCard';

interface WizardGuidedModeProps {
  bloco: BlocoMeta;
  respostas: RespostaIndicador[];
  labId: string;
  auditoriaId: string;
  onBlocoComplete: () => void;
  onBlocoPrev: () => void;
  isFirstBloco: boolean;
  readonly?: boolean;
}

export function WizardGuidedMode({
  bloco,
  respostas,
  labId,
  auditoriaId,
  onBlocoComplete,
  onBlocoPrev,
  isFirstBloco,
  readonly = false,
}: WizardGuidedModeProps) {
  const indicadoresDoBloco = INDICADORES.filter((ind) => bloco.indicadores.includes(ind.numero));

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [bloco.id]);

  const indicadorAtual = indicadoresDoBloco[currentIndex];
  const isFirst = currentIndex === 0 && isFirstBloco;
  const isLastInBloco = currentIndex === indicadoresDoBloco.length - 1;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (!isFirstBloco) {
      onBlocoPrev();
    }
  };

  const handleNext = () => {
    if (!isLastInBloco) {
      setCurrentIndex(currentIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onBlocoComplete();
    }
  };

  const swipeRef = useSwipe<HTMLDivElement>({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
  });

  if (!indicadorAtual) return null;

  const currentResposta = respostas.find((r) => r.numero === indicadorAtual.numero);
  const ncSemObs =
    currentResposta?.critica === 'NÃO CONFORME' && !currentResposta?.observacoes?.trim();

  const respondido = respostas.some(
    (r) => r.numero === indicadorAtual.numero && (r.score !== null || r.naoAplica),
  );

  return (
    <div ref={swipeRef} className="space-y-4">
      {/* Item position indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700 dark:text-white/70">{bloco.nome}</h2>
        <div className="flex items-center gap-2">
          {indicadoresDoBloco.map((ind, i) => {
            const isAnswered = respostas.some(
              (r) => r.numero === ind.numero && (r.score !== null || r.naoAplica),
            );
            const isCurrent = i === currentIndex;
            return (
              <button
                key={ind.numero}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Indicador ${ind.numero}${isAnswered ? ' (respondido)' : ''}`}
                className={`w-6 h-6 rounded-md text-[10px] font-medium border transition-all ${
                  isCurrent
                    ? 'bg-violet-500 border-violet-500 text-white'
                    : isAnswered
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-400'
                      : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/40'
                }`}
              >
                {ind.numero}
              </button>
            );
          })}
        </div>
      </div>

      {/* Single indicator card */}
      <IndicadorCard
        indicador={indicadorAtual}
        resposta={respostas.find((r) => r.numero === indicadorAtual.numero)}
        labId={labId}
        auditoriaId={auditoriaId}
        readonly={readonly}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/[0.06]">
        <button
          onClick={handlePrev}
          disabled={isFirst}
          className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Indicador anterior"
        >
          ← Anterior
        </button>

        <span className="text-xs text-slate-500 dark:text-white/40">
          {currentIndex + 1} / {indicadoresDoBloco.length}
        </span>

        <button
          onClick={handleNext}
          disabled={ncSemObs}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            ncSemObs
              ? 'bg-violet-500/50 text-white/60 cursor-not-allowed'
              : 'bg-violet-500 hover:bg-violet-400 text-white'
          }`}
          aria-label={
            ncSemObs
              ? 'Preencha a justificativa da não conformidade para avançar'
              : isLastInBloco
                ? 'Próximo bloco'
                : 'Próximo indicador'
          }
        >
          {isLastInBloco ? 'Próximo Bloco →' : 'Próximo →'}
        </button>
      </div>
    </div>
  );
}
