import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { toast } from '../../../shared/store/useToastStore';
import { BLOCOS } from '../data/blocos';
import { INDICADORES } from '../data/indicadores';
import { useAuditoriaGeral } from '../hooks/useAuditoriaGeral';
import { useScoreCalculator } from '../hooks/useScoreCalculator';
import {
  updateAuditoriaScores,
  updateBlocoAtual,
  updateStatus,
} from '../services/auditoriaGeralService';
import { ContextBar } from './ContextBar';
import { ResumoAuditoria } from './ResumoAuditoria';
import { SidebarBlocos } from './SidebarBlocos';
import { WizardBlocoStep } from './WizardBlocoStep';
import { WizardGuidedMode } from './WizardGuidedMode';

interface WizardAuditoriaProps {
  auditoriaId: string;
  onBack: () => void;
}

type ViewMode = 'guided' | 'expert';

const STORAGE_KEY = 'auditoria-geral-view-mode';

function getStoredMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'guided' || stored === 'expert') return stored;
  } catch {
    /* ignore */
  }
  return 'guided';
}

export function WizardAuditoria({ auditoriaId, onBack }: WizardAuditoriaProps) {
  const labId = useActiveLabId();
  const { auditoria, respostas, isLoading } = useAuditoriaGeral(auditoriaId);
  const { scoreTotal, scoresPorBloco, totalRespondidos, totalNaoAplica } =
    useScoreCalculator(respostas);

  const [currentBlocoIndex, setCurrentBlocoIndex] = useState(0);
  const [showResumo, setShowResumo] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredMode);
  const hasStarted = useRef(false);

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const prevRespostasRef = useRef(respostas);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (prevRespostasRef.current !== respostas && respostas.length > 0) {
      setSaveStatus('saved');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }
    prevRespostasRef.current = respostas;
  }, [respostas]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (auditoria) {
      const idx = BLOCOS.findIndex((b) => b.id === auditoria.blocoAtual);
      if (idx >= 0) setCurrentBlocoIndex(idx);
    }
  }, [auditoria?.id]);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const persistScores = useCallback(async () => {
    if (!labId) return;
    await updateAuditoriaScores(
      labId,
      auditoriaId,
      scoreTotal,
      scoresPorBloco,
      totalRespondidos,
      totalNaoAplica,
    );
  }, [labId, auditoriaId, scoreTotal, scoresPorBloco, totalRespondidos, totalNaoAplica]);

  const markEmAndamento = useCallback(async () => {
    if (hasStarted.current || !labId || !auditoria) return;
    if (auditoria.status === 'rascunho') {
      hasStarted.current = true;
      await updateStatus(labId, auditoriaId, 'em_andamento');
    }
  }, [labId, auditoriaId, auditoria]);

  const navigateBloco = async (newIndex: number) => {
    if (!labId) return;
    await markEmAndamento();
    await persistScores();

    if (newIndex >= BLOCOS.length) {
      setShowResumo(true);
      return;
    }

    setCurrentBlocoIndex(newIndex);
    await updateBlocoAtual(labId, auditoriaId, BLOCOS[newIndex].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnterior = () => navigateBloco(currentBlocoIndex - 1);
  const handleProximo = () => navigateBloco(currentBlocoIndex + 1);

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
  const isFinalizada = auditoria?.status === 'finalizada';

  // Calculate items answered in current block
  const indicadoresDoBloco = INDICADORES.filter((ind) =>
    blocoAtual.indicadores.includes(ind.numero),
  );
  const respondidosNoBloco = indicadoresDoBloco.filter((ind) =>
    respostas.some((r) => r.numero === ind.numero && (r.score !== null || r.naoAplica)),
  ).length;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — visible on lg+ */}
      <SidebarBlocos
        currentBlocoIndex={currentBlocoIndex}
        respostas={respostas}
        onSelectBloco={(i) => navigateBloco(i)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 p-6 max-w-4xl">
        {/* Context Bar */}
        <ContextBar
          blocoNome={blocoAtual.nome}
          blocoIndex={currentBlocoIndex}
          totalBlocos={BLOCOS.length}
          itemNoBloco={respondidosNoBloco}
          totalItensBloco={indicadoresDoBloco.length}
          totalRespondidos={totalRespondidos}
          totalIndicadores={57}
          onBack={onBack}
        />

        {/* Save status indicator */}
        {saveStatus === 'saved' && (
          <div
            className="flex items-center gap-1.5 self-end text-emerald-500 dark:text-emerald-400 transition-opacity duration-300"
            role="status"
            aria-live="polite"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-xs font-medium">Salvo</span>
          </div>
        )}

        {/* Finalization Banner — all 57 indicators answered */}
        {totalRespondidos === 57 && auditoria?.status !== 'finalizada' && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20">
            <div className="flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-emerald-600 dark:text-emerald-400 shrink-0"
              >
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Todos os 57 indicadores respondidos. Pronto para finalizar?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowResumo(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors shrink-0"
            >
              Finalizar Auditoria
            </button>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleModeChange('guided')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'guided'
                  ? 'bg-white dark:bg-white/[0.1] text-violet-700 dark:text-violet-400 shadow-sm'
                  : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60'
              }`}
            >
              Guiado
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('expert')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'expert'
                  ? 'bg-white dark:bg-white/[0.1] text-violet-700 dark:text-violet-400 shadow-sm'
                  : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60'
              }`}
            >
              Expert
            </button>
          </div>

          {/* Bloco navigation (expert mode) */}
          {viewMode === 'expert' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {BLOCOS.map((b, i) => {
                  const isCurrent = i === currentBlocoIndex;
                  const blocoInds = INDICADORES.filter((ind) => b.indicadores.includes(ind.numero));
                  const blocoAnswered = blocoInds.filter((ind) =>
                    respostas.some(
                      (r) => r.numero === ind.numero && (r.score !== null || r.naoAplica),
                    ),
                  ).length;
                  const isComplete = blocoAnswered === blocoInds.length;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => navigateBloco(i)}
                      aria-label={`Bloco ${b.id}: ${b.nome}`}
                      className={`w-6 h-6 rounded text-[10px] font-medium border transition-all ${
                        isCurrent
                          ? 'bg-violet-500 border-violet-500 text-white'
                          : isComplete
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-400'
                            : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/40'
                      }`}
                    >
                      {b.id}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await persistScores();
                  toast.success('Scores salvos');
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/60 transition-colors"
              >
                Salvar tudo
              </button>
            </div>
          )}
        </div>

        {/* Content based on mode */}
        {viewMode === 'guided' ? (
          <WizardGuidedMode
            bloco={blocoAtual}
            respostas={respostas}
            labId={labId!}
            auditoriaId={auditoriaId}
            onBlocoComplete={handleProximo}
            onBlocoPrev={handleAnterior}
            isFirstBloco={currentBlocoIndex === 0}
            readonly={isFinalizada}
          />
        ) : (
          <>
            <WizardBlocoStep
              bloco={blocoAtual}
              respostas={respostas}
              labId={labId!}
              auditoriaId={auditoriaId}
              readonly={isFinalizada}
            />

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/[0.06]">
              <button
                onClick={handleAnterior}
                disabled={currentBlocoIndex === 0}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Bloco anterior"
              >
                ← Anterior
              </button>

              <button
                onClick={handleProximo}
                className="px-4 py-2 text-sm rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-medium transition-colors"
                aria-label={
                  currentBlocoIndex === BLOCOS.length - 1 ? 'Ver resumo' : 'Próximo bloco'
                }
              >
                {currentBlocoIndex === BLOCOS.length - 1 ? 'Ver Resumo' : 'Próximo →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
