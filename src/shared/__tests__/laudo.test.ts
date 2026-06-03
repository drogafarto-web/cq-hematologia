import { describe, it, expect, beforeEach } from 'vitest';
import { LaudoDraftManager, type DraftLock, type Draft } from '../laudo';
import { Timestamp } from 'firebase/firestore';

describe('laudo.ts', () => {
  let manager: LaudoDraftManager;

  beforeEach(() => {
    manager = new LaudoDraftManager();
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully', async () => {
      const lock = await manager.acquireLock('laudo-123', 'rt-user-1');

      expect(lock).toBeDefined();
      expect(lock.laudoId).toBe('laudo-123');
      expect(lock.lockedBy).toBe('rt-user-1');
      expect(lock.draftId).toBe('draft_laudo-123');
      expect(lock.version).toBe(1);
      expect(lock.lockedUntil).toBeDefined();
    });

    it('should set lock duration correctly', async () => {
      const customDuration = 1800000; // 30 minutes
      const beforeTime = Date.now();
      const lock = await manager.acquireLock('laudo-123', 'rt-user-1', customDuration);
      const afterTime = Date.now();

      const lockedUntilMs =
        lock.lockedUntil instanceof Timestamp ? lock.lockedUntil.toMillis() : lock.lockedUntil;

      expect(lockedUntilMs).toBeGreaterThanOrEqual(beforeTime + customDuration);
      expect(lockedUntilMs).toBeLessThanOrEqual(afterTime + customDuration);
    });

    it('should throw ValidationError when laudoId is missing', async () => {
      await expect(async () => {
        await manager.acquireLock('', 'rt-user-1');
      }).rejects.toThrow('laudoId and rtUid are required');
    });

    it('should throw ValidationError when rtUid is missing', async () => {
      await expect(async () => {
        await manager.acquireLock('laudo-123', '');
      }).rejects.toThrow('laudoId and rtUid are required');
    });
  });

  describe('releaseLock', () => {
    it('should release lock', async () => {
      // No error thrown
      await expect(manager.releaseLock('draft-123', 'rt-user-1')).resolves.toBeUndefined();
    });

    it('should throw ValidationError when draftId is missing', async () => {
      await expect(async () => {
        await manager.releaseLock('', 'rt-user-1');
      }).rejects.toThrow('draftId and rtUid are required');
    });

    it('should throw ValidationError when rtUid is missing', async () => {
      await expect(async () => {
        await manager.releaseLock('draft-123', '');
      }).rejects.toThrow('draftId and rtUid are required');
    });
  });

  describe('publish', () => {
    it('should publish draft to laudo', async () => {
      const result = await manager.publish('draft-123', 'laudo-123', 'rt-user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('laudo-123');
      expect(result.publicado).toBe(true);
    });

    it('should throw ValidationError when draftId is missing', async () => {
      await expect(async () => {
        await manager.publish('', 'laudo-123', 'rt-user-1');
      }).rejects.toThrow('draftId, laudoId, and rtUid are required');
    });

    it('should throw ValidationError when laudoId is missing', async () => {
      await expect(async () => {
        await manager.publish('draft-123', '', 'rt-user-1');
      }).rejects.toThrow('draftId, laudoId, and rtUid are required');
    });

    it('should throw ValidationError when rtUid is missing', async () => {
      await expect(async () => {
        await manager.publish('draft-123', 'laudo-123', '');
      }).rejects.toThrow('draftId, laudoId, and rtUid are required');
    });
  });

  describe('isLockActive', () => {
    it('should return true for active lock', () => {
      const futureTime = Date.now() + 3600000; // 1 hour in future
      const draft: Draft = {
        id: 'draft-123',
        laudoId: 'laudo-123',
        status: 'EDITING',
        lockedBy: 'rt-user-1',
        lockedUntil: Timestamp.fromMillis(futureTime),
        version: 1,
        criadoEm: Timestamp.now(),
      };

      expect(manager.isLockActive(draft)).toBe(true);
    });

    it('should return false for expired lock', () => {
      const pastTime = Date.now() - 3600000; // 1 hour in past
      const draft: Draft = {
        id: 'draft-123',
        laudoId: 'laudo-123',
        status: 'EDITING',
        lockedBy: 'rt-user-1',
        lockedUntil: Timestamp.fromMillis(pastTime),
        version: 1,
        criadoEm: Timestamp.now(),
      };

      expect(manager.isLockActive(draft)).toBe(false);
    });

    it('should return false when no lock exists', () => {
      const draft: Draft = {
        id: 'draft-123',
        laudoId: 'laudo-123',
        status: 'EMPTY',
        version: 1,
        criadoEm: Timestamp.now(),
      };

      expect(manager.isLockActive(draft)).toBe(false);
    });
  });

  describe('isLockedByOther', () => {
    it('should return true when locked by different RT', () => {
      const futureTime = Date.now() + 3600000;
      const draft: Draft = {
        id: 'draft-123',
        laudoId: 'laudo-123',
        status: 'LOCKED',
        lockedBy: 'rt-user-1',
        lockedUntil: Timestamp.fromMillis(futureTime),
        version: 1,
        criadoEm: Timestamp.now(),
      };

      expect(manager.isLockedByOther(draft, 'rt-user-2')).toBe(true);
    });

    it('should return false when locked by same RT', () => {
      const futureTime = Date.now() + 3600000;
      const draft: Draft = {
        id: 'draft-123',
        laudoId: 'laudo-123',
        status: 'EDITING',
        lockedBy: 'rt-user-1',
        lockedUntil: Timestamp.fromMillis(futureTime),
        version: 1,
        criadoEm: Timestamp.now(),
      };

      expect(manager.isLockedByOther(draft, 'rt-user-1')).toBe(false);
    });

    it('should return false when lock is expired', () => {
      const pastTime = Date.now() - 3600000;
      const draft: Draft = {
        id: 'draft-123',
        laudoId: 'laudo-123',
        status: 'LOCKED',
        lockedBy: 'rt-user-1',
        lockedUntil: Timestamp.fromMillis(pastTime),
        version: 1,
        criadoEm: Timestamp.now(),
      };

      expect(manager.isLockedByOther(draft, 'rt-user-2')).toBe(false);
    });
  });

  describe('findExpiredLocks', () => {
    it('should identify drafts with expired locks', () => {
      const pastTime = Date.now() - 3600000;
      const futureTime = Date.now() + 3600000;

      const drafts: Draft[] = [
        {
          id: 'draft-1',
          laudoId: 'laudo-1',
          status: 'EDITING',
          lockedUntil: Timestamp.fromMillis(pastTime),
          version: 1,
          criadoEm: Timestamp.now(),
        },
        {
          id: 'draft-2',
          laudoId: 'laudo-2',
          status: 'EDITING',
          lockedUntil: Timestamp.fromMillis(futureTime),
          version: 1,
          criadoEm: Timestamp.now(),
        },
        {
          id: 'draft-3',
          laudoId: 'laudo-3',
          status: 'EMPTY',
          version: 1,
          criadoEm: Timestamp.now(),
        },
      ];

      const expiredIds = manager.findExpiredLocks(drafts);

      expect(expiredIds).toHaveLength(1);
      expect(expiredIds[0]).toBe('draft-1');
    });

    it('should return empty array when no locks are expired', () => {
      const futureTime = Date.now() + 3600000;

      const drafts: Draft[] = [
        {
          id: 'draft-1',
          laudoId: 'laudo-1',
          status: 'EDITING',
          lockedUntil: Timestamp.fromMillis(futureTime),
          version: 1,
          criadoEm: Timestamp.now(),
        },
      ];

      const expiredIds = manager.findExpiredLocks(drafts);

      expect(expiredIds).toHaveLength(0);
    });
  });
});
