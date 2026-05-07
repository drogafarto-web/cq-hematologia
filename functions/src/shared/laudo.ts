/**
 * Laudo Draft State Machine
 * Manages pessimistic concurrency control and draft lifecycle
 * States: EMPTY → EDITING → LOCKED → PUBLISHED → ARCHIVED
 */

import { Firestore, getDoc, setDoc, updateDoc, doc, getFirestore } from 'firebase/firestore';

export type DraftStatus = 'EMPTY' | 'EDITING' | 'LOCKED' | 'PUBLISHED' | 'ARCHIVED';

export interface DraftLock {
  draftId: string;
  laudoId: string;
  lockedBy: string;
  lockedUntil: number; // timestamp in ms
  version: number;
  status: DraftStatus;
  createdAt: number;
}

export interface DraftContent {
  contentJson: Record<string, unknown>;
  editedBy: string;
  editedAt: number;
}

/**
 * Manages draft lifecycle and concurrent access control
 */
export class LaudoDraftManager {
  private db: Firestore;
  private defaultLockDuration = 3600000; // 1 hour in ms

  constructor(db: Firestore = getFirestore()) {
    this.db = db;
  }

  /**
   * Acquire lock on a draft
   * State transition: EMPTY → EDITING or EDITING → LOCKED (conflict)
   *
   * @param labId Lab identifier
   * @param laudoId Laudo identifier
   * @param rtUid Operator UID
   * @param lockDuration Lock duration in ms (default 1 hour)
   * @returns DraftLock if successful
   * @throws Error if already locked by another user
   */
  async acquireLock(
    labId: string,
    laudoId: string,
    rtUid: string,
    lockDuration: number = this.defaultLockDuration
  ): Promise<DraftLock> {
    const draftRef = doc(
      this.db,
      `labs/${labId}/laudos-draft/rascunhos`,
      laudoId
    );

    try {
      const snapshot = await getDoc(draftRef);
      const now = Date.now();
      const lockUntil = now + lockDuration;

      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<DraftLock> | undefined;
        // Check if locked by another user
        if (
          data?.lockedUntil &&
          data.lockedUntil > now &&
          data.lockedBy !== rtUid
        ) {
          throw new Error(
            `Draft locked by ${data.lockedBy} until ${new Date(data.lockedUntil).toISOString()}`
          );
        }
      }

      const lock: DraftLock = {
        draftId: laudoId,
        laudoId,
        lockedBy: rtUid,
        lockedUntil: lockUntil,
        version: (snapshot.data() as Partial<DraftLock>)?.version ?? 0 + 1,
        status: 'EDITING',
        createdAt: now
      };

      await setDoc(draftRef, lock);
      return lock;
    } catch (error) {
      throw new Error(`Failed to acquire lock: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Release lock on a draft
   *
   * @param labId Lab identifier
   * @param laudoId Laudo identifier
   * @param rtUid Operator UID
   * @throws Error if not lock owner
   */
  async releaseLock(
    labId: string,
    laudoId: string,
    rtUid: string
  ): Promise<void> {
    const draftRef = doc(
      this.db,
      `labs/${labId}/laudos-draft/rascunhos`,
      laudoId
    );

    try {
      const snapshot = await getDoc(draftRef);
      if (!snapshot.exists()) {
        throw new Error('Draft not found');
      }

      const data = snapshot.data() as Partial<DraftLock>;
      if (data.lockedBy !== rtUid) {
        throw new Error('Only lock owner can release');
      }

      await updateDoc(draftRef, {
        lockedUntil: null,
        status: 'EMPTY'
      });
    } catch (error) {
      throw new Error(`Failed to release lock: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update draft content
   *
   * @param labId Lab identifier
   * @param laudoId Laudo identifier
   * @param rtUid Operator UID
   * @param content Draft content
   */
  async updateDraftContent(
    labId: string,
    laudoId: string,
    rtUid: string,
    content: Record<string, unknown>
  ): Promise<void> {
    const draftRef = doc(
      this.db,
      `labs/${labId}/laudos-draft/rascunhos`,
      laudoId
    );

    try {
      const snapshot = await getDoc(draftRef);
      const data = snapshot.data() as Partial<DraftLock>;

      if (data?.lockedBy !== rtUid) {
        throw new Error('You do not own this draft');
      }

      await updateDoc(draftRef, {
        contentJson: content,
        editedBy: rtUid,
        editedAt: Date.now()
      });
    } catch (error) {
      throw new Error(`Failed to update draft: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Publish draft to laudo
   * State transition: EDITING | LOCKED → PUBLISHED
   *
   * @param labId Lab identifier
   * @param laudoId Laudo identifier
   * @param rtUid Operator UID
   * @returns Published laudo ID
   */
  async publishDraft(
    labId: string,
    laudoId: string,
    rtUid: string
  ): Promise<string> {
    const draftRef = doc(
      this.db,
      `labs/${labId}/laudos-draft/rascunhos`,
      laudoId
    );

    try {
      const snapshot = await getDoc(draftRef);
      if (!snapshot.exists()) {
        throw new Error('Draft not found');
      }

      const data = snapshot.data() as Partial<DraftLock> & { contentJson?: Record<string, unknown> };
      if (data.lockedBy !== rtUid) {
        throw new Error('Only lock owner can publish');
      }

      // Update draft status
      await updateDoc(draftRef, {
        status: 'PUBLISHED',
        publishedAt: Date.now(),
        publishedBy: rtUid
      });

      return laudoId;
    } catch (error) {
      throw new Error(`Failed to publish draft: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Archive a published draft
   * Cleanup operation - typically run via cron
   *
   * @param labId Lab identifier
   * @param laudoId Laudo identifier
   */
  async archiveDraft(labId: string, laudoId: string): Promise<void> {
    const draftRef = doc(
      this.db,
      `labs/${labId}/laudos-draft/rascunhos`,
      laudoId
    );

    try {
      await updateDoc(draftRef, {
        status: 'ARCHIVED',
        archivedAt: Date.now()
      });
    } catch (error) {
      throw new Error(`Failed to archive draft: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cleanup expired locks (cron operation)
   * Releases locks where lockedUntil < now
   *
   * @param labId Lab identifier
   * @returns Number of locks cleaned up
   */
  async cleanupExpiredLocks(labId: string): Promise<number> {
    // Note: This is a simplified version
    // Real implementation would use batch operations and collection queries
    return 0;
  }
}

/**
 * Create manager instance
 */
export function createLaudoDraftManager(db?: Firestore): LaudoDraftManager {
  return new LaudoDraftManager(db);
}
