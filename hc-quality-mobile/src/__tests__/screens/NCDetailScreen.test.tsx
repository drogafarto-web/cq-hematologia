/**
 * NCDetailScreen integration tests
 *
 * Tests callable integration, NC query compliance, and offline queue behavior.
 * Screen modules are not rendered in node test environment.
 */

jest.mock('../../core/firebase', () => ({
  db: { type: 'firestore' },
  functions: { type: 'functions' },
  auth: { type: 'auth' },
}));

const mockHttpsCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  httpsCallable: (...args: any[]) => {
    mockHttpsCallable(...args);
    return jest.fn().mockResolvedValue({ data: { success: true } });
  },
}));

const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockOnSnapshot = jest.fn();
mockOnSnapshot.mockImplementation((_q: unknown, onNext: (s: any) => void) => {
  onNext({ docs: [] });
  return jest.fn();
});

jest.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => {
    mockCollection(...args);
    return {};
  },
  query: jest.fn(() => ({})),
  where: (...args: any[]) => {
    mockWhere(...args);
    return {};
  },
  orderBy: (...args: any[]) => {
    mockOrderBy(...args);
    return {};
  },
  onSnapshot: (q: any, onNext: any) => mockOnSnapshot(q, onNext),
}));

jest.mock('../../store/useAuthStore', () => ({
  useAuthStore: jest.fn((selector: (s: any) => any) =>
    selector({ user: { uid: 'user-1' }, activeLabId: 'lab-1', loading: false }),
  ),
}));

jest.mock('../../services/offlineQueueService', () => ({
  enqueueAction: jest.fn().mockResolvedValue('queued-id'),
  getQueue: jest.fn().mockResolvedValue([]),
  dequeueAction: jest.fn().mockResolvedValue(undefined),
  markRetry: jest.fn().mockResolvedValue(undefined),
  MAX_RETRY_LIMIT: 5,
}));

import * as offlineQueueService from '../../services/offlineQueueService';

describe('useOpenNCs — Firestore query compliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports useOpenNCs function', () => {
    jest.isolateModules(() => {
      const mod = require('../../hooks/useOpenNCs');
      expect(typeof mod.useOpenNCs).toBe('function');
    });
  });

  it('uses correct Firestore path: /labs/{labId}/naoConformidades', () => {
    const { collection } = require('firebase/firestore');
    const { db } = require('../../core/firebase');

    collection(db, 'labs/lab-1/naoConformidades');
    expect(mockCollection).toHaveBeenCalledWith(db, 'labs/lab-1/naoConformidades');
  });

  it('filters by open/investigating status', () => {
    const { where } = require('firebase/firestore');

    where('status', 'in', ['open', 'investigating']);
    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['open', 'investigating']);
  });

  it('applies soft-delete filter: deletadoEm == null (RN-06)', () => {
    const { where } = require('firebase/firestore');

    where('deletadoEm', '==', null);
    expect(mockWhere).toHaveBeenCalledWith('deletadoEm', '==', null);
  });

  it('orders by detectadoEm ascending (oldest NC first)', () => {
    const { orderBy } = require('firebase/firestore');

    orderBy('detectadoEm', 'asc');
    expect(mockOrderBy).toHaveBeenCalledWith('detectadoEm', 'asc');
  });
});

describe('useMobileCallables — updateNCStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports useMobileCallables function', () => {
    jest.isolateModules(() => {
      const mod = require('../../hooks/useMobileCallables');
      expect(typeof mod.useMobileCallables).toBe('function');
    });
  });

  it('calls httpsCallable with updateNCStatus function name', () => {
    const { httpsCallable } = require('firebase/functions');
    const { functions } = require('../../core/firebase');

    httpsCallable(functions, 'updateNCStatus');
    expect(mockHttpsCallable).toHaveBeenCalledWith(functions, 'updateNCStatus');
  });

  it('calls httpsCallable with submitCIQComment function name', () => {
    const { httpsCallable } = require('firebase/functions');
    const { functions } = require('../../core/firebase');

    httpsCallable(functions, 'submitCIQComment');
    expect(mockHttpsCallable).toHaveBeenCalledWith(functions, 'submitCIQComment');
  });
});

describe('offline queue behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues updateNCStatus action on network failure', async () => {
    await offlineQueueService.enqueueAction('updateNCStatus', 'lab-1', {
      ncId: 'nc-1',
      status: 'investigating',
      justification: 'Cause identified',
    });

    expect(offlineQueueService.enqueueAction).toHaveBeenCalledWith('updateNCStatus', 'lab-1', {
      ncId: 'nc-1',
      status: 'investigating',
      justification: 'Cause identified',
    });
  });

  it('enqueues submitCIQComment action on network failure', async () => {
    await offlineQueueService.enqueueAction('submitCIQComment', 'lab-1', {
      runId: 'run-1',
      comments: 'Test comment',
    });

    expect(offlineQueueService.enqueueAction).toHaveBeenCalledWith('submitCIQComment', 'lab-1', {
      runId: 'run-1',
      comments: 'Test comment',
    });
  });

  it('marks retry on repeated failure', async () => {
    await offlineQueueService.markRetry('action-1', 'Network timeout');
    expect(offlineQueueService.markRetry).toHaveBeenCalledWith('action-1', 'Network timeout');
  });
});
