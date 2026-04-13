/**
 * databaseService.ts
 *
 * Central factory for the DatabaseService abstraction.
 * Features import ONLY from this file — never from firebaseService or
 * localStorageService directly. This keeps the provider switch transparent.
 *
 * Usage:
 *   const db = getDatabaseService(labId);
 *   await db.saveState(state);
 */

export type { DatabaseService } from '../../types';

import type { DatabaseService } from '../../types';
import { isFirebase } from '../../config/database.config';
import { FirebaseService } from './firebaseService';
import { LocalStorageService } from './localStorageService';

// ─── Per-lab singleton cache ──────────────────────────────────────────────────
// Same labId → same instance. Important for FirebaseService, which carries
// in-memory tracking state used to diff saves efficiently.

const cache = new Map<string, DatabaseService>();

export function getDatabaseService(labId: string): DatabaseService {
  if (!cache.has(labId)) {
    const service: DatabaseService = isFirebase
      ? new FirebaseService(labId)
      : new LocalStorageService(labId);
    cache.set(labId, service);
  }
  return cache.get(labId)!;
}

/**
 * Removes one or all cached service instances.
 * Call when the user signs out or switches labs, so the next call to
 * getDatabaseService creates a fresh instance (with clean tracking state).
 */
export function invalidateServiceCache(labId?: string): void {
  if (labId !== undefined) {
    cache.delete(labId);
  } else {
    cache.clear();
  }
}
