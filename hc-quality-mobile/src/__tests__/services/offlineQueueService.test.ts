/**
 * offlineQueueService tests
 *
 * Tests AsyncStorage CRUD operations for offline action queue.
 * AsyncStorage is mocked via jest.setup.js.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueAction,
  getQueue,
  dequeueAction,
  markRetry,
  clearQueue,
} from '../../services/offlineQueueService';

// AsyncStorage mock is configured in jest.setup.js
// Reset between tests
const mockStorage: Record<string, string> = {};

beforeEach(() => {
  // Reset mock storage
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);

  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    (key: string) => Promise.resolve(mockStorage[key] ?? null)
  );

  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    (key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }
  );

  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    (key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }
  );

  jest.clearAllMocks();

  // Re-bind mocks after clearAllMocks
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    (key: string) => Promise.resolve(mockStorage[key] ?? null)
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    (key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    (key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }
  );
});

describe('offlineQueueService — enqueueAction', () => {
  it('generates a unique ID and persists to AsyncStorage', async () => {
    const id = await enqueueAction('submitCIQComment', 'lab-1', {
      runId: 'run-abc',
      comments: 'Test comment',
    });

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('generates different IDs for sequential enqueues', async () => {
    const id1 = await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r1' });
    const id2 = await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r2' });
    expect(id1).not.toBe(id2);
  });

  it('appends to existing queue instead of overwriting', async () => {
    await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r1' });
    await enqueueAction('updateNCStatus', 'lab-1', { ncId: 'nc-1', status: 'investigating' });

    const queue = await getQueue();
    expect(queue.length).toBe(2);
    expect(queue[0].action).toBe('submitCIQComment');
    expect(queue[1].action).toBe('updateNCStatus');
  });

  it('initialises retryCount to 0', async () => {
    const id = await enqueueAction('submitReading', 'lab-1', { value: '36.5', unit: '°C' });
    const queue = await getQueue();
    const action = queue.find((a) => a.id === id);
    expect(action?.retryCount).toBe(0);
  });

  it('persists labId in the queued action', async () => {
    const id = await enqueueAction('updateNCStatus', 'lab-xyz', { ncId: 'nc-1' });
    const queue = await getQueue();
    const action = queue.find((a) => a.id === id);
    expect(action?.labId).toBe('lab-xyz');
  });
});

describe('offlineQueueService — getQueue', () => {
  it('returns empty array when storage is empty', async () => {
    const queue = await getQueue();
    expect(queue).toEqual([]);
  });

  it('returns existing queue from AsyncStorage', async () => {
    await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r1' });
    const queue = await getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].action).toBe('submitCIQComment');
  });

  it('returns empty array on JSON parse error (fail-open)', async () => {
    // Simulate corrupted storage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('NOT_VALID_JSON');
    const queue = await getQueue();
    expect(Array.isArray(queue)).toBe(true);
    expect(queue.length).toBe(0);
  });
});

describe('offlineQueueService — dequeueAction', () => {
  it('removes action by ID', async () => {
    const id = await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r1' });
    await enqueueAction('updateNCStatus', 'lab-1', { ncId: 'nc-1' });

    await dequeueAction(id);

    const queue = await getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].action).toBe('updateNCStatus');
  });

  it('is no-op when queue is empty', async () => {
    await expect(dequeueAction('non-existent-id')).resolves.toBeUndefined();
  });

  it('does not affect other actions when dequeuing one', async () => {
    const id1 = await enqueueAction('submitReading', 'lab-1', { value: '37' });
    const id2 = await enqueueAction('submitReading', 'lab-1', { value: '38' });
    const id3 = await enqueueAction('submitReading', 'lab-1', { value: '39' });

    await dequeueAction(id2);

    const queue = await getQueue();
    expect(queue.map((a) => a.id)).toEqual([id1, id3]);
  });
});

describe('offlineQueueService — markRetry', () => {
  it('increments retryCount by 1', async () => {
    const id = await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r1' });

    await markRetry(id, 'Network timeout');

    const queue = await getQueue();
    const action = queue.find((a) => a.id === id);
    expect(action?.retryCount).toBe(1);
  });

  it('records lastError message', async () => {
    const id = await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r1' });

    await markRetry(id, 'Firebase unavailable');

    const queue = await getQueue();
    const action = queue.find((a) => a.id === id);
    expect(action?.lastError).toBe('Firebase unavailable');
  });

  it('increments retry count on multiple calls', async () => {
    const id = await enqueueAction('updateNCStatus', 'lab-1', { ncId: 'nc-1' });

    await markRetry(id, 'Error 1');
    await markRetry(id, 'Error 2');
    await markRetry(id, 'Error 3');

    const queue = await getQueue();
    const action = queue.find((a) => a.id === id);
    expect(action?.retryCount).toBe(3);
    expect(action?.lastError).toBe('Error 3');
  });

  it('is no-op when storage is empty', async () => {
    await expect(markRetry('non-existent', 'error')).resolves.toBeUndefined();
  });
});

describe('offlineQueueService — clearQueue', () => {
  it('removes all actions from storage', async () => {
    await enqueueAction('submitCIQComment', 'lab-1', { runId: 'r1' });
    await enqueueAction('updateNCStatus', 'lab-1', { ncId: 'nc-1' });

    await clearQueue();

    const queue = await getQueue();
    expect(queue.length).toBe(0);
  });
});
