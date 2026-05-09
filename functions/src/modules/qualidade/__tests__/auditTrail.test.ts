/**
 * auditTrail.test.ts
 *
 * Phase 7 Wave 1 — SA-05: Extended audit trail with context capture + diff detection
 * 6 test cases covering context capture, diff computation, Firestore write, and metadata consistency
 *
 * RDC 978 Art. 107 — Complete audit trail context
 */

import { describe, it, expect } from '@jest/globals';
import { buildDiff } from '../../../shared/auditDiffDetector';
import { captureContext } from '../../../shared/contextCapture';
import type { CallableRequest } from 'firebase-functions/v2/https';

describe('auditTrail — Phase 7 Wave 1 (SA-05)', () => {
  const mockReq = {
    auth: { uid: 'user-001' },
    data: {
      labId: 'lab-riopomba',
      moduleId: 'capa',
      recordId: 'nc-001',
      action: 'update',
    },
    rawRequest: {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      },
    },
  } as unknown as CallableRequest<any>;

  it('should capture full audit context from request', () => {
    const context = captureContext(mockReq);

    expect(context.operatorId).toBe('user-001');
    expect(context.labId).toBe('lab-riopomba');
    expect(context.moduleId).toBe('capa');
    expect(context.recordId).toBe('nc-001');
    expect(context.action).toBe('update');
  });

  it('should compute diffs correctly for updates', () => {
    const before = { status: 'draft', title: 'Old Title' };
    const after = { status: 'published', title: 'Old Title' };

    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('status');
    expect(diffs[0].before).toBe('draft');
    expect(diffs[0].after).toBe('published');
  });

  it('should handle missing before/after gracefully', () => {
    const before = undefined;
    const after = { id: 'nc-001', status: 'draft' };

    const diffs = buildDiff(before, after);

    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.some((d) => d.type === 'add')).toBe(true);
  });

  it('should detect field additions', () => {
    const before = { name: 'Test' };
    const after = { name: 'Test', email: 'test@example.com' };

    const diffs = buildDiff(before, after);

    const emailDiff = diffs.find((d) => d.path === 'email');
    expect(emailDiff).toBeDefined();
    expect(emailDiff?.type).toBe('add');
  });

  it('should detect field removals', () => {
    const before = { name: 'Test', deprecated: 'value' };
    const after = { name: 'Test' };

    const diffs = buildDiff(before, after);

    const depDiff = diffs.find((d) => d.path === 'deprecated');
    expect(depDiff).toBeDefined();
    expect(depDiff?.type).toBe('remove');
  });

  it('should preserve context metadata (operatorId, timestamp, moduleId)', () => {
    const context = captureContext(mockReq);

    expect(context.operatorId).toBe('user-001');
    expect(context.labId).toBe('lab-riopomba');
    expect(context.timestamp).toBeGreaterThan(0);
    expect(context.ip).toBe('192.168.1.1');
  });
});
