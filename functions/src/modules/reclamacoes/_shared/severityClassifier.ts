/**
 * Severity Classifier Engine — Server-side version
 *
 * Shared logic between client and server.
 * Used in Cloud Functions for NC auto-trigger validation.
 * No external dependencies.
 */

export type SeveridadeReclamacao = 'alta' | 'media' | 'baixa';

interface SeverityPattern {
  severidade: SeveridadeReclamacao;
  keywords: string[];
  weight: number;
}

const ALTA_PATTERNS: SeverityPattern[] = [
  {
    severidade: 'alta',
    keywords: [
      'laudo errado',
      'resultado errado',
      'diagnóstico errado',
      'diagnóstico incorreto',
      'dano',
      'erro crítico',
      'resultado crítico',
      'paciente prejudicado',
      'falsa negativa',
      'falso negativo',
      'falsa positiva',
      'falso positivo',
      'problema sério',
      'problema grave',
      'agressão',
      'agressivo',
    ],
    weight: 1.0,
  },
];

const MEDIA_PATTERNS: SeverityPattern[] = [
  {
    severidade: 'media',
    keywords: ['demora', 'atrasado', 'atraso', 'esperando', 'valor cobrado', 'cobrança'],
    weight: 0.8,
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function scoreText(text: string, patterns: SeverityPattern[]): number {
  const normalized = normalizeText(text);
  let score = 0;
  let matchCount = 0;

  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      const normalized_keyword = normalizeText(keyword);
      if (normalized.includes(normalized_keyword)) {
        score += pattern.weight;
        matchCount++;
      }
    }
  }

  if (matchCount === 0) return 0;
  return Math.min(1.0, score / (patterns.length * 0.5 + matchCount * 0.1));
}

export function classificarSeveridadeHeuristica(descricao: string): {
  severidade: SeveridadeReclamacao;
  confianca: number;
} {
  if (!descricao || descricao.trim().length === 0) {
    return {
      severidade: 'media',
      confianca: 0.0,
    };
  }

  const altaScore = scoreText(descricao, ALTA_PATTERNS);
  const mediaScore = scoreText(descricao, MEDIA_PATTERNS);

  if (altaScore > mediaScore && altaScore > 0) {
    return {
      severidade: 'alta',
      confianca: Math.min(0.99, altaScore),
    };
  }

  return {
    severidade: mediaScore > 0 ? 'media' : 'media',
    confianca: Math.min(0.99, mediaScore),
  };
}

export function shouldTriggerNCAutocreate(
  severidade: SeveridadeReclamacao,
  descricao: string,
): boolean {
  return severidade === 'alta' && descricao.trim().length >= 100;
}
