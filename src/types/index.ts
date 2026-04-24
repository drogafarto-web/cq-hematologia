import type { User } from 'firebase/auth';

// ─── Analytes ────────────────────────────────────────────────────────────────

export interface Analyte {
  id: string;
  name: string;
  unit: string;
  /** Decimal places shown in UI and used for rounding */
  decimals: number;
}

// ─── Westgard ────────────────────────────────────────────────────────────────

export type WestgardViolation =
  | '1-2s' // Warning:   1 value beyond ±2SD
  | '1-3s' // Rejection: 1 value beyond ±3SD
  | '2-2s' // Rejection: 2 consecutive values beyond ±2SD (same side)
  | 'R-4s' // Rejection: 2 consecutive values span >4SD (opposite sides)
  | '4-1s' // Rejection: 4 consecutive values beyond ±1SD (same side)
  | '10x' // Rejection: 10 consecutive values on same side of mean
  | '6T' // Rejection: 6 consecutive values monotonically rising or falling (trend)
  | '6X'; // Rejection: 6 consecutive values all on the same side of mean (shift)

// ─── Runs ────────────────────────────────────────────────────────────────────

export type RunStatus = 'Aprovada' | 'Rejeitada' | 'Pendente';

export interface AnalyteResult {
  id: string;
  runId: string;
  analyteId: string;
  value: number;
  confidence: number;
  reasoning: string;
  timestamp: Date;
  violations: WestgardViolation[];
}

/**
 * Snapshot congelado de um insumo (reagente/controle) no momento da corrida.
 * Preserva rastreabilidade mesmo se o doc mestre for editado/descartado depois.
 * Campo aditivo — runs antigas sem o array continuam válidas.
 */
export interface RunReagenteSnapshot {
  id: string;
  nomeComercial: string;
  fabricante: string;
  lote: string;
}

/**
 * Metadata de override de compliance — gravada na run quando o operador
 * conscientemente burla um bloqueio (reagente vencido, lote reprovado, mínimo
 * de reagentes não atingido). Justificativa obrigatória (≥15 chars) e a lista
 * de blockers fica congelada aqui pra audit trail offline-tolerante. Ação
 * também espelhada em `/auditLogs` (global) pelo hook e pelo trigger server-side.
 */
export interface RunComplianceOverride {
  justificativa: string;
  overriddenAt: Date;
  overriddenBy: string;
  blockers: ReadonlyArray<{
    kind: string;
    insumoId: string;
    insumoNome: string;
    insumoLote: string;
    message: string;
  }>;
  /** Quando null, mínimo foi respeitado; gravado só quando era o bloqueio. */
  minimoFaltando?: { expected: number; got: number; modulo: string };
}

export interface Run {
  id: string;
  lotId: string;
  labId: string;
  sampleId?: string;
  timestamp: Date;
  imageUrl: string;
  status: RunStatus;
  results: AnalyteResult[];
  manualOverride?: boolean;
  createdBy: string;
  /** IDs dos insumos de reagente declarados em uso no equipamento durante esta corrida. */
  reagentesInsumoIds?: string[];
  /** Snapshot dos reagentes em uso — imutável para FR-10 audit mesmo se o insumo mestre mudar. */
  reagentesSnapshot?: RunReagenteSnapshot[];

  /**
   * Marcador de que a corrida foi registrada apesar de bloqueios de compliance
   * (reagente vencido, lote reprovado, etc). Null quando a rotina estava OK.
   * RDC 978/2025 Art.128 — rastreabilidade de insumos usados em CQ.
   */
  complianceOverride?: RunComplianceOverride;

  /**
   * Gravado pelo trigger server-side `onRunCreatedComplianceCheck` quando a
   * revalidação server diverge do client (ex: reagente vencido no server mas
   * UI não bloqueou). Quando presente SEM `complianceOverride`, é anomalia —
   * client bypassou validação. Caller deve reagir com alerta ao operador.
   */
  complianceViolation?: {
    detectedAt: Date;
    kinds: string[];
    message: string;
  };
}

/** Transient in-memory state while operator reviews AI extraction */
export interface PendingRun {
  file: File;
  base64: string;
  mimeType: string;
  sampleId?: string;
  results: {
    [analyteId: string]: {
      value: number;
      confidence: number;
      reasoning: string;
    };
  };
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface AnalyteStats {
  mean: number;
  sd: number;
  /** Coefficient of variation in percent — populated by calculateRunStats */
  cv?: number;
  /** Sample count used to compute these stats */
  n?: number;
}

export type ManufacturerStats = Record<string, AnalyteStats>;
export type InternalStats = Record<string, AnalyteStats>;

// ─── Lots ─────────────────────────────────────────────────────────────────────

export interface ControlLot {
  id: string;
  labId: string;
  lotNumber: string;
  controlName: string;
  equipmentName: string;
  serialNumber: string;
  level: 1 | 2 | 3;
  startDate: Date;
  expiryDate: Date;
  requiredAnalytes: string[];
  manufacturerStats: ManufacturerStats;
  /**
   * All confirmed runs for this lot.
   * In Firestore this is a subcollection; in memory it is denormalized here
   * so the rest of the app can work with a single coherent object.
   */
  runs: Run[];
  /** Computed from confirmed runs; null until enough runs exist */
  statistics: InternalStats | null;
  /** Cached run count — avoid fetching subcollection just for display */
  runCount: number;
  createdAt: Date;
  createdBy: string;

