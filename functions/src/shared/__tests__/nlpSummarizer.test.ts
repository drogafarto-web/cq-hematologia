/**
 * nlpSummarizer.test.ts
 *
 * Tests for nlpSummarizer function.
 * Test cases:
 * 1. Successful Gemini summary generation
 * 2. Gemini timeout → fallback to template
 * 3. Gemini error → fallback to template
 * 4. Empty/missing API key → fallback to template
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { summarizeAuditFindings } from '../nlpSummarizer';

// Mock Google Generative AI
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
}));

// Mock Firebase secrets
vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn((name) => ({
    value: vi.fn().mockReturnValue('mock-api-key'),
  })),
}));

import { GoogleGenerativeAI } from '@google/generative-ai';

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
    vi.clearAllMocks();
  });

  it('should generate valid Gemini summary', async () => {
    const mockSummary =
      'Relatório de auditoria com análise de 1000 operações, identificando 15 anomalias com 2 críticas.';

    const mockResponse = {
      text: () => mockSummary,
    };

    const mockGenerateContent = vi
      .fn()
      .mockResolvedValue(mockResponse);

    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent,
      }),
    }) as any);

    const result = await summarizeAuditFindings(mockParams);

    expect(result).toBe(mockSummary);
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('should fallback on Gemini timeout', async () => {
    const mockGenerateContent = vi
      .fn()
      .mockRejectedValue(new Error('Timeout'));

    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent,
      }),
    }) as any);

    const result = await summarizeAuditFindings(mockParams);

    // Should return fallback summary containing key metrics
    expect(result).toContain('janeiro/2026');
    expect(result).toContain('1000');
    expect(result).toContain('15');
    expect(result).toMatch(/hematologia|bioquimica|imunologia/);
  });

  it('should fallback on Gemini error', async () => {
    const mockGenerateContent = vi
      .fn()
      .mockRejectedValue(new Error('API error'));

    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent,
      }),
    }) as any);

    const result = await summarizeAuditFindings(mockParams);

    // Fallback should be a valid string
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(50);
  });

  it('should fallback on empty response', async () => {
    const mockResponse = {
      text: () => '',
    };

    const mockGenerateContent = vi
      .fn()
      .mockResolvedValue(mockResponse);

    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent,
      }),
    }) as any);

    const result = await summarizeAuditFindings(mockParams);

    // Should fallback gracefully
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(50);
    expect(result).toContain('janeiro/2026');
  });

  it('fallback summary should contain all key metrics', async () => {
    const mockGenerateContent = vi
      .fn()
      .mockRejectedValue(new Error('Fail'));

    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent,
      }),
    }) as any);

    const result = await summarizeAuditFindings(mockParams);

    expect(result).toContain('janeiro/2026');
    expect(result).toContain('1000');
    expect(result).toContain('15');
    expect(result).toContain('2');
    expect(result).toContain('5');
    expect(result).toContain('hematologia');
  });
});
