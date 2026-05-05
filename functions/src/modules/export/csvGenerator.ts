/**
 * CSV Audit Log Generator
 *
 * Generates RFC 4180-compliant CSV export of audit log entries.
 * Output: UTF-8 BOM + header row + data rows ordered by timestamp ascending.
 * Pagination: 1000 docs/page via Firestore cursor to avoid memory spikes.
 *
 * Collection path: /labs/{labId}/auditLogs (tenant-scoped — multi-tenant invariant)
 * Security note: caller must validate labAdmin/RT role before calling this.
 * (T-03.3-09: audit log read requires labAdmin or RT role)
 */

import { getFirestore } from 'firebase-admin/firestore';

/** UTF-8 BOM for Excel compatibility */
const BOM = '﻿';

const CSV_HEADERS = [
  'timestamp',
  'operatorId',
  'action',
  'resourceType',
  'resourceId',
  'previousHash',
  'newHash',
  'labId',
] as const;

export interface AuditLogCSVRow {
  timestamp: string;      // ISO 8601
  operatorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  previousHash: string;
  newHash: string;
  labId: string;
}

/** Escapes a CSV field per RFC 4180: wrap in quotes if it contains comma, quote, or newline. */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If field contains comma, double-quote, or newline → wrap in double-quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Converts a row object to RFC 4180 CSV line. */
function rowToCSV(row: AuditLogCSVRow): string {
  return CSV_HEADERS.map((h) => escapeCSVField(row[h])).join(',');
}

/** Normalizes a Firestore Timestamp, Date, or ISO string to ISO 8601 string. */
function toISO8601(ts: unknown): string {
  if (!ts) return '';
  // Duck-type check for Firestore Timestamp (has toDate method) — covers both
  // real admin SDK Timestamp and test mocks without relying on instanceof
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: unknown }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? ts : d.toISOString();
  }
  return String(ts);
}

const PAGE_SIZE = 1000;

/**
 * Generates a CSV audit log Buffer for the given lab and date range.
 * Paginates Firestore in pages of 1000 docs to avoid memory spikes.
 *
 * @param labId  - tenant scoping (multi-tenant invariant)
 * @param startDate - inclusive lower bound
 * @param endDate   - inclusive upper bound
 * @returns Buffer with UTF-8 BOM + RFC 4180 CSV content
 */
export async function generateCSVAuditLog(
  labId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const db = getFirestore();
  const col = db.collection('labs').doc(labId).collection('auditLogs');

  const lines: string[] = [];
  // Header row
  lines.push(CSV_HEADERS.join(','));

  let pageCount = 0;
  let lastDocSnapshot: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let q = col
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'asc')
      .limit(PAGE_SIZE);

    if (lastDocSnapshot) {
      q = q.startAfter(lastDocSnapshot);
    }

    const snap = await q.get();
    pageCount++;

    if (snap.empty) {
      break;
    }

    for (const doc of snap.docs) {
      const d = doc.data();
      const row: AuditLogCSVRow = {
        timestamp:    toISO8601(d['timestamp']),
        operatorId:   String(d['operatorId'] ?? ''),
        action:       String(d['action'] ?? ''),
        resourceType: String(d['resourceType'] ?? ''),
        resourceId:   String(d['resourceId'] ?? ''),
        previousHash: String(d['previousHash'] ?? ''),
        newHash:      String(d['newHash'] ?? ''),
        labId:        String(d['labId'] ?? labId),
      };
      lines.push(rowToCSV(row));
    }

    console.log(
      `[CSVGenerator] Page ${pageCount}: fetched ${snap.docs.length} audit log docs for lab ${labId}`
    );

    if (snap.docs.length < PAGE_SIZE) {
      // Last page — no more docs
      break;
    }

    lastDocSnapshot = snap.docs[snap.docs.length - 1];
  }

  const csvString = BOM + lines.join('\r\n');

  console.log(
    `[CSVGenerator] Generated CSV: ${lines.length - 1} audit log rows, ` +
    `${Buffer.byteLength(csvString, 'utf8')} bytes (${pageCount} page(s)) for lab ${labId}`
  );

  return Buffer.from(csvString, 'utf8');
}
