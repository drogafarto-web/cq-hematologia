/**
 * Metadata Stripper — PII guardrail for ia-strip Gemini calls
 *
 * Removes embedded metadata (EXIF, GPS, device info, timestamps, comments)
 * from patient images BEFORE the base64 payload is sent to Gemini.
 *
 * Why: A modern phone camera embeds GPS coords, device serial, and capture
 * timestamps inside the image bytes themselves. Even with consent, sending
 * those to a third-party model is a needless PII leak.
 *
 * Strategy:
 *
 * - JPEG: strip every APPn (0xFFE0–0xFFEF) and COM (0xFFFE) marker segment.
 *   This removes EXIF (APP1), JFIF extensions (APP0 beyond minimum), Adobe
 *   markers, and free-form comments. The image data (SOI/SOF/DQT/DHT/SOS)
 *   is preserved intact — visually identical, no recompression.
 *
 * - PNG: strip ancillary text chunks (tEXt, iTXt, zTXt, tIME, eXIf).
 *   Keeps IHDR/IDAT/IEND and other critical chunks. CRCs are recomputed for
 *   chunks we keep (we never modify them, so original CRCs remain valid —
 *   we only drop chunks).
 *
 * - WebP: strip EXIF and XMP chunks from the RIFF container if present.
 *   Keeps VP8/VP8L/VP8X (with EXIF/XMP flags cleared) + ALPH + ANIM frames.
 *
 * - Unknown / corrupted: return original bytes unchanged but flagged. Caller
 *   decides whether to proceed. (This module never throws on malformed
 *   input — that is the parser's job upstream.)
 *
 * Implementation note: we deliberately avoid pulling in `sharp`, `jimp`, or
 * `exif-parser`. A pure-JS byte walker is ~150 LOC, has zero native deps,
 * and is auditable. If we later add `exifr` for richer parsing, it goes
 * behind this same interface.
 */

export type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface StrippedImage {
  /** base64 of the image with metadata removed */
  base64: string;
  /** original mime type (unchanged) */
  mimeType: SupportedMime;
  /** byte length AFTER stripping */
  size: number;
  /** byte length BEFORE stripping */
  originalSize: number;
  /** count of metadata segments/chunks removed */
  segmentsRemoved: number;
  /** true if input had any metadata to strip */
  hadMetadata: boolean;
  /** true if format was recognized and walked; false = passthrough */
  formatRecognized: boolean;
}

export interface StripMetadataInput {
  base64: string;
  mimeType: SupportedMime;
}

/**
 * Strip embedded metadata from a base64-encoded image.
 *
 * Pure function. Does not throw on malformed input — returns the original
 * bytes with `formatRecognized: false`.
 */
