/**
 * PDF Compression Module
 *
 * Re-serializes PDF documents using pdf-lib with object streams compression.
 * This reduces redundant cross-reference tables and compresses PDF streams.
 *
 * Target: <10MB for 12-month lab history compliance reports.
 *
 * Implementation choice: pdf-lib (pure JavaScript, no system dependencies).
 * This runs inside a Cloud Function Gen 2 container without requiring
 * Ghostscript, system packages, or custom Docker images.
 *
 * Limitation: pdf-lib re-serialization achieves 10-40% compression on typical
 * PDFs. For text-heavy PDFs this is effective. Image-heavy PDFs (e.g. scanned
 * documents) may still exceed 10MB — in that case a Ghostscript-based approach
 * with a custom runtime image would be needed (documented as deferred item).
 */

import { PDFDocument } from 'pdf-lib';

export interface CompressionResult {
  buffer: Buffer;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  /** Ratio of original to compressed size (>1 means compressed is smaller) */
  compressionRatio: number;
}

/**
 * Compresses a PDF buffer by re-serializing with object stream compression.
 *
 * Uses `pdf-lib` to load and re-save the document with:
 * - `useObjectStreams: true` — compresses the cross-reference table (major saving)
 * - `addDefaultPage: false` — does not add pages, preserves existing content
 *
 * Logs a warning if the compressed result still exceeds 10MB.
 *
 * @param inputBuffer - Raw PDF bytes
 * @returns CompressionResult with compressed buffer and size metrics
 */
export async function compressPDF(inputBuffer: Buffer): Promise<CompressionResult> {
  const originalSizeBytes = inputBuffer.byteLength;

  // Load the PDF document; ignoreEncryption allows processing password-protected
  // compliance reports where the password protection is informational only.
  const pdfDoc = await PDFDocument.load(inputBuffer, {
    ignoreEncryption: true,
  });

  // Re-serialize with object streams — compresses the cross-reference table
  // which is the primary source of size in programmatically generated PDFs.
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  const compressedBuffer = Buffer.from(compressedBytes);
  const compressedSizeBytes = compressedBuffer.byteLength;
  const compressionRatio = originalSizeBytes > 0 ? originalSizeBytes / compressedSizeBytes : 1;

  if (compressedSizeBytes > 10 * 1024 * 1024) {
    const origMB = (originalSizeBytes / 1024 / 1024).toFixed(1);
    const compMB = (compressedSizeBytes / 1024 / 1024).toFixed(1);
    console.warn(
      `[PDFCompressor] File still ${compMB}MB after compression ` +
      `(original: ${origMB}MB, ratio: ${compressionRatio.toFixed(2)}x). ` +
      'Consider reducing the date range or using Ghostscript-based compression ' +
      '(requires custom Docker runtime image for Cloud Functions).'
    );
  } else {
    const origMB = (originalSizeBytes / 1024 / 1024).toFixed(2);
    const compMB = (compressedSizeBytes / 1024 / 1024).toFixed(2);
    console.log(
      `[PDFCompressor] Compressed ${origMB}MB → ${compMB}MB ` +
      `(ratio: ${compressionRatio.toFixed(2)}x)`
    );
  }

  return {
    buffer: compressedBuffer,
    originalSizeBytes,
    compressedSizeBytes,
    compressionRatio,
  };
}
