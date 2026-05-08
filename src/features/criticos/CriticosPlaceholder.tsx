/**
 * CriticosPlaceholder — re-exports the production shell.
 *
 * Kept as a stable name to avoid touching the AppRouter / hub registry while
 * Phase 10-03 ships. New work imports `CriticosShell` directly.
 */

export { default } from './CriticosShell';
