import type { Analyte } from './types';

// ─── Yumizen H550 — 17 Analytes ───────────────────────────────────────────────
// Differential leucocytes: absolute counts only (×10³/µL).
// Percentages are not tracked — they add no independent QC value when
// the absolute series already covers Westgard rule evaluation.
// Order matches the equipment's printout layout for OCR alignment.

export const ANALYTES: Analyte[] = [
  { id: 'WBC',  name: 'WBC',  unit: '×10³/µL', decimals: 2 },
  { id: 'RBC',  name: 'RBC',  unit: '×10⁶/µL', decimals: 2 },
  { id: 'HGB',  name: 'HGB',  unit: 'g/dL',    decimals: 1 },
  { id: 'HCT',  name: 'HCT',  unit: '%',        decimals: 1 },
  { id: 'MCV',  name: 'MCV',  unit: 'fL',       decimals: 1 },
  { id: 'MCH',  name: 'MCH',  unit: 'pg',       decimals: 1 },
  { id: 'MCHC', name: 'MCHC', unit: 'g/dL',    decimals: 1 },
  { id: 'PLT',  name: 'PLT',  unit: '×10³/µL', decimals: 0 },
  { id: 'RDW',  name: 'RDW',  unit: '%',        decimals: 1 },
  { id: 'MPV',  name: 'MPV',  unit: 'fL',       decimals: 1 },
  { id: 'PCT',  name: 'PCT',  unit: '%',        decimals: 3 },
  { id: 'PDW',  name: 'PDW',  unit: 'fL',       decimals: 1 },
  { id: 'NEU#', name: 'NEU#', unit: '×10³/µL', decimals: 2 },
  { id: 'LYM#', name: 'LYM#', unit: '×10³/µL', decimals: 2 },
  { id: 'MON#', name: 'MON#', unit: '×10³/µL', decimals: 2 },
  { id: 'EOS#', name: 'EOS#', unit: '×10³/µL', decimals: 2 },
  { id: 'BAS#', name: 'BAS#', unit: '×10³/µL', decimals: 2 },
];

export const ANALYTE_MAP: Record<string, Analyte> = Object.fromEntries(
  ANALYTES.map((a) => [a.id, a])
);

// ─── Westgard — minimum runs required per rule ────────────────────────────────

export const WESTGARD_MIN_RUNS = {
  '1-2s': 1,
  '1-3s': 1,
  '2-2s': 2,
  'R-4s': 2,
  '4-1s': 4,
  '10x':  10,
} as const;

/** Minimum confirmed runs before internal statistics are computed */
export const MIN_RUNS_FOR_INTERNAL_STATS = 20;

// ─── Firestore Collection Paths ───────────────────────────────────────────────

export const COLLECTIONS = {
  USERS: 'users',
  LABS: 'labs',
  ACCESS_REQUESTS: 'accessRequests',
  STATUS: 'status',
  AUDIT_LOGS: 'auditLogs',
} as const;

export const SUBCOLLECTIONS = {
  MEMBERS: 'members',
  DATA: 'data',
  LOTS: 'lots',
  RUNS: 'runs',
} as const;

export const STATIC_DOC_IDS = {
  APP_STATE: 'appState',
  INIT: 'init',
} as const;

// ─── Storage Paths ────────────────────────────────────────────────────────────

export const storagePath = {
  runImage: (labId: string, lotId: string, runId: string) =>
    `labs/${labId}/lots/${lotId}/runs/${runId}.jpg`,
  labLogo: (labId: string) =>
    `labs/${labId}/logo`,
} as const;

// ─── Gemini ───────────────────────────────────────────────────────────────────

export const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

// ─── UI ───────────────────────────────────────────────────────────────────────

export const TOAST_DURATION_MS = 4000;

export const SYNC_DEBOUNCE_MS = 1200;

export const IMAGE_UPLOAD_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_TYPES)[number];
