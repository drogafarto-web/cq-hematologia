/**
 * contextCapture.test.ts
 *
 * 5 test cases for context capture from Cloud Function request
 */

import { describe, it, expect } from '@jest/globals';
import { captureContext } from '../contextCapture';
import type { CallableRequest } from 'firebase-functions/v2/https';

describe('contextCapture', () => {
  it('should extract operator ID and lab ID', () => {
    const req = {
      auth: { uid: 'op-123' },
      data: { labId: 'lab-456', action: 'create', moduleId: 'ciq', recordId: 'rec-789' },
    } as any as CallableRequest<any>;

    const ctx = captureContext(req);

    expect(ctx.operatorId).toBe('op-123');
    expect(ctx.labId).toBe('lab-456');
  });

  it('should capture timestamp', () => {
    const beforeTime = Date.now();
    const req = {
      auth: { uid: 'op-123' },
      data: { labId: 'lab-456', action: 'update', moduleId: 'bioquim', recordId: 'rec-789' },
    } as any as CallableRequest<any>;

    const ctx = captureContext(req);
    const afterTime = Date.now();

    expect(ctx.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(ctx.timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should parse action from request data', () => {
    const req = {
      auth: { uid: 'op-123' },
      data: { labId: 'lab-456', action: 'delete', moduleId: 'audit', recordId: 'rec-789' },
    } as any as CallableRequest<any>;

    const ctx = captureContext(req);

    expect(ctx.action).toBe('delete');
  });

  it('should extract IP and User-Agent from headers', () => {
    const req = {
      auth: { uid: 'op-123' },
      data: { labId: 'lab-456', action: 'export', moduleId: 'export', recordId: 'rec-789' },
      rawRequest: {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 Test',
        },
        socket: { remoteAddress: '10.0.0.1' },
      },
    } as any as CallableRequest<any>;

    const ctx = captureContext(req);

    expect(ctx.ip).toBe('192.168.1.1');
    expect(ctx.userAgent).toBe('Mozilla/5.0 Test');
  });

  it('should handle missing optional fields gracefully', () => {
    const req = {
      auth: { uid: 'op-123' },
      data: { labId: 'lab-456', moduleId: 'ciq', recordId: 'rec-789' },
      // no action, ip, userAgent provided
    } as any as CallableRequest<any>;

    const ctx = captureContext(req);

    expect(ctx.operatorId).toBe('op-123');
    expect(ctx.labId).toBe('lab-456');
    expect(ctx.action).toBe('create'); // default
    expect(ctx.ip).toBeUndefined();
    expect(ctx.userAgent).toBeUndefined();
  });
});
