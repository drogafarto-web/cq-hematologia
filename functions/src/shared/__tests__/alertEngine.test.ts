/**
 * alertEngine.test.ts
 *
 * Test suite for alert generation and routing engine
 */

import { describe, it, expect } from '@jest/globals';
import {
  classifySeverity,
  routeAlert,
  generateAlert,
  checkEscalation,
} from '../alertEngine';
import type { AnomalyDetectionResult } from '../anomalyDetector';

/**
 * Helper: create mock anomaly detection result
 */
function mockAnomaly(overrides?: Partial<AnomalyDetectionResult>): AnomalyDetectionResult {
  return {
    entryId: 'entry-001',
    overall: 0.5,
    dimensions: [
      { dimension: 'operation_rarity', score: 0.3, evidence: 'Common operation' },
      { dimension: 'time_anomaly', score: 0.2, evidence: 'Normal hours' },
      { dimension: 'result_rarity', score: 0.0, evidence: 'Success result' },
      { dimension: 'velocity', score: 0.0, evidence: 'Normal velocity' },
      { dimension: 'module_jump', score: 0.0, evidence: 'No module jump' },
    ],
    flags: [],
    ...overrides,
  };
}

describe('alertEngine', () => {
  describe('classifySeverity', () => {
    it('should classify >= 0.95 as critical', () => {
      expect(classifySeverity(0.97)).toBe('critical');
      expect(classifySeverity(1.0)).toBe('critical');
    });

    it('should classify 0.85-0.94 as high', () => {
      expect(classifySeverity(0.88)).toBe('high');
      expect(classifySeverity(0.85)).toBe('high');
    });

    it('should classify 0.70-0.84 as medium', () => {
      expect(classifySeverity(0.71)).toBe('medium');
      expect(classifySeverity(0.80)).toBe('medium');
    });

    it('should classify < 0.70 as medium (floor)', () => {
      expect(classifySeverity(0.69)).toBe('medium');
      expect(classifySeverity(0.5)).toBe('medium');
      expect(classifySeverity(0.0)).toBe('medium');
    });
  });

  describe('routeAlert', () => {
    it('should route critical to rt and admin', () => {
      const routes = routeAlert('critical');

      expect(routes).toContain('rt');
      expect(routes).toContain('admin');
      expect(routes.length).toBe(2);
    });

    it('should route high to rt and auditor', () => {
      const routes = routeAlert('high');

      expect(routes).toContain('rt');
      expect(routes).toContain('auditor');
      expect(routes.length).toBe(2);
    });

    it('should route medium to auditor only', () => {
      const routes = routeAlert('medium');

      expect(routes).toEqual(['auditor']);
    });
  });

  describe('generateAlert', () => {
    it('should return null for anomaly below 0.85 threshold', () => {
      const anomaly = mockAnomaly({ overall: 0.60 });

      const alert = generateAlert(anomaly, 'lab-001');

      expect(alert).toBeNull();
    });

    it('should return alert for anomaly >= 0.85', () => {
      const anomaly = mockAnomaly({ overall: 0.90 });

      const alert = generateAlert(anomaly, 'lab-001');

      expect(alert).not.toBeNull();
      expect(alert!.entryId).toBe('entry-001');
      expect(alert!.labId).toBe('lab-001');
    });

    it('should set severity to high for 0.90 score', () => {
      const anomaly = mockAnomaly({ overall: 0.90 });

      const alert = generateAlert(anomaly, 'lab-001');

      expect(alert!.severity).toBe('high');
    });

    it('should set severity to critical for 0.97 score', () => {
      const anomaly = mockAnomaly({ overall: 0.97 });

      const alert = generateAlert(anomaly, 'lab-001');

      expect(alert!.severity).toBe('critical');
    });

    it('should set status to active at creation', () => {
      const anomaly = mockAnomaly({ overall: 0.90 });

      const alert = generateAlert(anomaly, 'lab-001');

      expect(alert!.status).toBe('active');
    });

    it('should set anomalyScore to overall score', () => {
      const anomaly = mockAnomaly({ overall: 0.88 });

      const alert = generateAlert(anomaly, 'lab-001');

      expect(alert!.anomalyScore).toBe(0.88);
    });

    it('should populate routedTo based on severity', () => {
      const anomaly = mockAnomaly({ overall: 0.90 });

      const alert = generateAlert(anomaly, 'lab-001');

      // High severity routes to rt and auditor
      expect(alert!.routedTo).toContain('rt');
      expect(alert!.routedTo).toContain('auditor');
    });

    it('should set createdAt to current timestamp', () => {
      const anomaly = mockAnomaly({ overall: 0.90 });
      const before = Date.now();

      const alert = generateAlert(anomaly, 'lab-001');

      const after = Date.now();
      expect(alert!.createdAt).toBeGreaterThanOrEqual(before);
      expect(alert!.createdAt).toBeLessThanOrEqual(after);
    });

    it('should respect custom alert threshold', () => {
      const anomaly = mockAnomaly({ overall: 0.75 });

      const alert = generateAlert(anomaly, 'lab-001', 0.70);

      expect(alert).not.toBeNull();
      expect(alert!.severity).toBe('medium');
    });

    it('should generate unique alert IDs', async () => {
      const anomaly1 = mockAnomaly({ overall: 0.90, entryId: 'entry-001' });
      const anomaly2 = mockAnomaly({ overall: 0.90, entryId: 'entry-002' });

      const alert1 = generateAlert(anomaly1, 'lab-001');
      // Different entries will have different IDs
      const alert2 = generateAlert(anomaly2, 'lab-001');

      expect(alert1!.id).not.toBe(alert2!.id);
    });
  });

  describe('checkEscalation', () => {
    it('should escalate to critical when velocity and operation_rarity both > 0.7', () => {
      const anomaly = mockAnomaly({
        dimensions: [
          { dimension: 'operation_rarity', score: 0.75, evidence: 'Rare operation' },
          { dimension: 'time_anomaly', score: 0.2, evidence: '' },
          { dimension: 'result_rarity', score: 0.0, evidence: '' },
          { dimension: 'velocity', score: 0.8, evidence: 'High velocity' },
          { dimension: 'module_jump', score: 0.0, evidence: '' },
        ],
        flags: [],
      });

      const escalated = checkEscalation(anomaly);

      expect(escalated).toBe('critical');
    });

    it('should escalate to high when time_anomaly and result_rarity both > 0.6', () => {
      const anomaly = mockAnomaly({
        dimensions: [
          { dimension: 'operation_rarity', score: 0.3, evidence: '' },
          { dimension: 'time_anomaly', score: 0.65, evidence: 'Off-hours' },
          { dimension: 'result_rarity', score: 0.65, evidence: 'Failure' },
          { dimension: 'velocity', score: 0.0, evidence: '' },
          { dimension: 'module_jump', score: 0.0, evidence: '' },
        ],
        flags: [],
      });

      const escalated = checkEscalation(anomaly);

      expect(escalated).toBe('high');
    });

    it('should return null when no escalation rule matches', () => {
      const anomaly = mockAnomaly({
        dimensions: [
          { dimension: 'operation_rarity', score: 0.3, evidence: '' },
          { dimension: 'time_anomaly', score: 0.2, evidence: '' },
          { dimension: 'result_rarity', score: 0.0, evidence: '' },
          { dimension: 'velocity', score: 0.0, evidence: '' },
          { dimension: 'module_jump', score: 0.0, evidence: '' },
        ],
        flags: [],
      });

      const escalated = checkEscalation(anomaly);

      expect(escalated).toBeNull();
    });

    it('should not escalate if only one high dimension', () => {
      const anomaly = mockAnomaly({
        dimensions: [
          { dimension: 'operation_rarity', score: 0.8, evidence: '' },
          { dimension: 'time_anomaly', score: 0.2, evidence: '' },
          { dimension: 'result_rarity', score: 0.0, evidence: '' },
          { dimension: 'velocity', score: 0.3, evidence: '' },
          { dimension: 'module_jump', score: 0.0, evidence: '' },
        ],
        flags: [],
      });

      const escalated = checkEscalation(anomaly);

      expect(escalated).toBeNull();
    });
  });
});