  // ── Fase B1 (2026-04-21) ──────────────────────────────────────────────────

  /**
   * Frequência estruturada (substitui string livre legada). Opcional durante
   * migração — lotes antigos sem esse campo assumem 'diaria'. Ver
   * `FrequencyConfig` em features/insumos/types.
   */
  frequencyConfig?: {
    frequencyType: 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'custom';
    frequencyDays?: number;
  };

  /**
   * Quando o lote exige registro de controle em cada corrida (default true).
   * Relevante em Uroanálise — alguns fluxos aceitam rodar só a tira. Demais
   * módulos ignoram esse flag (sempre exigem controle por corrida).
   */
  requerControlePorCorrida?: boolean;
}

// ─── Labs & Auth ──────────────────────────────────────────────────────────────

export interface LabContact {
  email: string;
  phone: string;
}

export interface LabAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  /** Brazilian UF code, e.g. "SP" */
  state: string;
  zipCode: string;
}

export interface LabQCSettings {
  westgardRules: {
    '1-2s': boolean;
    '1-3s': boolean;
    '2-2s': boolean;
    'R-4s': boolean;
    '4-1s': boolean;
    '10x': boolean;
  };
  /** Minimum confirmed runs before internal statistics are computed */
  minRunsForInternalStats: number;
}

export interface LabCompliance {
  cnesCode?: string;
  anvisaLicense?: string;
  iso15189: boolean;
  accreditationBody?: string;
}

export type LabPlan = 'free' | 'basic' | 'professional' | 'enterprise';
export type LabSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export interface LabSubscription {
  plan: LabPlan;
  status: LabSubscriptionStatus;
  trialEndsAt?: Date;
  currentPeriodEndsAt?: Date;
}

export interface LabBackupConfig {
  /**
   * Destinatários do backup diário consolidado. Aceita N emails.
   * Lista vazia desabilita o envio mesmo com `enabled: true`.
   */
  emails: string[];
  /**
   * @deprecated Use `emails`. Mantido para compatibilidade com documentos
   * antigos — `normalizeLab()` migra automaticamente para `emails` na leitura.
   */
  email?: string | null;
  /** Master switch — false suspends backup without removing recipients. */
  enabled: boolean;
  /** Destinatários do relatório CQI diário (23:00 BRT). */
  cqiEmails: string[];
  /**
   * @deprecated Use `cqiEmails`. Mantido para compatibilidade.
   */
  cqiEmail?: string | null;
  /** Master switch do CQI — independente do `enabled` do backup. */
  cqiEnabled: boolean;
  /**
   * Number of days without new runs before a staleness alert is included.
   * Warning threshold: [stalenessThresholdDays, 6] days.
   * Critical threshold: 7+ days, or lots exist but zero runs ever.
   * Default: 3.
   */
  stalenessThresholdDays: number;
}

/**
 * All new fields beyond `name`, `logoUrl` and `createdAt` are optional so that
 * existing Firestore documents never fail to deserialize. Always pass raw
 * Firestore data through `normalizeLab()` before storing in state — that
 * function fills every optional field with a safe default so components can
 * always read `lab.contact.email`, `lab.qcSettings.westgardRules`, etc.
 * without null-checks.
 */
export interface Lab {
  id: string;
  /** Display name — always required */
  name: string;
  /** Full legal / tax name */
  legalName?: string;
  logoUrl?: string;
  /** CNPJ in formatted form, e.g. "12.345.678/0001-99" */
  cnpj?: string;
  contact?: LabContact;
  address?: LabAddress;
  qcSettings?: LabQCSettings;
  compliance?: LabCompliance;
  subscription?: LabSubscription;
  /** Automated email backup configuration. Absent on legacy documents — use normalizeLab(). */
  backup?: LabBackupConfig;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
}

export type UserRole = 'owner' | 'admin' | 'member';

export interface AppProfile {
  user: User;
  labs: Lab[];
  activeLab: Lab | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
}

// ─── Access Requests ──────────────────────────────────────────────────────────

export type AccessRequestStatus = 'pending' | 'approved' | 'denied';

export interface AccessRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  labId: string;
  labName: string;
  status: AccessRequestStatus;
  createdAt: Date;
}

// ─── Bula Parser ─────────────────────────────────────────────────────────────

