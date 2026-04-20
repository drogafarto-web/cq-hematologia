import type { Analyte } from './types';

// ─── Yumizen H550 — 17 Analytes ───────────────────────────────────────────────
// Differential leucocytes: absolute counts only (×10³/µL).
// Percentages are not tracked — they add no independent QC value when
// the absolute series already covers Westgard rule evaluation.
// Order matches the equipment's printout layout for OCR alignment.

export const ANALYTES: Analyte[] = [
  { id: 'WBC', name: 'WBC', unit: '×10³/µL', decimals: 2 },
  { id: 'RBC', name: 'RBC', unit: '×10⁶/µL', decimals: 2 },
  { id: 'HGB', name: 'HGB', unit: 'g/dL', decimals: 1 },
  { id: 'HCT', name: 'HCT', unit: '%', decimals: 1 },
  { id: 'MCV', name: 'MCV', unit: 'fL', decimals: 1 },
  { id: 'MCH', name: 'MCH', unit: 'pg', decimals: 1 },
  { id: 'MCHC', name: 'MCHC', unit: 'g/dL', decimals: 1 },
  { id: 'PLT', name: 'PLT', unit: '×10³/µL', decimals: 0 },
  { id: 'RDW', name: 'RDW', unit: '%', decimals: 1 },
  { id: 'MPV', name: 'MPV', unit: 'fL', decimals: 1 },
  { id: 'PCT', name: 'PCT', unit: '%', decimals: 3 },
  { id: 'PDW', name: 'PDW', unit: 'fL', decimals: 1 },
  { id: 'NEU#', name: 'NEU#', unit: '×10³/µL', decimals: 2 },
  { id: 'LYM#', name: 'LYM#', unit: '×10³/µL', decimals: 2 },
  { id: 'MON#', name: 'MON#', unit: '×10³/µL', decimals: 2 },
  { id: 'EOS#', name: 'EOS#', unit: '×10³/µL', decimals: 2 },
  { id: 'BAS#', name: 'BAS#', unit: '×10³/µL', decimals: 2 },
];

export const ANALYTE_MAP: Record<string, Analyte> = Object.fromEntries(
  ANALYTES.map((a) => [a.id, a]),
);

// ─── Westgard — minimum runs required per rule ────────────────────────────────

export const WESTGARD_MIN_RUNS = {
  '1-2s': 1,
  '1-3s': 1,
  '2-2s': 2,
  'R-4s': 2,
  '4-1s': 4,
  '10x': 10,
} as const;

/** Minimum confirmed runs before internal statistics are computed */
export const MIN_RUNS_FOR_INTERNAL_STATS = 20;

// ─── Firestore Collection Paths ───────────────────────────────────────────────

export const COLLECTIONS = {
  USERS: 'users',
  LABS: 'labs',
  ACCESS_REQUESTS: 'accessRequests',
  PENDING_USERS: 'pending_users',
  STATUS: 'status',
  AUDIT_LOGS: 'auditLogs',
} as const;

export const SUBCOLLECTIONS = {
  // Core / infra
  MEMBERS: 'members',
  DATA: 'data',
  // Módulo: Hematologia (CIQ quantitativo)
  LOTS: 'lots',
  RUNS: 'runs',
  // Módulo: Imunologia (CIQ categórico R/NR — RDC 978/2025)
  CIQ_IMUNO: 'ciq-imuno',
  CIQ_IMUNO_CONFIG: 'ciq-imuno-config',
  CIQ_IMUNO_META: 'ciq-imuno-meta', // contadores e metadados (runCount sequencial)
  CIQ_AUDIT: 'ciq-audit', // trilha de auditoria nível-lab (sobrevive à exclusão de lotes)
  AUDIT: 'audit', // subcoleção de auditoria dentro de um lote
  // Módulo: Coagulação (CIQ quantitativo)
  CIQ_COAGULACAO: 'ciq-coagulacao',
  CIQ_COAGULACAO_META: 'ciq-coagulacao-meta',
  CIQ_COAGULACAO_CONFIG: 'ciq-coagulacao-config',
  CIQ_COAGULACAO_AUDIT: 'ciq-coagulacao-audit',
  // Módulo: Uroanálise (CIQ híbrido — categórico + quantitativo)
  CIQ_UROANALISE: 'ciq-uroanalise',
  CIQ_UROANALISE_META: 'ciq-uroanalise-meta',
  CIQ_UROANALISE_CONFIG: 'ciq-uroanalise-config',
  CIQ_UROANALISE_AUDIT: 'ciq-uroanalise-audit',
  // Cadastro mestre de Insumos (controles, reagentes, tiras) — cross-module
  INSUMOS: 'insumos',
  INSUMO_MOVIMENTACOES: 'insumo-movimentacoes',
  // Módulos futuros — descomentar ao implementar:
  // CIQ_BIOQUIMICA: 'ciq-bioquimica',
} as const;

export const STATIC_DOC_IDS = {
  APP_STATE: 'appState',
  INIT: 'init',
} as const;

// ─── Module JWT Claim Keys ────────────────────────────────────────────────────
// Fonte única de verdade para chaves de claim de módulo.
// Usar em hasModuleAccess() (firestore.rules) e setModulesClaims() (functions).
// Adicionar aqui ao registrar um novo módulo.

export const MODULE_CLAIMS = {
  hematologia: 'hematologia',
  imunologia: 'imunologia',
  coagulacao: 'coagulacao',
  uroanalise: 'uroanalise',
  // bioquimica: 'bioquimica',
} as const;

export type ModuleClaim = (typeof MODULE_CLAIMS)[keyof typeof MODULE_CLAIMS];

// ─── Storage Paths ────────────────────────────────────────────────────────────

export const storagePath = {
  // Hematologia — imagem do printout do equipamento
  runImage: (labId: string, lotId: string, runId: string) =>
    `labs/${labId}/lots/${lotId}/runs/${runId}.jpg`,
  // Imunologia — foto do strip de imunoensaio
  imunoStripImage: (labId: string, lotId: string, runId: string) =>
    `labs/${labId}/ciq-imuno/${lotId}/strips/${runId}.jpg`,
  // Coagulação — foto opcional do printout do coagulômetro
  coagRunImage: (labId: string, lotId: string, runId: string) =>
    `labs/${labId}/ciq-coagulacao/${lotId}/runs/${runId}.jpg`,
  // Uroanálise — foto da tira reagente (usada pelo OCR em v2)
  uroTiraImage: (labId: string, lotId: string, runId: string) =>
    `labs/${labId}/ciq-uroanalise/${lotId}/tiras/${runId}.jpg`,
  // Infra
  labLogo: (labId: string) => `labs/${labId}/logo`,
} as const;

// ─── Audit QR Base URL ────────────────────────────────────────────────────────
// Usado para gerar QR Codes de rastreabilidade (CIQAuditor, etapa 8).
// Definir VITE_AUDIT_BASE_URL no .env para sobrescrever em produção.

export const AUDIT_BASE_URL: string =
  (import.meta as { env?: { VITE_AUDIT_BASE_URL?: string } }).env?.VITE_AUDIT_BASE_URL ??
  'https://cq.labclin.com.br/audit';

// ─── Gemini ───────────────────────────────────────────────────────────────────

export const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

// ─── Westgard — warning-only rules (excluded from rejection logic) ────────────
export const WARNING_ONLY_WESTGARD_RULES = new Set<string>(['1-2s']);

// ─── UI ───────────────────────────────────────────────────────────────────────

export const TOAST_DURATION_MS = 4000;

export const SYNC_DEBOUNCE_MS = 1200;

export const IMAGE_UPLOAD_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_TYPES)[number];
