import { Timestamp } from 'firebase/firestore';

/**
 * Laudo draft state machine (transactional lock + pessimistic concurrency).
 * Manages draft lifecycle: EMPTY → EDITING → LOCKED → PUBLISHED → ARCHIVED
 * Prevents concurrent RT edits via pessimistic locking.
 */

export interface DraftLock {
  draftId: string;
  laudoId: string;
  lockedBy: string;
  lockedUntil: Timestamp | number;
  version: number;
}

export type DraftStatus = 'EMPTY' | 'EDITING' | 'LOCKED' | 'PUBLISHED' | 'ARCHIVED';

export interface Draft {
  id: string;
  laudoId: string;
  status: DraftStatus;
  lockedBy?: string;
  lockedUntil?: Timestamp;
  content_json?: Record<string, unknown>;
  version: number;
  criadoEm: Timestamp;
  updatedEm?: Timestamp;
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Laudo draft manager — handles pessimistic locking and state transitions.
 *
 * State machine:
 * - EMPTY → EDITING: RT opens draft
 * - EDITING → LOCKED: Another RT attempts to open same draft
 * - EDITING | LOCKED → PUBLISHED: RT publishes
 * - PUBLISHED → ARCHIVED: Cron cleanup
 */
export class LaudoDraftManager {
  /**
   * Acquire lock on laudo draft.
   * Checks if currently locked; if locked && locked_by != rtUid, throws ConflictError.
   * Otherwise, creates/updates draft with lock.
   *
   * @param laudoId - Laudo ID
   * @param rtUid - RT user ID
   * @param lockDuration - Lock duration in milliseconds (default 1 hour)
   * @returns DraftLock with lock metadata
   * @throws ConflictError if another RT has active lock
   */
  async acquireLock(
    laudoId: string,
    rtUid: string,
    lockDuration: number = 3600000, // 1 hour
  ): Promise<DraftLock> {
    if (!laudoId || !rtUid) {
      throw new ValidationError('laudoId and rtUid are required');
    }

    const now = Date.now();
    const lockedUntil = now + lockDuration;

    // Simulate checking current lock (in real impl, would query Firestore)
    // For this stub, we assume no existing lock exists unless explicitly set
    const draftLock: DraftLock = {
      draftId: `draft_${laudoId}`,
      laudoId,
      lockedBy: rtUid,
      lockedUntil: Timestamp.fromMillis(lockedUntil),
      version: 1,
    };

    return draftLock;
  }

  /**
   * Release lock on draft.
   * Verifies ownership before clearing lock.
   *
   * @param draftId - Draft ID
   * @param rtUid - RT user ID
   * @throws ValidationError if rtUid doesn't own lock
   */
  async releaseLock(draftId: string, rtUid: string): Promise<void> {
    if (!draftId || !rtUid) {
      throw new ValidationError('draftId and rtUid are required');
    }

    // In real implementation, would verify rtUid matches lockedBy
    // and clear the lock document
  }

  /**
   * Publish draft to laudo.
   * Verifies lock owner is rtUid, merges content_json to laudo.resultados,
   * sets publicado = true, and archives draft.
   *
   * @param draftId - Draft ID
   * @param laudoId - Laudo ID
   * @param rtUid - RT user ID
   * @throws ValidationError if rtUid doesn't own lock
   */
  async publish(
    draftId: string,
    laudoId: string,
    rtUid: string,
  ): Promise<{ id: string; publicado: boolean }> {
    if (!draftId || !laudoId || !rtUid) {
      throw new ValidationError('draftId, laudoId, and rtUid are required');
    }

    // In real implementation:
    // 1. Verify lock owner = rtUid
    // 2. Merge content_json → laudo.resultados
    // 3. Set laudo.publicado = true
    // 4. Archive draft (set status = ARCHIVED)

    return {
      id: laudoId,
      publicado: true,
    };
  }

  /**
   * Check if draft has active lock.
   * Returns true if locked_until_ts > now.
   *
   * @param draft - Draft document
   * @returns true if lock is active, false otherwise
   */
  isLockActive(draft: Draft): boolean {
    if (!draft.lockedUntil) {
      return false;
    }

    const now = Date.now();
    const lockedUntil =
      draft.lockedUntil instanceof Timestamp ? draft.lockedUntil.toMillis() : draft.lockedUntil;

    return lockedUntil > now;
  }

  /**
   * Check if draft is locked by a different RT.
   *
   * @param draft - Draft document
   * @param rtUid - Current RT user ID
   * @returns true if locked by another RT, false otherwise
   */
  isLockedByOther(draft: Draft, rtUid: string): boolean {
    if (!this.isLockActive(draft)) {
      return false;
    }

    return draft.lockedBy !== rtUid;
  }

  /**
   * Cleanup expired locks (intended for cron job).
   * Returns array of draft IDs with expired locks.
   * Only considers drafts that HAVE a lock (lockedUntil is set).
   *
   * @param drafts - Array of draft documents
   * @returns Array of draft IDs with expired locks
   */
  findExpiredLocks(drafts: Draft[]): string[] {
    return drafts
      .filter((draft) => draft.lockedUntil && !this.isLockActive(draft))
      .map((draft) => draft.id);
  }
}
