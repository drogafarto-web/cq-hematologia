/**
 * Metadata Stripper tests
 *
 * Coverage:
 * - JPEG with EXIF (APP1) → segment removed, image data preserved
 * - JPEG without metadata → no-op (segmentsRemoved: 0)
 * - PNG with tEXt chunks → chunk removed
 * - PNG without metadata → no-op
 * - WebP RIFF with EXIF chunk → removed + RIFF length recomputed
 * - Unknown format / corrupted → passthrough, formatRecognized=false
 */

import { describe, it, expect } from '@jest/globals';
import { stripImageMetadata } from '../metadataStripper';

// ─── helpers ────────────────────────────────────────────────────────────────

function jpegWithExif(): Buffer {
  // SOI
  const soi = Buffer.from([0xff, 0xd8]);
  // APP1 (EXIF) marker + length(=2+payload) + 'Exif\0\0' + 8 bytes payload
  const exifPayload = Buffer.concat([
    Buffer.from('Exif\0\0', 'ascii'),
    Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]),
  ]);
  const app1Len = 2 + exifPayload.length;
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff]),
    exifPayload,
  ]);
  // DQT (quant table) — minimal, kept
  const dqt = Buffer.from([0xff, 0xdb, 0x00, 0x04, 0x00, 0x00]);
  // SOS marker + small "scan data" + EOI
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0xaa, 0xbb]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app1, dqt, sos, eoi]);
}

function jpegBare(): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const dqt = Buffer.from([0xff, 0xdb, 0x00, 0x04, 0x00, 0x00]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0xaa, 0xbb]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, dqt, sos, eoi]);
}

function pngWithText(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR chunk (length=13)
  const ihdrLen = Buffer.from([0x00, 0x00, 0x00, 0x0d]);
  const ihdrType = Buffer.from('IHDR', 'ascii');
  const ihdrData = Buffer.alloc(13, 0);
  const ihdrCrc = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  // tEXt chunk with payload "Comment\0secret"
  const textData = Buffer.from('Comment\0secret', 'ascii');
  const textLen = Buffer.alloc(4);
  textLen.writeUInt32BE(textData.length, 0);
  const textType = Buffer.from('tEXt', 'ascii');
  const textCrc = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  // IEND
  const iendLen = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  const iendType = Buffer.from('IEND', 'ascii');
  const iendCrc = Buffer.from([0xae, 0x42, 0x60, 0x82]);
  return Buffer.concat([
    sig,
    ihdrLen,
    ihdrType,
    ihdrData,
    ihdrCrc,
    textLen,
    textType,
    textData,
    textCrc,
    iendLen,
    iendType,
    iendCrc,
  ]);
}

function pngBare(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrLen = Buffer.from([0x00, 0x00, 0x00, 0x0d]);
  const ihdrType = Buffer.from('IHDR', 'ascii');
  const ihdrData = Buffer.alloc(13, 0);
  const ihdrCrc = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  const iendLen = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  const iendType = Buffer.from('IEND', 'ascii');
  const iendCrc = Buffer.from([0xae, 0x42, 0x60, 0x82]);
  return Buffer.concat([sig, ihdrLen, ihdrType, ihdrData, ihdrCrc, iendLen, iendType, iendCrc]);
}

