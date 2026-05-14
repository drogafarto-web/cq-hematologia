import { useState } from 'react';

import { saveResposta } from '../services/auditoriaGeralService';
import type { Indicador, RespostaIndicador } from '../types';
import { ScoreSelector } from './ScoreSelector';

interface IndicadorCardProps {
  indicador: Indicador;
  resposta: RespostaIndicador | undefined;
  labId: string;
  auditoriaId: string;
}

export function IndicadorCard({
  indicador,
  resposta,
  labId,
  auditoriaId,
}: IndicadorCardProps) {
  const [obs, setObs] = useState(resposta?.observacoes ?? '');
  const [showObs, setShowObs] = useState(Boolean(resposta?.observacoes));

  const handleScoreChange = (score: number | null, naoAplica: boolean) => {
    saveResposta(labId, auditoriaId, indicador.id, {
      numero: indicador.numero,
      indicador: indicador.indicador,
      bloco: indicador.bloco,
      score,
      naoAplica,
      observacoes: obs,
      respondidoEm: null,
      respondidoPor: null,
    });
  };

  const handleObsBlur = () => {
    if (obs === (resposta?.observacoes ?? '')) return;
    saveResposta(labId, auditoriaId, indicador.id, {
      observacoes: obs,
    });
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-mono font-medium">
          {indicador.numero}
        </span>
        <span className="text-sm font-medium text-white/90">
          {indicador.indicador}
        </span>
        <span className="text-[10px] text-white/50 bg-white/[0.04] px-2 py-0.5 rounded-full">
          {indicador.marcoRegulatorio}
        </span>
      </div>

      <ScoreSelector
        value={resposta?.score ?? null}
        naoAplica={resposta?.naoAplica ?? false}
        niveis={indicador.niveis}
        onChange={handleScoreChange}
      />

      {showObs ? (
        <textarea
          placeholder="Observacoes (opcional)"
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onBlur={handleObsBlur}
          autoFocus
          className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowObs(true)}
          className="text-xs text-white/50 hover:text-white/70 transition-colors"
        >
          + Adicionar nota
        </button>
      )}
    </div>
  );
}