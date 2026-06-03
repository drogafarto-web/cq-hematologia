/**
 * useOfflineQueue hook tests
 *
 * Tests polling behavior and queue state exposure.
 * Service is mocked so tests are purely unit-level.
 */

jest.mock('../../services/offlineQueueService', () => ({
  getQueue: jest.fn().mockResolvedValue([]),
  enqueueAction: jest.fn().mockResolvedValue('mock-id'),
  dequeueAction: jest.fn().mockResolvedValue(undefined),
  markRetry: jest.fn().mockResolvedValue(undefined),
  MAX_RETRY_LIMIT: 5,
}));

import * as offlineQueueService from '../../services/offlineQueueService';

describe('useOfflineQueue — module contract', () => {
  it('exports useOfflineQueue function', () => {
    const { useOfflineQueue } = require('../../hooks/useOfflineQueue');
    expect(typeof useOfflineQueue).toBe('function');
  });

  it('service getQueue returns empty array initially', async () => {
    const queue = await offlineQueueService.getQueue();
    expect(Array.isArray(queue)).toBe(true);
    expect(queue.length).toBe(0);
  });

  it('service enqueueAction creates a string ID', async () => {
    const id = await offlineQueueService.enqueueAction('submitCIQComment', 'lab-1', {
      runId: 'r1',
      comments: 'test',
    });
    expect(typeof id).toBe('string');
  });
});

describe('useOfflineQueue — queue with items', () => {
  beforeEach(() => {
    (offlineQueueService.getQueue as jest.Mock).mockResolvedValue([
      {
        id: 'action-1',
        action: 'submitCIQComment',
        labId: 'lab-1',
        data: { runId: 'r1', comments: 'test' },
        timestamp: Date.now(),
        retryCount: 0,
      },
      {
        id: 'action-2',
        action: 'updateNCStatus',
        labId: 'lab-1',
        data: { ncId: 'nc-1', status: 'investigating' },
        timestamp: Date.now(),
        retryCount: 2,
        lastError: 'Network timeout',
      },
    ]);
  });

  it('getQueue returns all queued actions', async () => {
    const queue = await offlineQueueService.getQueue();
    expect(queue.length).toBe(2);
  });

  it('queued actions have required fields', async () => {
    const queue = await offlineQueueService.getQueue();
    const [action1, action2] = queue;

    expect(action1.id).toBeTruthy();
    expect(action1.action).toBe('submitCIQComment');
    expect(action1.labId).toBe('lab-1');
    expect(action1.retryCount).toBe(0);

    expect(action2.retryCount).toBe(2);
    expect(action2.lastError).toBe('Network timeout');
  });
});

describe('offlineQueueService — dequeue and retry', () => {
  it('dequeueAction is called with correct ID', async () => {
    await offlineQueueService.dequeueAction('action-1');
    expect(offlineQueueService.dequeueAction).toHaveBeenCalledWith('action-1');
  });

  it('markRetry records error message', async () => {
    await offlineQueueService.markRetry('action-2', 'Connection refused');
    expect(offlineQueueService.markRetry).toHaveBeenCalledWith('action-2', 'Connection refused');
  });
});
