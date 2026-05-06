/**
 * Severity Classifier Engine
 *
 * Pure heuristic-based classification of complaint severity before Gemini AI approval.
 * Used client-side for instant feedback and server-side as fallback.
 *
 * Three severity levels:
 * - 'alta': complaint involves error in test result, patient harm, or serious service failure
 * - 'media': complaint involves delays or minor billing issues
 * - 'baixa': complaint is suggestion or general feedback
 */

import type { SeveridadeReclamacao } from '../types';

/** Heuristic keyword patterns for severity detection */
interface SeverityPattern {
  severidade: SeveridadeReclamacao;
  keywords: string[];
  weight: number; // 0.0-1.0 importance
}

/** Keywords indicating high severity */
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
      'paciente foi prejudicado',
      'falsa negativa',
      'falso negativo',
      'falsa positiva',
      'falso positivo',
      'problema sério',
      'problema grave',
      'agressão',
      'agressivo',
      'discriminação',
      'desrespeito grave',
    ],
    weight: 1.0,
  },
  {
    severidade: 'alta',
    keywords: [
      'hemolítico',
      'contaminado',
      'contaminação',
      'vírus',
      'biossegurança',
      'risco biológico',
      'amostra comprometida',
      'risco à saúde',
    ],
    weight: 0.95,
  },
];

/** Keywords indicating medium severity */
const MEDIA_PATTERNS: SeverityPattern[] = [
  {
    severidade: 'media',
    keywords: [
      'demora',
      'demoras',
      'atrasado',
      'atraso',
      'muito tempo',
      'esperando',
      'fila',
      'demorado',
      'slow',
      'lento',
      'levou muito',
      'demorou muito',
      'não chegou a tempo',
    ],
    weight: 0.8,
  },
  {
    severidade: 'media',
    keywords: [
      'valor cobrado',
      'valor errado',
      'cobrança',
      'preço',
      'taxa',
      'erro de cobrança',
      'valor incorreto',
      'cobrança errada',
      'boleto',
      'conta',
    ],
    weight: 0.75,
  },
  {
    severidade: 'media',
    keywords: [
      'atendimento ruim',
      'atendimento péssimo',
      'educação',
      'desrespeito',
      'grosseria',
      'falta de atenção',
      'ignorado',
      'desconsiderado',
      'falta de respeito',
      'profissional rude',
      'equipe rude',
    ],
    weight: 0.7,
  },
  {
    severidade: 'media',
    keywords: [
      'amostra hemolisada',
      'hemolíse',
      'hemolisado',
      'coleta ruim',
      'coleta inadequada',
      'flebotomia',
    ],
    weight: 0.65,
  },
];

/** Keywords indicating low severity */
const BAIXA_PATTERNS: SeverityPattern[] = [
  {
    severidade: 'baixa',
    keywords: [
      'sugestão',
      'sugestões',
      'melhoria',
      'melhorar',
      'poderia',
      'talvez',
      'comentário',
      'feedback',
      'ideia',
      'pensamento',
      'opinião',
      'achei que',
    ],
    weight: 0.9,
  },
  {
    severidade: 'baixa',
    keywords: [
      'ambiente',
      'limpeza',
      'temperatura',
      'climatização',
      'iluminação',
      'conforto',
      'infraestrutura',
      'instalações',
      'decoração',
      'mobiliário',
    ],
    weight: 0.6,
  },
];

/**
 * Normalize text for pattern matching: lowercase, remove accents, trim
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove accents
    .trim();
}

/**
 * Count keyword matches in text for a severity level
 * Returns normalized score (0.0-1.0)
 */
function scoreText(text: string, patterns: SeverityPattern[]): number {
  const normalized = normalizeText(text);
  let score = 0;
  let matchCount = 0;

  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      const normalized_keyword = normalizeText(keyword);

      // Check both exact phrase and individual words
      if (
        normalized.includes(normalized_keyword) ||
        normalized.split(' ').some((word) => word.includes(normalized_keyword))
      ) {
        score += pattern.weight;
        matchCount++;
      }
    }
  }

  // Normalize: cap at 1.0, boost by match count (multiple matches = higher confidence)
  if (matchCount === 0) return 0;
  return Math.min(1.0, score / (patterns.length * 0.5 + matchCount * 0.1));
}

/**
 * Main classification function — pure heuristic
 * Analyzes complaint text and returns severity + confidence
 *
 * Algorithm:
 * 1. Score text against alta patterns
 * 2. Score text against media patterns
 * 3. Score text against baixa patterns
 * 4. Return highest-scoring severity
 * 5. If tie, favor higher severity
 * 6. Fallback: 'media' if no matches
 */
export function classificarSeveridadeHeuristica(
  descricao: string
): {
  severidade: SeveridadeReclamacao;
  confianca: number;
  matchedKeywords: string[];
} {
  if (!descricao || descricao.trim().length === 0) {
    return {
      severidade: 'media',
      confianca: 0.0,
      matchedKeywords: [],
    };
  }

  const altaScore = scoreText(descricao, ALTA_PATTERNS);
  const mediaScore = scoreText(descricao, MEDIA_PATTERNS);
  const baixaScore = scoreText(descricao, BAIXA_PATTERNS);

  let selectedSeveridade: SeveridadeReclamacao;
  let confianca: number;
  let matchedKeywords: string[] = [];

  // Tie-breaking: favor higher severity
  if (altaScore > mediaScore && altaScore > baixaScore) {
    selectedSeveridade = 'alta';
    confianca = altaScore;
    matchedKeywords = ALTA_PATTERNS
      .filter((p) => scoreText(descricao, [p]) > 0)
      .flatMap((p) => p.keywords);
  } else if (mediaScore > baixaScore) {
    selectedSeveridade = 'media';
    confianca = mediaScore;
    matchedKeywords = MEDIA_PATTERNS
      .filter((p) => scoreText(descricao, [p]) > 0)
      .flatMap((p) => p.keywords);
  } else if (baixaScore > 0) {
    selectedSeveridade = 'baixa';
    confianca = baixaScore;
    matchedKeywords = BAIXA_PATTERNS
      .filter((p) => scoreText(descricao, [p]) > 0)
      .flatMap((p) => p.keywords);
  } else {
    // No matches: default to media (neutral fallback)
    selectedSeveridade = 'media';
    confianca = 0.3; // low confidence in default
    matchedKeywords = [];
  }

  return {
    severidade: selectedSeveridade,
    confianca: Math.min(0.99, confianca), // cap at 0.99 (never 100% heuristic)
    matchedKeywords: [...new Set(matchedKeywords)].slice(0, 10), // unique, top 10
  };
}

/**
 * Batch classify multiple complaints
 */
export function classificarLote(
  descricoes: string[]
): Array<{
  descricao: string;
  severidade: SeveridadeReclamacao;
  confianca: number;
}> {
  return descricoes.map((desc) => {
    const { severidade, confianca } = classificarSeveridadeHeuristica(desc);
    return { descricao: desc, severidade, confianca };
  });
}

/**
 * Check if severity is high enough to trigger NC auto-creation
 * Rule: severity 'alta' + descricao.length ≥ 100 chars (prevent spam)
 */
export function shouldTriggerNCAutocreate(
  severidade: SeveridadeReclamacao,
  descricao: string
): boolean {
  return severidade === 'alta' && descricao.trim().length >= 100;
}
