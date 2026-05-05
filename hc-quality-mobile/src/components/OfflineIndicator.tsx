/**
 * OfflineIndicator — DEPRECATED
 *
 * This component has been superseded by SyncStatusBanner, which adds:
 * - 3-state machine (hidden / syncing / offline)
 * - Animated slide-in/slide-out via Animated.Value
 * - ActivityIndicator when syncing
 * - Auto-dismiss after queue clears (1.5s grace delay)
 *
 * This file re-exports SyncStatusBanner as OfflineIndicator so all existing
 * screen imports continue to work without a bulk refactor.
 *
 * Migration: replace `import { OfflineIndicator }` with `import { SyncStatusBanner }`
 * when updating each screen. Remove this file after all imports are migrated.
 *
 * @deprecated Use SyncStatusBanner directly.
 */
export { SyncStatusBanner as OfflineIndicator } from './SyncStatusBanner';
