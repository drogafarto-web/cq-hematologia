/**
 * Tests for csvGenerator.ts
 *
 * Uses vitest (run from project root with: npx vitest run functions/src/__tests__/export/csvGenerator.test.ts)
 * Mocks firebase-admin/firestore to avoid real Firestore connections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock firebase-admin/firestore ─────────────────────────────────────────────

const mockDocs = [
  {
    id: 'doc1',
    data: () => ({
      timestamp: { toDate: () => new Date('2025-01-15T10:30:00.000Z') },
      operatorId: 'op-001',
      action: 'CREATE_RUN',
      resourceType: 'run',
      resourceId: 'run-001',
      previousHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123',
      newHash: 'xyz789ghi012xyz789ghi012xyz789ghi012xyz789ghi012xyz789ghi012xyz789',
      labId: 'lab-test',
    }),
  },
  {
    id: 'doc2',
    data: () => ({
      timestamp: { toDate: () => new Date('2025-01-16T14:00:00.000Z') },
      operatorId: 'op-002',
      action: 'UPDATE_RUN',
      resourceType: 'run',
      resourceId: 'run-002',
      previousHash: 'prev2prev2prev2prev2prev2prev2prev2prev2prev2prev2prev2prev2prev22',
      newHash: 'next2next2next2next2next2next2next2next2next2next2next2next2next22',
      labId: 'lab-test',
    }),
  },
  {
    id: 'doc3',
    data: () => ({
      timestamp: { toDate: () => new Date('2025-01-17T08:00:00.000Z') },
      operatorId: 'op-003',
      action: 'DELETE_RUN',
      resourceType: 'run',
      resourceId: 'run-003',
      previousHash: 'prev3prev3prev3prev3prev3prev3prev3prev3prev3prev3prev3prev3prev33',
      newHash: 'next3next3next3next3next3next3next3next3next3next3next3next3next33',
      labId: 'lab-test',
    }),
  },
];

// Pagination: first call returns 3 docs, second returns empty (end of data)
let callCount = 0;

const mockQueryChain = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  startAfter: vi.fn().mockReturnThis(),
  get: vi.fn().mockImplementation(async () => {
    callCount++;
    if (callCount === 1) {
      return {
        empty: false,
        docs: mockDocs,
      };
    }
    // Second page: empty (signals end)
    return {
      empty: true,
      docs: [],
    };
  }),
};

vi.mock('firebase-admin/firestore', () => {
  const Timestamp = {
    fromDate: (d: Date) => ({
      toDate: () => d,
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    }),
  };

  return {
    getFirestore: () => ({
      collection: () => ({
        doc: () => ({
          collection: () => mockQueryChain,
        }),
      }),
    }),
    Timestamp,
  };
});

// ── Import after mock ────────────────────────────────────────────────────────

import { generateCSVAuditLog } from '../../modules/export/csvGenerator';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateCSVAuditLog', () => {
  beforeEach(() => {
    callCount = 0;
    vi.clearAllMocks();
    // Re-setup mock for each test
    mockQueryChain.get.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { empty: false, docs: mockDocs };
      }
      return { empty: true, docs: [] };
    });
  });

  it('returns a Buffer', async () => {
    const result = await generateCSVAuditLog(
      'lab-test',
      new Date('2025-01-01'),
      new Date('2025-01-31'),
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it('starts with UTF-8 BOM (﻿)', async () => {
    const result = await generateCSVAuditLog(
      'lab-test',
      new Date('2025-01-01'),
      new Date('2025-01-31'),
    );
    const content = result.toString('utf8');
    // UTF-8 BOM is U+FEFF, encoded as 0xEF 0xBB 0xBF in UTF-8
    expect(result[0]).toBe(0xef);
    expect(result[1]).toBe(0xbb);
    expect(result[2]).toBe(0xbf);
    // Also verify as string
    expect(content.startsWith('﻿')).toBe(true);
  });

  it('has correct header row', async () => {
    const result = await generateCSVAuditLog(
      'lab-test',
      new Date('2025-01-01'),
      new Date('2025-01-31'),
    );
    const content = result.toString('utf8');
    const lines = content.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe(
      'timestamp,operatorId,action,resourceType,resourceId,previousHash,newHash,labId',
    );
  });

  it('produces exactly 3 data rows (header + 3 = 4 lines total)', async () => {
    const result = await generateCSVAuditLog(
      'lab-test',
      new Date('2025-01-01'),
      new Date('2025-01-31'),
    );
    const content = result.toString('utf8');
    // Split on CRLF, remove empty last element if present
    const lines = content
      .replace('﻿', '')
      .split('\r\n')
      .filter((l) => l.length > 0);
    // 1 header + 3 data rows
    expect(lines.length).toBe(4);
  });

  it('timestamps are ISO 8601 format', async () => {
    const result = await generateCSVAuditLog(
      'lab-test',
      new Date('2025-01-01'),
      new Date('2025-01-31'),
    );
    const content = result.toString('utf8');
    const lines = content
      .replace('﻿', '')
      .split('\r\n')
      .filter((l) => l.length > 0);

    // First data row (lines[1])
    const firstDataCols = lines[1]!.split(',');
    const timestamp = firstDataCols[0]!;

    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(timestamp).toBe('2025-01-15T10:30:00.000Z');
  });

  it('includes all required fields in correct order', async () => {
    const result = await generateCSVAuditLog(
      'lab-test',
      new Date('2025-01-01'),
      new Date('2025-01-31'),
    );
    const content = result.toString('utf8');
    const lines = content
      .replace('﻿', '')
      .split('\r\n')
      .filter((l) => l.length > 0);

    const firstDataCols = lines[1]!.split(',');
    expect(firstDataCols[1]).toBe('op-001'); // operatorId
    expect(firstDataCols[2]).toBe('CREATE_RUN'); // action
    expect(firstDataCols[3]).toBe('run'); // resourceType
    expect(firstDataCols[4]).toBe('run-001'); // resourceId
    expect(firstDataCols[7]).toBe('lab-test'); // labId
  });
});
