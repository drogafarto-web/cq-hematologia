/**
 * aiPatternMatcher.ts
 *
 * Wrapper around Gemini 2.5 Flash for pattern matching and insight generation.
 * Analyzes anomalies and provides risk assessment + pattern identification.
 *
 * Phase 7 Wave 1 — SA-07
 * RDC 978 Art. 107 — AI-assisted anomaly insight
 * DICQ 4.4 — Monitoring interpretation
 */

import { createAIClient } from './ai/aiClient';
import { PATTERN_ANALYSIS_PROMPT } from './ai/prompts';
import type { PatternAnalysisContext } from './ai/prompts';
import type { BaselineStats } from './normalizeBaseline';

/**
 * Anomaly score from Phase 7 Wave 1 computation
 * Server-side type (mirrors src/features/qualidade/types/anomalyTypes.ts)
 */
export interface AnomalyScore {
  entryId: string;
  labId: string;
  operatorId: string;
  overallScore: number;
  dimensions: Array<{
    dimension: string;
    score: number;
    evidence: string;
  }>;
  computedAt: number;
  aiInsight?: string;
}

/**
 * AI-generated insight about an anomaly
 * Identifies patterns, assesses risk, provides summary for audit trail
 */
export interface AiInsight {
  patterns: string[]; // List of identified patterns
  riskLevel: 'low' | 'medium' | 'high';
  summary: string; // 1-line human-readable summary for audit trail
}

/**
 * Analyze operator behavior anomaly using Gemini 2.5 Flash
 * Integrates anomaly score + baseline context for pattern recognition
 *
 * @param anomalyScore Computed anomaly score with dimension breakdown
 * @param historicalContext Historical baseline statistics
 * @returns AI insight with patterns, risk level, and summary
 */
export async function analyzePattern(
  anomalyScore: AnomalyScore,
  historicalContext: BaselineStats,
): Promise<AiInsight> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return buildFallbackInsight(anomalyScore);
    }

    const client = createAIClient({ apiKey, model: 'gemini-2.5-flash' });
    const ctx = buildPromptContext(anomalyScore, historicalContext);
    const result = await client.generateJSON<AiInsight>({
      systemPrompt: PATTERN_ANALYSIS_PROMPT.system,
      prompt: PATTERN_ANALYSIS_PROMPT.template(ctx),
    });

    // Validate required fields
    if (
      !Array.isArray(result.parsed.patterns) ||
      typeof result.parsed.riskLevel !== 'string' ||
      typeof result.parsed.summary !== 'string'
    ) {
      return buildFallbackInsight(anomalyScore);
    }

    return {
      patterns: result.parsed.patterns.slice(0, 5),
      riskLevel: (['low', 'medium', 'high'].includes(result.parsed.riskLevel)
        ? result.parsed.riskLevel
        : 'medium') as 'low' | 'medium' | 'high',
      summary: result.parsed.summary.substring(0, 200),
    };
  } catch (error) {
    // Graceful fallback if Gemini fails
    return buildFallbackInsight(anomalyScore);
  }
}

/**
 * Build prompt context from anomaly score and baseline stats
 * Transforms raw data into the shape expected by PATTERN_ANALYSIS_PROMPT.template
 */
function buildPromptContext(
  anomalyScore: AnomalyScore,
  baseline: BaselineStats,
): PatternAnalysisContext {
  const topOps = Object.entries(baseline.operationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([op, count]) => `${op} (${count}x)`)
    .join(', ');

  const modules = Object.entries(baseline.moduleFrequency)
    .map(([mod, freq]) => `${mod} (${(freq * 100).toFixed(1)}%)`)
    .join(', ');

  const peakHours = getPeakHours(baseline.hourlyPattern).join(', ');

  return {
    operatorId: anomalyScore.operatorId,
    labId: anomalyScore.labId,
    overallScore: anomalyScore.overallScore,
    computedAt: anomalyScore.computedAt,
    dimensions: anomalyScore.dimensions,
    baseline: {
      totalEntries: baseline.totalEntries,
      topOperations: topOps,
      moduleDistribution: modules,
      peakHours,
      entropyScore: baseline.entropyScore,
    },
  };
}

/**
 * Extract peak operating hours from hourly pattern
 *
 * @param hourlyPattern Normalized hourly distribution (0-23)
 * @returns Array of hours with above-average activity
 */
function getPeakHours(hourlyPattern: number[]): number[] {
  const mean = 1 / 24;
  return hourlyPattern.map((p, hour) => (p > mean ? hour : -1)).filter((h) => h !== -1);
}

/**
 * Build fallback insight when Gemini call fails
 * Enables graceful degradation without blocking audit trail
 *
 * @param anomalyScore The anomaly that triggered the analysis
 * @returns Generic insight with high-level risk assessment
 */
function buildFallbackInsight(anomalyScore: AnomalyScore): AiInsight {
  const riskLevel: 'low' | 'medium' | 'high' =
    anomalyScore.overallScore > 75 ? 'high' : anomalyScore.overallScore > 50 ? 'medium' : 'low';

  return {
    patterns: anomalyScore.dimensions.map((d) => d.dimension),
    riskLevel,
    summary: `Anomaly score ${anomalyScore.overallScore}/100; verify operator actions`,
  };
}
