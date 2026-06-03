/**
 * aiPatternMatcher.test.ts
 *
 * Phase 7 Wave 1 — SA-07: Gemini-powered pattern matching via AIClient
 * Tests: successful generation, validation fallback, error fallback, no API key fallback
 *
 * RDC 978 Art. 107 — AI-assisted anomaly analysis
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockGenerateJSON = jest.fn<() => Promise<unknown>>();

jest.mock('../ai/aiClient', () => ({
  createAIClient: jest.fn(() => ({
    generateJSON: mockGenerateJSON,
  })),
}));

import { analyzePattern } from '../aiPatternMatcher';
import type { AnomalyScore, AiInsight } from '../aiPatternMatcher';
import { createAIClient } from '../ai/aiClient';
import type { BaselineStats } from '../normalizeBaseline';

describe('aiPatternMatcher — Phase 7 Wave 1 (SA-07)', () => {
  const mockAnomalyScore: AnomalyScore = {
    entryId: 'entry-001',
    labId: 'lab-riopomba',
    operatorId: 'user-001',
    overallScore: 72,
    dimensions: [
      {
        dimension: 'operation_rarity',
        score: 85,
        evidence: 'export operation not typical for this operator',
      },
      {
        dimension: 'time_anomaly',
        score: 60,
        evidence: 'operation at 3 AM, unusual time',
      },
    ],
    computedAt: Date.now(),
  };

  const mockBaseline: BaselineStats = {
    operationCounts: { create: 145, update: 89, delete: 12 },
    moduleFrequency: { capa: 0.62, analise: 0.38 },
    hourlyPattern: Array(24).fill(1 / 24),
    totalEntries: 246,
    entropyScore: 0.78,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should return AI insight when generateJSON succeeds', async () => {
    const mockInsight: AiInsight = {
      patterns: ['unusual_time_of_day', 'operation_rarity'],
      riskLevel: 'high',
      summary: 'Export operation at 3 AM with rare action type',
    };

    mockGenerateJSON.mockResolvedValue({
      parsed: mockInsight,
      raw: JSON.stringify(mockInsight),
      model: 'gemini-2.5-flash',
    });

    const result = await analyzePattern(mockAnomalyScore, mockBaseline);

    expect(result.patterns).toEqual(['unusual_time_of_day', 'operation_rarity']);
    expect(result.riskLevel).toBe('high');
    expect(result.summary).toBe('Export operation at 3 AM with rare action type');
    expect(createAIClient).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      model: 'gemini-2.5-flash',
    });
    expect(mockGenerateJSON).toHaveBeenCalledTimes(1);
  });

  it('should return fallback insight when generateJSON throws', async () => {
    mockGenerateJSON.mockRejectedValue(new Error('API timeout'));

    const result = await analyzePattern(mockAnomalyScore, mockBaseline);

    expect(result.riskLevel).toBe('medium');
    expect(result.patterns).toEqual(['operation_rarity', 'time_anomaly']);
    expect(result.summary).toContain('72/100');
  });

  it('should return fallback insight when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await analyzePattern(mockAnomalyScore, mockBaseline);

    expect(result.riskLevel).toBe('medium');
    expect(result.patterns).toEqual(['operation_rarity', 'time_anomaly']);
    expect(createAIClient).not.toHaveBeenCalled();
  });

  it('should return fallback when response has invalid structure', async () => {
    mockGenerateJSON.mockResolvedValue({
      parsed: { patterns: 'not-an-array', riskLevel: 123, summary: null },
      raw: '{}',
      model: 'gemini-2.5-flash',
    });

    const result = await analyzePattern(mockAnomalyScore, mockBaseline);

    expect(result.riskLevel).toBe('medium');
    expect(result.patterns).toEqual(['operation_rarity', 'time_anomaly']);
  });

  it('should cap patterns at 5 and summary at 200 chars', async () => {
    mockGenerateJSON.mockResolvedValue({
      parsed: {
        patterns: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        riskLevel: 'low',
        summary: 'x'.repeat(300),
      },
      raw: '{}',
      model: 'gemini-2.5-flash',
    });

    const result = await analyzePattern(mockAnomalyScore, mockBaseline);

    expect(result.patterns).toHaveLength(5);
    expect(result.summary.length).toBeLessThanOrEqual(200);
  });

  it('should normalize invalid riskLevel to medium', async () => {
    mockGenerateJSON.mockResolvedValue({
      parsed: {
        patterns: ['burst_activity'],
        riskLevel: 'critical',
        summary: 'Some summary',
      },
      raw: '{}',
      model: 'gemini-2.5-flash',
    });

    const result = await analyzePattern(mockAnomalyScore, mockBaseline);

    expect(result.riskLevel).toBe('medium');
  });
});
