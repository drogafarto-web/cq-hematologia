/**
 * src/features/nps/types/index.ts
 *
 * MP-6 (v1.4-final-closure) — NPS module domain types.
 *
 * Compliance:
 *  - DICQ 4.14.4 (pesquisa de satisfação)
 *  - LGPD Art. 7/9/11/13 (consent base, sensitive data, transparency)
 *  - RDC 978 Art. 86 (continual improvement input)
 */

export type NPSCategory = 'detractor' | 'passive' | 'promoter';

export interface NPSResponse {
  id: string;
  labId: string;
  score: number; // 0..10 integer
  category: NPSCategory;
  followUp?: string; // free-text reason (required when score <= 6)
  consentToken?: string; // LGPD if respondent identified
  patientToken?: string; // anonymous device-bound token (one response per cycle)
  cycleId: string; // e.g. "2026-Q2"
  submittedAt: number;
  deletedAt?: number;
}

export interface NPSCycleSummary {
  cycleId: string;
  totalResponses: number;
  averageScore: number;
  npsValue: number; // (%promoters - %detractors), reported on a -100..100 scale
  detractors: number;
  passives: number;
  promoters: number;
  lastUpdatedAt: number;
}

/**
 * Score-to-category map per Reichheld's NPS canon:
 *   0..6 → detractor, 7..8 → passive, 9..10 → promoter.
 * Out-of-range or non-integer inputs are treated as detractor (defensive).
 */
export function classifyNPSScore(score: number): NPSCategory {
  if (!Number.isInteger(score) || score < 0 || score > 10) return 'detractor';
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
}