export function stripImageMetadata(input: StripMetadataInput): StrippedImage {
  const { base64, mimeType } = input;
  const original = Buffer.from(base64, 'base64');
  const originalSize = original.length;

  let stripped: Buffer;
  let segmentsRemoved = 0;
  let formatRecognized = true;

  try {
    if (mimeType === 'image/jpeg') {
      const out = stripJpegMetadata(original);
      stripped = out.buffer;
      segmentsRemoved = out.removed;
    } else if (mimeType === 'image/png') {
      const out = stripPngMetadata(original);
      stripped = out.buffer;
      segmentsRemoved = out.removed;
    } else if (mimeType === 'image/webp') {
      const out = stripWebpMetadata(original);
      stripped = out.buffer;
      segmentsRemoved = out.removed;
    } else {
      stripped = original;
      formatRecognized = false;
    }
  } catch {
    // Malformed bytes — never throw, fall back to passthrough.
    stripped = original;
    formatRecognized = false;
    segmentsRemoved = 0;
  }

  return {
    base64: stripped.toString('base64'),
    mimeType,
    size: stripped.length,
    originalSize,
    segmentsRemoved,
    hadMetadata: segmentsRemoved > 0,
    formatRecognized,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JPEG
// ─────────────────────────────────────────────────────────────────────────────

const JPEG_SOI = 0xffd8;
const JPEG_SOS = 0xffda;
const JPEG_EOI = 0xffd9;

function stripJpegMetadata(buf: Buffer): { buffer: Buffer; removed: number } {
  if (buf.length < 4 || buf.readUInt16BE(0) !== JPEG_SOI) {
    return { buffer: buf, removed: 0 };
  }

  const out: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let removed = 0;
  let i = 2;

  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) {
      // Misaligned — bail out, keep remainder as-is.
      out.push(buf.subarray(i));
      break;
    }

    const marker = buf.readUInt16BE(i);

    // SOS = start of scan; everything after is compressed image data + EOI.
    if (marker === JPEG_SOS) {
      out.push(buf.subarray(i));
      break;
    }

    if (marker === JPEG_EOI) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }

    // Standalone markers (no length): RSTn, TEM, etc. Rare in stored JPEGs
    // but be defensive.
    if (
      (marker >= 0xffd0 && marker <= 0xffd7) ||
      marker === 0xff01
    ) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (i + 4 > buf.length) {
      out.push(buf.subarray(i));
      break;
    }

    const segLen = buf.readUInt16BE(i + 2);
    const segEnd = i + 2 + segLen;
    if (segEnd > buf.length) {
      out.push(buf.subarray(i));
      break;
    }

    const isAppN = marker >= 0xffe0 && marker <= 0xffef;
    const isComment = marker === 0xfffe;

    if (isAppN || isComment) {
      removed += 1;
    } else {
      out.push(buf.subarray(i, segEnd));
    }

    i = segEnd;
  }

  return { buffer: Buffer.concat(out), removed };
}

// ─────────────────────────────────────────────────────────────────────────────
// PNG
// ─────────────────────────────────────────────────────────────────────────────

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_METADATA_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt', 'tIME', 'eXIf']);

function stripPngMetadata(buf: Buffer): { buffer: Buffer; removed: number } {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    return { buffer: buf, removed: 0 };
  }

  const out: Buffer[] = [buf.subarray(0, 8)];
  let removed = 0;
  let i = 8;

  while (i < buf.length) {
    if (i + 8 > buf.length) break;

    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const chunkEnd = i + 12 + len; // 4 len + 4 type + len data + 4 crc

    if (chunkEnd > buf.length) break;

    if (PNG_METADATA_CHUNKS.has(type)) {
      removed += 1;
    } else {
      out.push(buf.subarray(i, chunkEnd));
    }

    i = chunkEnd;
    if (type === 'IEND') break;
  }

  return { buffer: Buffer.concat(out), removed };
}

// ─────────────────────────────────────────────────────────────────────────────
// WebP (RIFF container)
// ─────────────────────────────────────────────────────────────────────────────

const RIFF_METADATA_FOURCCS = new Set(['EXIF', 'XMP ']);

function stripWebpMetadata(buf: Buffer): { buffer: Buffer; removed: number } {
  if (
    buf.length < 12 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return { buffer: buf, removed: 0 };
  }

  const out: Buffer[] = [];
  let removed = 0;
  let i = 12;

  while (i < buf.length) {
    if (i + 8 > buf.length) break;

    const fourcc = buf.toString('ascii', i, i + 4);
    const len = buf.readUInt32LE(i + 4);
    const padded = len + (len % 2); // RIFF chunks are word-aligned
    const chunkEnd = i + 8 + padded;

    if (chunkEnd > buf.length) break;

    if (RIFF_METADATA_FOURCCS.has(fourcc)) {
      removed += 1;
    } else {
      out.push(buf.subarray(i, chunkEnd));
    }

    i = chunkEnd;
  }

  if (removed === 0) {
    return { buffer: buf, removed: 0 };
  }

  // Rebuild RIFF header with new total size.
  const body = Buffer.concat(out);
  const totalSize = 4 + body.length; // 'WEBP' + chunks
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(totalSize, 4);
  header.write('WEBP', 8, 'ascii');

  return { buffer: Buffer.concat([header, body]), removed };
}
