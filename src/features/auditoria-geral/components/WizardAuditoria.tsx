import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { BLOCOS } from '../data/blocos';
import { useAuditoriaGeral } from '../hooks/useAuditoriaGeral';
import { useScoreCalculator } from '../hooks/useScoreCalculator';
import {
  updateAuditoriaScores,
  updateBlocoAtual,
  updateStatus,
} from '../services/auditoriaGeralService';
import { ProgressBar } from './ProgressBar';
import { ResumoAuditoria } from './ResumoAuditoria';
import { WizardBlocoStep } from './WizardBlocoStep';

interface WizardAuditoriaProps {
  auditoriaId: string;
  onBack: () => void;
}

export function WizardAuditoria({ auditoriaId, onBack }: WizardAuditoriaProps) {
  const labId = useActiveLabId();
  const { auditoria, respostas, isLoading } = useAuditoriaGeral(auditoriaId);
  const { scoreTotal, scoresPorBloco, totalRespondidos, totalNaoAplica } =
    useScoreCalculator(respostas);

  const [currentBlocoIndex, setCurrentBlocoIndex] = useState(0);
  const [showResumo, setShowResumo] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (auditoria) {
      const idx = BLOCOS.findIndex((b) => b.id === auditoria.blocoAtual);
      if (idx >= 0) setCurrentBlocoIndex(idx);
    }
  }, [auditoria?.id]);

  const persistScores = useCallback(async () => {
    if (!labId) return;
    await updateAuditoriaScores(
      labId,
      auditoriaId,
      scoreTotal,
      scoresPorBloco,
      totalRespondidos,
      totalNaoAplica
    );
  }, [labId, auditoriaId, scoreTotal, scoresPorBloco, totalRespondidos, totalNaoAplica]);

  const markEmAndamento = useCallback(async () => {
    if (hasStarted.current || !labId || !auditoria) return;
    if (auditoria.status === 'rascunho') {
      hasStarted.current = true;
      await updateStatus(labId, auditoriaId, 'em_andamento');
    }
  }, [labId, auditoriaId, auditoria]);

  const handleAnterior = async () => {
    if (currentBlocoIndex === 0 || !labId) return;
    await markEmAndamento();
    await persistScores();
    const newIndex = currentBlocoIndex - 1;
    setCurrentBlocoIndex(newIndex);
    await updateBlocoAtual(labId, auditoriaId, BLOCOS[newIndex].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProximo = async () => {
    if (!labId) return;
    await markEmAndamento();
    await persistScores();

    if (currentBlocoIndex === BLOCOS.length - 1) {
      setShowResumo(true);
      return;
    }

    const newIndex = currentBlocoIndex + 1;
    setCurrentBlocoIndex(newIndex);
    await updateBlocoAtual(labId, auditoriaId, BLOCOS[newIndex].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (showResumo) {
    return (
      <ResumoAuditoria
        auditoriaId={auditoriaId}
        onBack={() => setShowResumo(false)}
        onFinalize={onBack}
      />
    );
  }

  const blocoAtual = BLOCOS[currentBlocoIndex];
  const isLast = currentBlocoIndex === BLOCOS.length - 1;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
          aria-label="Voltar ao painel"
        >
          &larr; Voltar ao painel
        </button>
      </div>

      <ProgressBar
        currentStep={currentBlocoIndex + 1}
        totalSteps={BLOCOS.length}
        blocoNome={blocoAtual.nome}
      />

      <WizardBlocoStep
        bloco={blocoAtual}
        respostas={respostas}
        labId={labId!}
        auditoriaId={auditoriaId}
      />

      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
        <button
          onClick={handleAnterior}
          disabled={currentBlocoIndex === 0}
          className="px-4 py-2 text-sm rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Bloco anterior"
        >
          Anterior
        </button>

        <button
          onClick={handleProximo}
          className="px-4 py-2 text-sm rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-medium transition-colors"
          aria-label={isLast ? 'Ver resumo da auditoria' : 'Proximo bloco'}
        >
          {isLast ? 'Ver Resumo' : 'Proximo'}
        </button>
      </div>
    </div>
  );
}