/**
 * Per-level data extracted from a bula PDF.
 * `equipmentSources` maps analyteId → equipment name; when the value
 * differs from the primary Yumizen H550 it signals a fallback analyte.
 */
export interface BulaLevelData {
  level: 1 | 2 | 3;
  lotNumber: string | null;
  manufacturerStats: ManufacturerStats;
  /** analyteId → equipment name the value was read from (e.g. "Pentra 60") */
  equipmentSources?: Record<string, string>;
}

/**
 * Data extracted from a manufacturer PDF bula; stored in app state so
 * AddLotModal (or a batch-creation flow) can pre-fill lot fields.
 * `levels` always has at least one entry; typically 1–3 entries.
 */
export interface PendingBulaData {
  controlName: string | null;
  expiryDate: Date | null;
  levels: BulaLevelData[];
  warnings: string[];
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';
export type View =
  | 'hub'
  | 'analyzer'
  | 'bulaparser'
  | 'superadmin'
  | 'reports'
  | 'ciq-imuno'
  | 'coagulacao'
  | 'uroanalise'
  | 'insumos'
  | 'lab-settings'
  | 'educacao-continuada';
export type StatsSource = 'manufacturer' | 'internal';
export type ImageState = 'ready' | 'uploading' | 'none';

// ─── Stored / Serialized State ────────────────────────────────────────────────

export interface StoredState {
  lots: ControlLot[];
  activeLotId: string | null;
  selectedAnalyteId: string | null;
}

// ─── Database Abstraction ─────────────────────────────────────────────────────

export type Unsubscribe = () => void;

export interface AppStatePatch {
  activeLotId: string | null;
  selectedAnalyteId: string | null;
}

export interface DatabaseService {
  // Full-state sync — legacy / bulk import only. Hot paths use the granular
  // helpers below, because re-touching every lot document on a simple
  // "select another lot" action trips the admin-only Firestore rule for
  // lot metadata and breaks the UX for non-admin members.
  saveState(state: StoredState): Promise<void>;
  loadState(): Promise<StoredState | null>;
  subscribeToState(callback: (state: StoredState) => void): Unsubscribe;
  uploadFile(file: File, path: string): Promise<string>;

  // Granular writes — preferred.
  saveAppState(patch: AppStatePatch): Promise<void>;
  saveLot(lot: ControlLot): Promise<void>;
  deleteLot(lotId: string): Promise<void>;
  saveRun(lotId: string, run: Run): Promise<void>;
  deleteRun(lotId: string, runId: string): Promise<void>;
}

// ─── Gemini / AI ──────────────────────────────────────────────────────────────

export interface GeminiAnalyteResult {
  value: number;
  confidence: number;
  reasoning: string;
}

export interface GeminiExtractionResponse {
  sampleId?: string;
  results: Record<string, GeminiAnalyteResult>;
}

// ─── CQ Regulatório (RDC 978/2025) ───────────────────────────────────────────

/** Interface completa para corridas auditáveis — RDC 978/2025 compliant */
export interface CQRun {
  id: string;
  // Rastreabilidade (RDC Art.128)
  operatorId: string;
  operatorName: string;
  operatorRole: 'biomedico' | 'tecnico' | 'farmaceutico';
  /** CRBM-XXXX ou CRF-XXXX */
  operatorDocument?: string;
  confirmedAt: import('firebase/firestore').Timestamp;
  // IA
  aiData: Record<string, number | null>;
  /** Confiança 0–1 por analito */
  aiConfidence?: Record<string, number>;
  // Intervenção humana
  isEdited: boolean;
  editedFields?: string[];
  originalData?: Record<string, number | null>;
  confirmedData: Record<string, number>;
  // Contexto
  labId: string;
  lotId: string;
  level: 1 | 2 | 3;
  equipmentId?: string;
  // Qualidade — union type com hífens (compatível com westgardRules.ts)
  westgardViolations?: WestgardViolation[];
  status: RunStatus;
  // Imutabilidade (Copy-on-Write)
  version: number;
  previousRunId?: string;
  logicalSignature?: string;
  // Auditoria
  createdAt: import('firebase/firestore').Timestamp;
  createdBy: string;
  imageUrl?: string;
}

export interface OperatorStat {
  operatorId: string;
  operatorName: string;
  totalRuns: number;
  editedRuns: number;
  /** Proporção 0–1 de corridas aprovadas */
  approvalRate: number;
}

export interface ReportFilters {
  labId: string;
  startDate: Date;
  endDate: Date;
  operatorId?: string;
  level?: 1 | 2 | 3;
  status?: RunStatus;
}

export interface ReportStats {
  totalRuns: number;
  editedByHuman: number;
  /** Proporção 0–1 */
  approvalRate: number;
  westgardByRule: Record<string, number>;
  byOperator: OperatorStat[];
}
