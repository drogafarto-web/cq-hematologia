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

import { GoogleGenerativeAI } from '@google/generative-ai';
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
  patterns: string[];           // List of identified patterns
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;              // 1-line human-readable summary for audit trail
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
  historicalContext: BaselineStats
): Promise<AiInsight> {
  try {
    const prompt = buildPrompt(anomalyScore, historicalContext);
    const insight = await callGemini(prompt);
    return parseInsight(insight);
  } catch (error) {
    // Graceful fallback if Gemini fails
    return buildFallbackInsight(anomalyScore);
  }
}

/**
 * Build prompt for Gemini analysis
 * Includes anomaly dimensions, baseline context, and analysis instructions
 *
 * @param anomalyScore The computed anomaly score
 * @param baseline Historical baseline model
 * @returns Formatted prompt for Gemini
 */
function buildPrompt(
  anomalyScore: AnomalyScore,
  baseline: BaselineStats
): string {
  const dimensionLines = anomalyScore.dimensions
    .map((d) => `- ${d.dimension}: ${d.score}/100 (${d.evidence})`)
    .join('\n');

  const topOps = Object.entries(baseline.operationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([op, count]) => `${op} (${count}x)`)
    .join(', ');

  const modules = Object.entries(baseline.moduleFrequency)
    .map(([mod, freq]) => `${mod} (${(freq * 100).toFixed(1)}%)`)
    .join(', ');

  const peakHours = getPeakHours(baseline.hourlyPattern).join(', ');

  return `
Analyze this laboratory operator behavior anomaly (RDC 978 Art. 107, DICQ 4.4):

**Anomaly Details:**
- Operator: ${anomalyScore.operatorId}
- Lab: ${anomalyScore.labId}
- Overall Score: ${anomalyScore.overallScore}/100
- Timestamp: ${new Date(anomalyScore.computedAt).toISOString()}

**Dimension Breakdown:**
${dimensionLines}

**Historical Baseline:**
- Total Entries: ${baseline.totalEntries}
- Common Operations: ${topOps}
- Module Distribution: ${modules}
- Peak Hours: ${peakHours}
- Entropy (Behavior Diversity): ${baseline.entropyScore.toFixed(2)}

**Task:**
Identify specific patterns, assess risk level (low/medium/high), and provide a 1-line summary.

**Response format (JSON only, no markdown):**
{
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "riskLevel": "low|medium|high",
  "summary": "1-line summary for audit trail"
}

Patterns should be specific to laboratory compliance context (e.g., "unusual_time_of_day", "operator_jump_to_new_module", "burst_activity", "result_manipulation_signal").
`;
}

/**
 * Extract peak operating hours from hourly pattern
 *
 * @param hourlyPattern Normalized hourly distribution (0-23)
 * @returns Array of hours with above-average activity
 */
function getPeakHours(hourlyPattern: number[]): number[] {
  const mean = 1 / 24;
  return hourlyPattern
    .map((p, hour) => (p > mean ? hour : -1))
    .filter((h) => h !== -1);
}

/**
 * Call Gemini 2.5 Flash API with the prompt
 * Uses project's Google Generative AI SDK
 *
 * @param prompt Formatted analysis prompt
 * @returns Raw Gemini response text
 */
async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  return text;
}

/**
 * Parse Gemini response into typed AiInsight
 * Expects JSON response, falls back to generic insight on parse failure
 *
 * @param geminResponse Raw text response from Gemini
 * @returns Parsed AiInsight object
 */
function parseInsight(geminResponse: string): AiInsight {
  try {
    // Extract JSON from response (Gemini might wrap it in markdown or other text)
    const jsonMatch = geminResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!Array.isArray(parsed.patterns) || typeof parsed.riskLevel !== 'string' || typeof parsed.summary !== 'string') {
      throw new Error('Invalid response structure');
    }

    return {
      patterns: parsed.patterns.slice(0, 5),  // Limit to 5 patterns
      riskLevel: (['low', 'medium', 'high'].includes(parsed.riskLevel)
        ? parsed.riskLevel
        : 'medium') as 'low' | 'medium' | 'high',
      summary: parsed.summary.substring(0, 200),  // Limit summary length
    };
  } catch (error) {
    // Return generic insight if parsing fails
    return {
      patterns: ['unknown_pattern'],
      riskLevel: 'medium',
      summary: 'Anomaly detected; manual review recommended',
    };
  }
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
    anomalyScore.overallScore > 75
      ? 'high'
      : anomalyScore.overallScore > 50
        ? 'medium'
        : 'low';

  return {
    patterns: anomalyScore.dimensions.map((d) => d.dimension),
    riskLevel,
    summary: `Anomaly score ${anomalyScore.overallScore}/100; verify operator actions`,
  };
}
