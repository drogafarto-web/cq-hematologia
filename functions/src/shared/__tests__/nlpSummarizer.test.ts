/**
 * nlpSummarizer.test.ts
 *
 * Tests for nlpSummarizer function.
 * Test cases:
 * 1. Successful Gemini summary generation via AIClient
 * 2. Gemini timeout → fallback to template
 * 3. Gemini error → fallback to template
 * 4. Empty/missing API key → fallback to template
 */

const mockGenerateText = jest.fn();

jest.mock('../ai/aiClient', () => ({
  createAIClient: jest.fn(() => ({
    generateText: mockGenerateText,
    generateJSON: jest.fn(),
    generateVision: jest.fn(),
  })),
}));

jest.mock('firebase-functions/params', () => ({
  defineSecret: jest.fn(() => ({
    value: jest.fn().mockReturnValue('mock-api-key'),
  })),
}));

jest.mock('firebase-functions/logger', () => ({
  warn: jest.fn(),
}));

import { summarizeAuditFindings } from '../nlpSummarizer';
import { createAIClient } from '../ai/aiClient';

describe('nlpSummarizer', () => {
  const mockParams = {
    entryCount: 1000,
    anomalyCount: 15,
    period: 'janeiro/2026',
    topModules: ['hematologia', 'bioquimica', 'imunologia'],
    criticalCount: 2,
    highCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-wire default mock for createAIClient
    (createAIClient as jest.Mock).mockReturnValue({
      generateText: mockGenerateText,
      generateJSON: jest.fn(),
      generateVision: jest.fn(),
    });
  });

  it('should generate valid Gemini summary via AIClient', async () => {
    const mockSummary =
      'Relatório de auditoria com análise de 1000 operações, identificando 15 anomalias com 2 críticas.';

    mockGenerateText.mockResolvedValue({ text: mockSummary, model: 'gemini-2.5-flash' });

    const result = await summarizeAuditFindings(mockParams);

    expect(result).toBe(mockSummary);
    expect(createAIClient).toHaveBeenCalledWith({
      apiKey: 'mock-api-key',
      model: 'gemini-2.5-flash',
    });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('1000'),
        systemPrompt: expect.stringContaining('qualidade laboratorial'),
      }),
    );
  });

  it('should fallback on Gemini timeout', async () => {
    mockGenerateText.mockRejectedValue(new Error('Timeout'));

    const result = await summarizeAuditFindings(mockParams);

    expect(result).toContain('janeiro/2026');
    expect(result).toContain('1000');
    expect(result).toContain('15');
    expect(result).toMatch(/hematologia|bioquimica|imunologia/);
  });

  it('should fallback on Gemini error', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'));

    const result = await summarizeAuditFindings(mockParams);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(50);
  });

  it('should fallback on empty response', async () => {
    mockGenerateText.mockRejectedValue(new Error('Empty response from AI provider'));

    const result = await summarizeAuditFindings(mockParams);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(50);
    expect(result).toContain('janeiro/2026');
  });

  it('fallback summary should contain all key metrics', async () => {
    mockGenerateText.mockRejectedValue(new Error('Fail'));

    const result = await summarizeAuditFindings(mockParams);

    expect(result).toContain('janeiro/2026');
    expect(result).toContain('1000');
    expect(result).toContain('15');
    expect(result).toContain('2');
    expect(result).toContain('5');
    expect(result).toContain('hematologia');
  });
});
