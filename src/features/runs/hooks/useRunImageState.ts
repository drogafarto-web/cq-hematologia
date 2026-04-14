import type { Run, ImageState } from '../../../types';

/**
 * Derives the image display state for a Run.
 *
 * Priority order matters:
 *  1. manualOverride — checked first because it encodes *intent* at creation time.
 *     A manual run will permanently have imageUrl="" by design; checking the flag
 *     first prevents it from being misread as an in-progress upload.
 *  2. imageUrl presence — a non-empty URL means the upload completed.
 *  3. Default — OCR run whose upload has not yet resolved.
 *
 * Invariant: 'uploading' only ever appears when an async upload is genuinely
 * in flight. It must never appear as a permanent state.
 */
export function resolveImageState(run: Run): ImageState {
  if (run.manualOverride === true) return 'none';
  if (run.imageUrl)                return 'ready';
  return 'uploading';
}
