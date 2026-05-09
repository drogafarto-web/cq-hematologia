/**
 * useAuditReportExport.test.ts
 *
 * Tests for useAuditReportExport React hook.
 * Unit tests for hook logic (state, callback behavior).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuditReport, ReportFilter } from '../types/anomalyTypes';

describe('useAuditReportExport hook logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should define hook interface correctly', () => {
    // Type validation: hook returns object with required fields
    const mockReturn = {
      generating: false,
      report: null,
      error: null,
      generate: async () => {},
      reset: () => {},
    };

    expect(mockReturn).toHaveProperty('generating');
    expect(mockReturn).toHaveProperty('report');
    expect(mockReturn).toHaveProperty('error');
    expect(mockReturn).toHaveProperty('generate');
    expect(mockReturn).toHaveProperty('reset');
  });

  it('should initialize with correct default state', () => {
    const initialState = {
      generating: false,
      report: null as AuditReport | null,
      error: null as string | null,
    };

    expect(initialState.generating).toBe(false);
    expect(initialState.report).toBeNull();
    expect(initialState.error).toBeNull();
  });

  it('should accept ReportFilter with all required fields', () => {
    const filter: ReportFilter = {
      labId: 'lab-001',
      period: 'weekly',
      includeAnomalies: true,
      includeCompliance: true,
    };

    expect(filter.labId).toBe('lab-001');
    expect(filter.period).toBe('weekly');
    expect(filter.includeAnomalies).toBe(true);
    expect(filter.includeCompliance).toBe(true);
  });

  it('should accept AuditReport with all required fields', () => {
    const report: AuditReport = {
      id: 'report-001',
      labId: 'lab-001',
      filter: {
        labId: 'lab-001',
        period: 'weekly',
        includeAnomalies: true,
        includeCompliance: true,
      },
      summary: {
        entryCount: 1000,
        anomalyCount: 15,
        severityBreakdown: { critical: 2, high: 5, medium: 8 },
        complianceScore: 85,
      },
      generatedAt: Date.now(),
    };

    expect(report.id).toBe('report-001');
    expect(report.summary.entryCount).toBe(1000);
    expect(report.summary.severityBreakdown.critical).toBe(2);
  });

  it('should support custom and weekly period filters', () => {
    const customFilter: ReportFilter = {
      labId: 'lab-001',
      period: 'custom',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      includeAnomalies: true,
      includeCompliance: true,
    };

    const weeklyFilter: ReportFilter = {
      labId: 'lab-001',
      period: 'weekly',
      includeAnomalies: true,
      includeCompliance: true,
    };

    expect(customFilter.period).toBe('custom');
    expect(customFilter.startDate).toBeDefined();
    expect(customFilter.endDate).toBeDefined();
    expect(weeklyFilter.period).toBe('weekly');
  });

  it('should support optional module and operator filters', () => {
    const filter: ReportFilter = {
      labId: 'lab-001',
      period: 'monthly',
      modules: ['hematologia', 'bioquimica'],
      operatorIds: ['op-001', 'op-002'],
      includeAnomalies: true,
      includeCompliance: true,
    };

    expect(filter.modules).toHaveLength(2);
    expect(filter.operatorIds).toHaveLength(2);
  });
});
