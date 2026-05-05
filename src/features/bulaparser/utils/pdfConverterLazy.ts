/**
 * pdfConverterLazy.ts
 *
 * Lazy wrapper around pdfConverter to prevent pdf.js worker from being
 * bundled in the main app shell. The 2.1 MB pdf.worker asset is loaded
 * only when the bulaparser module calls convertPdfToImage.
 *
 * Pattern: Dynamic import of pdfConverter is deferred until first use.
 * Cached Promise reuses module on subsequent calls.
 */

import type { ConversionProgress } from './pdfConverter';

type ConvertFn = typeof import('./pdfConverter').convertPdfToImage;

let pdfConverterPromise: Promise<{ convertPdfToImage: ConvertFn }> | null = null;

/**
 * Lazy-load the pdfConverter module. First call pays network cost;
 * subsequent calls are cached.
 */
function loadPdfConverter() {
  if (!pdfConverterPromise) {
    pdfConverterPromise = import('./pdfConverter');
  }
  return pdfConverterPromise;
}

/**
 * Lazy wrapper around convertPdfToImage. Calling this function triggers
 * the dynamic import of pdfConverter (and its pdf.js dependency), which
 * is NOT included in the main bundle.
 *
 * Usage: Replace direct imports of convertPdfToImage with this function.
 *
 * Example:
 *   // Before (eager):
 *   import { convertPdfToImage } from './pdfConverter';
 *   const result = await convertPdfToImage(file);
 *
 *   // After (lazy):
 *   import { convertPdfToImage } from './pdfConverterLazy';
 *   const result = await convertPdfToImage(file);
 */
export async function convertPdfToImage(
  file: File,
  maxPages?: number,
  onProgress?: (p: ConversionProgress) => void,
): Promise<{ base64: string; mimeType: string }> {
  const mod = await loadPdfConverter();
  return mod.convertPdfToImage(file, maxPages, onProgress);
}

// Re-export type for consumers
export type { ConversionProgress } from './pdfConverter';
