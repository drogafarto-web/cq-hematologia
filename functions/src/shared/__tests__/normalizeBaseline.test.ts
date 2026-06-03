/**
 * normalizeBaseline.test.ts
 *
 * Phase 7 Wave 1 — SA-06: Baseline computation and anomaly scoring
 * 7 test cases covering aggregation, normalization, entropy, and anomaly detection
 *
 * RDC 978 Art. 107 — Baseline model for anomaly detection
 */

import { describe, it, expect } from '@jest/globals';
import * as admin from 'firebase-admin';
import { computeBaseline, normalizeBaseline, type BaselineStats } from '../normalizeBaseline';
import type { QualidadeAuditEntry } from '../../modules/qualidade/types';

// Initialize Firebase for testing (using default/emulator)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'test-project',
    });
  } catch (e) {
    // Already initialized
  }
}

describe('normalizeBaseline — Phase 7 Wave 1 (SA-06)', () => {
  const mockEntries = (
    count: number,
    overrides?: Array<Partial<QualidadeAuditEntry>>,
  ): QualidadeAuditEntry[] => {
    const entries: QualidadeAuditEntry[] = [];
    for (let i = 0; i < count; i++) {
      const baseEntry: QualidadeAuditEntry = {
        labId: 'lab-test',
        operation: i % 3 === 0 ? 'create' : i % 3 === 1 ? 'update' : 'delete',
        modulo: i % 2 === 0 ? 'capa' : 'analise',
        acao: 'audit',
        resultado: 'sucesso',
        operatorId: 'user-001',
        payload: {},
        timestamp: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - (count - i) * 3600000), // Spread over hours
        ),
        deletadoEm: null,
        previousHash: null,
        hmac: '',
        hash: '',
      };

      const override = overrides?.find((_, idx) => idx === i);
      entries.push({ ...baseEntry, ...override });
    }
    return entries;
  };

  it('should handle empty entries gracefully', () => {
    const baseline = computeBaseline([]);

    expect(baseline.operationCounts).toEqual({});
    expect(baseline.totalEntries).toBe(0);
    expect(baseline.hourlyPattern.length).toBe(24);
    expect(baseline.hourlyPattern.every((p) => Math.abs(p - 1 / 24) < 0.001)).toBe(true);
    expect(baseline.entropyScore).toBeCloseTo(1.0); // Uniform = max entropy
  });

  it('should aggregate operation counts correctly', () => {
    const entries = mockEntries(15);

    const baseline = computeBaseline(entries);

    expect(baseline.totalEntries).toBe(15);
    expect(baseline.operationCounts['create']).toBe(5); // 15/3
    expect(baseline.operationCounts['update']).toBe(5);
    expect(baseline.operationCounts['delete']).toBe(5);
  });

  it('should normalize module frequency to sum=1', () => {
    const entries = mockEntries(20); // 10 capa, 10 analise

    const baseline = computeBaseline(entries);

    const freqSum = Object.values(baseline.moduleFrequency).reduce((a, b) => a + b, 0);
    expect(freqSum).toBeCloseTo(1.0, 5);
    expect(baseline.moduleFrequency['capa']).toBeCloseTo(0.5, 2);
    expect(baseline.moduleFrequency['analise']).toBeCloseTo(0.5, 2);
  });

  it('should build hourly pattern distribution', () => {
    const entries = mockEntries(24); // 1 per hour

    const baseline = computeBaseline(entries);

    expect(baseline.hourlyPattern.length).toBe(24);
    const sum = baseline.hourlyPattern.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should compute entropy as diversity measure', () => {
    // Uniform distribution (high entropy)
    const uniformEntries = mockEntries(24);
    const uniformBaseline = computeBaseline(uniformEntries);

    // Skewed distribution (low entropy)
    const skewedEntries: QualidadeAuditEntry[] = [];
    for (let i = 0; i < 24; i++) {
      skewedEntries.push({
        labId: 'lab-test',
        operation: 'create',
        modulo: 'capa',
        acao: 'audit',
        resultado: 'sucesso',
        operatorId: 'user-001',
        payload: {},
        timestamp: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - (i % 2) * 3600000), // Only 2 distinct hours
        ),
        deletadoEm: null,
        previousHash: null,
        hmac: '',
        hash: '',
      });
    }
    const skewedBaseline = computeBaseline(skewedEntries);

    expect(uniformBaseline.entropyScore).toBeGreaterThan(skewedBaseline.entropyScore);
  });

  it('should score anomaly for rare operations', () => {
    const entries = mockEntries(100);

    const baseline = computeBaseline(entries);

    // Score an entry with a rare operation
    const rareEntry: QualidadeAuditEntry = {
      labId: 'lab-test',
      operation: 'export', // Not in baseline
      modulo: 'capa',
      acao: 'audit',
      resultado: 'sucesso',
      operatorId: 'user-001',
      payload: {},
      timestamp: admin.firestore.Timestamp.now(),
      deletadoEm: null,
      previousHash: null,
      hmac: '',
      hash: '',
    };

    const score = normalizeBaseline(baseline, rareEntry);
    expect(score).toBeGreaterThan(0.3); // Rare operation should score high
  });

  it('should return 0 score when no baseline entries exist', () => {
    const baseline: BaselineStats = {
      operationCounts: {},
      moduleFrequency: {},
      hourlyPattern: Array(24).fill(1 / 24),
      totalEntries: 0,
      entropyScore: 1.0,
    };

    const entry = mockEntries(1)[0];
    const score = normalizeBaseline(baseline, entry);

    expect(score).toBe(0); // No baseline data → assume normal
  });
});
