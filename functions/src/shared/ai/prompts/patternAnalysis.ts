export interface PatternAnalysisContext {
  operatorId: string;
  labId: string;
  overallScore: number;
  computedAt: number;
  dimensions: Array<{ dimension: string; score: number; evidence: string }>;
  baseline: {
    totalEntries: number;
    topOperations: string;
    moduleDistribution: string;
    peakHours: string;
    entropyScore: number;
  };
}

export const PATTERN_ANALYSIS_PROMPT = {
  version: '1.0.0',
  system: `You analyze laboratory operator behavior anomalies for compliance monitoring (RDC 978 Art. 107, DICQ 4.4). You identify patterns, assess risk, and provide concise summaries for audit trails. Respond only with valid JSON.`,
  template: (ctx: PatternAnalysisContext) => `Analyze this operator behavior anomaly:

Anomaly Details:
- Operator: ${ctx.operatorId}
- Lab: ${ctx.labId}
- Overall Score: ${ctx.overallScore}/100
- Timestamp: ${new Date(ctx.computedAt).toISOString()}

Dimension Breakdown:
${ctx.dimensions.map((d) => `- ${d.dimension}: ${d.score}/100 (${d.evidence})`).join('\n')}

Historical Baseline:
- Total Entries: ${ctx.baseline.totalEntries}
- Common Operations: ${ctx.baseline.topOperations}
- Module Distribution: ${ctx.baseline.moduleDistribution}
- Peak Hours: ${ctx.baseline.peakHours}
- Entropy (Behavior Diversity): ${ctx.baseline.entropyScore.toFixed(2)}

Respond with JSON:
{
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "riskLevel": "low|medium|high",
  "summary": "1-line summary for audit trail"
}

Patterns should be specific to laboratory compliance (e.g., "unusual_time_of_day", "operator_jump_to_new_module", "burst_activity").`,
} as const;