function webpWithExif(): Buffer {
  const vp8Data = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);
  const vp8Len = Buffer.alloc(4);
  vp8Len.writeUInt32LE(vp8Data.length, 0);
  const vp8 = Buffer.concat([Buffer.from('VP8 ', 'ascii'), vp8Len, vp8Data]);

  const exifData = Buffer.from('GPS:secret', 'ascii');
  const exifLen = Buffer.alloc(4);
  exifLen.writeUInt32LE(exifData.length, 0);
  const exif = Buffer.concat([Buffer.from('EXIF', 'ascii'), exifLen, exifData]);
  // pad to even length
  const exifPadded = exifData.length % 2 === 1 ? Buffer.concat([exif, Buffer.from([0])]) : exif;

  const body = Buffer.concat([vp8, exifPadded]);
  const totalSize = 4 + body.length;
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(totalSize, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

function b64(buf: Buffer): string {
  return buf.toString('base64');
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('stripImageMetadata — JPEG', () => {
  it('removes APP1/EXIF segment and reduces size', () => {
    const original = jpegWithExif();
    const result = stripImageMetadata({ base64: b64(original), mimeType: 'image/jpeg' });

    expect(result.formatRecognized).toBe(true);
    expect(result.hadMetadata).toBe(true);
    expect(result.segmentsRemoved).toBe(1);
    expect(result.size).toBeLessThan(result.originalSize);

    // SOI still present
    const stripped = Buffer.from(result.base64, 'base64');
    expect(stripped.readUInt16BE(0)).toBe(0xffd8);
    // APP1 marker (0xFFE1) must NOT be present after SOI
    const restAfterSoi = stripped.subarray(2);
    expect(restAfterSoi.includes(Buffer.from([0xff, 0xe1]))).toBe(false);
    // DQT (0xFFDB) preserved
    expect(restAfterSoi.includes(Buffer.from([0xff, 0xdb]))).toBe(true);
    // SOS preserved
    expect(restAfterSoi.includes(Buffer.from([0xff, 0xda]))).toBe(true);
  });

  it('is a no-op when JPEG has no metadata segments', () => {
    const original = jpegBare();
    const result = stripImageMetadata({ base64: b64(original), mimeType: 'image/jpeg' });

    expect(result.formatRecognized).toBe(true);
    expect(result.hadMetadata).toBe(false);
    expect(result.segmentsRemoved).toBe(0);
    expect(result.size).toBe(result.originalSize);
  });
});

describe('stripImageMetadata — PNG', () => {
  it('removes tEXt chunk', () => {
    const original = pngWithText();
    const result = stripImageMetadata({ base64: b64(original), mimeType: 'image/png' });

    expect(result.formatRecognized).toBe(true);
    expect(result.segmentsRemoved).toBe(1);
    expect(result.size).toBeLessThan(result.originalSize);

    const stripped = Buffer.from(result.base64, 'base64');
    expect(stripped.includes(Buffer.from('tEXt', 'ascii'))).toBe(false);
    expect(stripped.includes(Buffer.from('secret', 'ascii'))).toBe(false);
    expect(stripped.includes(Buffer.from('IHDR', 'ascii'))).toBe(true);
    expect(stripped.includes(Buffer.from('IEND', 'ascii'))).toBe(true);
  });

  it('is a no-op when PNG has no text chunks', () => {
    const original = pngBare();
    const result = stripImageMetadata({ base64: b64(original), mimeType: 'image/png' });

    expect(result.segmentsRemoved).toBe(0);
    expect(result.size).toBe(result.originalSize);
  });
});

describe('stripImageMetadata — WebP', () => {
  it('removes EXIF chunk and rebuilds RIFF header', () => {
    const original = webpWithExif();
    const result = stripImageMetadata({ base64: b64(original), mimeType: 'image/webp' });

    expect(result.formatRecognized).toBe(true);
    expect(result.segmentsRemoved).toBe(1);
    expect(result.size).toBeLessThan(result.originalSize);

    const stripped = Buffer.from(result.base64, 'base64');
    expect(stripped.toString('ascii', 0, 4)).toBe('RIFF');
    expect(stripped.toString('ascii', 8, 12)).toBe('WEBP');
    // EXIF fourcc must be gone
    expect(stripped.toString('utf8').includes('EXIF')).toBe(false);
    // VP8 chunk preserved
    expect(stripped.toString('utf8').includes('VP8')).toBe(true);
    // RIFF size header matches body
    const declaredSize = stripped.readUInt32LE(4);
    expect(declaredSize).toBe(stripped.length - 8);
  });
});

describe('stripImageMetadata — defensive', () => {
  it('passes through unknown mime as-is', () => {
    const garbage = Buffer.from([0x00, 0x01, 0x02]);
    const result = stripImageMetadata({
      base64: b64(garbage),
      mimeType: 'image/svg+xml' as any,
    });
    expect(result.formatRecognized).toBe(false);
    expect(result.segmentsRemoved).toBe(0);
    expect(result.size).toBe(result.originalSize);
  });

  it('does not throw on a corrupted JPEG header', () => {
    const garbage = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(() =>
      stripImageMetadata({ base64: b64(garbage), mimeType: 'image/jpeg' })
    ).not.toThrow();
  });
});
