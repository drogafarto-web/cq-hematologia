import { useMemo } from 'react';
import type { RespostaIndicador } from '../types';
import { calcularScoreTotal, calcularScoresPorBloco, contarRespondidos, contarNaoAplica } from '../utils/scoreUtils';

export function useScoreCalculator(respostas: RespostaIndicador[]) {
  return useMemo(() => ({
    scoreTotal: calcularScoreTotal(respostas),
    scoresPorBloco: calcularScoresPorBloco(respostas),
    totalRespondidos: contarRespondidos(respostas),
    totalNaoAplica: contarNaoAplica(respostas),
  }), [respostas]);
}
