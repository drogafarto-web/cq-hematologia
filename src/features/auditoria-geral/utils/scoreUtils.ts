import type { RespostaIndicador, BlocoId, ScoresPorBloco } from '../types';
import { BLOCOS } from '../data/blocos';

export function calcularScoreBloco(respostas: RespostaIndicador[], blocoId: BlocoId): number {
  const respostasBloco = respostas.filter(
    (r) => r.bloco === blocoId && !r.naoAplica && r.score !== null,
  );
  if (respostasBloco.length === 0) return 0;
  const soma = respostasBloco.reduce((acc, r) => acc + (r.score ?? 0), 0);
  return Math.round((soma / (respostasBloco.length * 5)) * 100);
}

export function calcularScoresPorBloco(respostas: RespostaIndicador[]): ScoresPorBloco {
  const scores = {} as ScoresPorBloco;
  for (const bloco of BLOCOS) {
    scores[bloco.id] = calcularScoreBloco(respostas, bloco.id);
  }
  return scores;
}

export function calcularScoreTotal(respostas: RespostaIndicador[]): number {
  const respondidas = respostas.filter((r) => !r.naoAplica && r.score !== null);
  if (respondidas.length === 0) return 0;
  const soma = respondidas.reduce((acc, r) => acc + (r.score ?? 0), 0);
  return Math.round((soma / (respondidas.length * 5)) * 100);
}

export function contarRespondidos(respostas: RespostaIndicador[]): number {
  return respostas.filter((r) => r.score !== null || r.naoAplica).length;
}

export function contarNaoAplica(respostas: RespostaIndicador[]): number {
  return respostas.filter((r) => r.naoAplica).length;
}

export function getScoreColor(score: number): string {
  if (score === 0) return 'text-white/30';
  if (score <= 1) return 'text-red-400';
  if (score <= 2) return 'text-orange-400';
  if (score <= 3) return 'text-amber-400';
  if (score <= 4) return 'text-emerald-400';
  return 'text-emerald-300';
}

export function getPercentColor(percent: number): string {
  if (percent < 40) return 'text-red-400';
  if (percent < 60) return 'text-amber-400';
  if (percent < 80) return 'text-blue-400';
  return 'text-emerald-400';
}
