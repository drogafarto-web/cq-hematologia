/**
 * Tests for batchExport.ts — Cloud Callable
 *
 * Tests the batchExport callable's atomic job creation and Pub/Sub enqueue.
 * Mocks firebase-admin/firestore, @google-cloud/pubsub, and nanoid.
 *
 * Key assertions:
 * - All job records created via writeBatch.commit() (single atomic call)
 * - One job created per format in the formats array
 * - jobIds.length === formats.length
 * - Rejects with invalid-argument when formats.length > 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Track batch operations
let batchSetCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
let batchCommitCalled = false;
let pubsubPublishCalls: string[] = [];

const mockBatch = {
  set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
    batchSetCalls.push({ path: ref.path ?? 'unknown', data });
  }),
  commit: vi.fn(async () => {
    batchCommitCalled = true;
  }),
};

const mockLabDoc = { exists: true };

// Mock Firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    batch: () => mockBatch,
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        path: `${colName}/${docId}`,
        get: vi.fn(async () => mockLabDoc),
        collection: (subCol: string) => ({
          doc: (subDocId: string) => ({
            path: `${colName}/${docId}/${subCol}/${subDocId}`,
          }),
        }),
      }),
    }),
  }),
  FieldValue: {
    serverTimestamp: () => ({ _serverTimestamp: true }),
  },
}));

// Mock PubSub
vi.mock('@google-cloud/pubsub', () => ({
  PubSub: vi.fn().mockImplementation(() => ({
    topic: () => ({
      publish: vi.fn(async (data: Buffer) => {
        pubsubPublishCalls.push(data.toString());
        return 'msg-id-' + pubsubPublishCalls.length;
      }),
    }),
  })),
}));

// Mock crypto.randomUUID for predictable IDs
let uuidCounter = 0;
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomUUID: vi.fn(() => `mock-uuid-${++uuidCounter}`),
  };
});

// Mock firebase-functions/v2/https
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_, handler) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

// We test the internal logic by calling the handler directly
// batchExport is exported as the onCall handler result
import { batchExport, MAX_BATCH_FORMATS } from '../../modules/export/batchExport';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockRequest {
  auth: { uid: string } | null;
  data: unknown;
}

function makeRequest(data: unknown, uid = 'test-operator-uid'): MockRequest {
  return {
    auth: { uid },
    data,
  };
}

const VALID_DATE_RANGE = {
  start: '2025-01-01T00:00:00.000Z',
  end: '2025-01-31T23:59:59.000Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('batchExport', () => {
  beforeEach(() => {
    batchSetCalls = [];
    batchCommitCalled = false;
    pubsubPublishCalls = [];
    uuidCounter = 0;
    vi.clearAllMocks();

    // Reset mocks after clear
    mockBatch.set.mockImplementation((ref: { path: string }, data: Record<string, unknown>) => {
      batchSetCalls.push({ path: ref.path ?? 'unknown', data });
    });
    mockBatch.commit.mockImplementation(async () => {
      batchCommitCalled = true;
    });
  });

  it('creates one job per format and returns correct jobIds count', async () => {
    const formats = ['xlsx-ciq', 'xlsx-nc', 'pdf-compliance'] as const;
    const request = makeRequest({ labId: 'lab-123', formats, dateRange: VALID_DATE_RANGE });

    const result = await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(
      request,
    );

    expect(result).toMatchObject({
      jobIds: expect.any(Array),
      batchId: expect.any(String),
    });

    const response = result as { jobIds: string[]; batchId: string };
    expect(response.jobIds).toHaveLength(3);
  });

  it('calls writeBatch.commit() exactly once for atomic creation', async () => {
    const formats = ['xlsx-ciq', 'xlsx-nc', 'csv-audit'] as const;
    const request = makeRequest({ labId: 'lab-123', formats, dateRange: VALID_DATE_RANGE });

    await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request);

    expect(batchCommitCalled).toBe(true);
    expect(mockBatch.commit).toHaveBeenCalledOnce();
  });

  it('creates exactly N job documents in the batch (one per format)', async () => {
    const formats = ['xlsx-ciq', 'xlsx-nc', 'pdf-compliance'] as const;
    const request = makeRequest({ labId: 'lab-123', formats, dateRange: VALID_DATE_RANGE });

    await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request);

    // batch.set should be called once per format
    expect(mockBatch.set).toHaveBeenCalledTimes(3);
  });

  it('each job has correct format and labId in payload', async () => {
    const formats = ['xlsx-ciq', 'xlsx-nc'] as const;
    const request = makeRequest({ labId: 'lab-abc', formats, dateRange: VALID_DATE_RANGE });

    await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request);

    // Verify each batch.set call has the expected format
    const setCalls = mockBatch.set.mock.calls;
    const callData = setCalls.map((c: unknown[]) => c[1] as Record<string, unknown>);

    expect(callData[0]).toMatchObject({ format: 'xlsx-ciq', labId: 'lab-abc', status: 'queued' });
    expect(callData[1]).toMatchObject({ format: 'xlsx-nc', labId: 'lab-abc', status: 'queued' });
  });

  it('enqueues to Pub/Sub once per format', async () => {
    const formats = ['xlsx-ciq', 'xlsx-nc', 'csv-audit'] as const;
    const request = makeRequest({ labId: 'lab-123', formats, dateRange: VALID_DATE_RANGE });

    await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request);

    expect(pubsubPublishCalls).toHaveLength(3);
  });

  it('rejects with invalid-argument when formats.length > MAX_BATCH_FORMATS', async () => {
    const tooManyFormats = [
      'xlsx-ciq',
      'xlsx-nc',
      'pdf-compliance',
      'csv-audit',
      'xlsx-ciq',
      'xlsx-nc',
    ];
    const request = makeRequest({
      labId: 'lab-123',
      formats: tooManyFormats,
      dateRange: VALID_DATE_RANGE,
    });

    await expect(
      (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it(`rejects when formats array has exactly ${MAX_BATCH_FORMATS + 1} items`, async () => {
    // 6 formats (one over the limit)
    const tooMany = Array(MAX_BATCH_FORMATS + 1).fill('xlsx-ciq');
    const request = makeRequest({
      labId: 'lab-123',
      formats: tooMany,
      dateRange: VALID_DATE_RANGE,
    });

    await expect(
      (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects with unauthenticated when auth is null', async () => {
    const request = {
      auth: null,
      data: { labId: 'lab-123', formats: ['xlsx-ciq'], dateRange: VALID_DATE_RANGE },
    };

    await expect(
      (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request),
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('includes emailRecipient in job documents when provided', async () => {
    const formats = ['xlsx-ciq'] as const;
    const request = makeRequest({
      labId: 'lab-123',
      formats,
      dateRange: VALID_DATE_RANGE,
      emailRecipient: 'analyst@lab.example.com',
    });

    await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request);

    const setCalls = mockBatch.set.mock.calls;
    const jobData = setCalls[0][1] as Record<string, unknown>;
    expect(jobData['emailRecipient']).toBe('analyst@lab.example.com');
  });

  it('does NOT include emailRecipient when not provided', async () => {
    const formats = ['xlsx-ciq'] as const;
    const request = makeRequest({
      labId: 'lab-123',
      formats,
      dateRange: VALID_DATE_RANGE,
    });

    await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request);

    const setCalls = mockBatch.set.mock.calls;
    const jobData = setCalls[0][1] as Record<string, unknown>;
    expect(jobData['emailRecipient']).toBeUndefined();
  });

  it('all jobs in batch share the same batchId', async () => {
    const formats = ['xlsx-ciq', 'xlsx-nc', 'csv-audit'] as const;
    const request = makeRequest({ labId: 'lab-123', formats, dateRange: VALID_DATE_RANGE });

    const result = await (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(
      request,
    );
    const response = result as { jobIds: string[]; batchId: string };

    const setCalls = mockBatch.set.mock.calls;
    const batchIds = setCalls.map((c: unknown[]) => (c[1] as Record<string, unknown>)['batchId']);

    expect(batchIds.every((id: unknown) => id === response.batchId)).toBe(true);
  });

  it('accepts exactly MAX_BATCH_FORMATS formats', async () => {
    const formats = Array(MAX_BATCH_FORMATS).fill('xlsx-ciq') as 'xlsx-ciq'[];
    const request = makeRequest({ labId: 'lab-123', formats, dateRange: VALID_DATE_RANGE });

    // Should not throw
    await expect(
      (batchExport as unknown as (req: MockRequest) => Promise<unknown>)(request),
    ).resolves.toMatchObject({
      jobIds: expect.any(Array),
    });
  });
});
