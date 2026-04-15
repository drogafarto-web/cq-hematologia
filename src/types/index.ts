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
  | '1-2s'   // Warning:   1 value beyond ±2SD
  | '1-3s'   // Rejection: 1 value beyond ±3SD
  | '2-2s'   // Rejection: 2 consecutive values beyond ±2SD (same side)
  | 'R-4s'   // Rejection: 2 consecutive values span >4SD (opposite sides)
  | '4-1s'   // Rejection: 4 consecutive values beyond ±1SD (same side)
  | '10x'    // Rejection: 10 consecutive values on same side of mean
  | '6T'     // Rejection: 6 consecutive values monotonically rising or falling (trend)
  | '6X';    // Rejection: 6 consecutive values all on the same side of mean (shift)

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
  level:              1 | 2 | 3;
  lotNumber:          string | null;
  manufacturerStats:  ManufacturerStats;
  /** analyteId → equipment name the value was read from (e.g. "Pentra 60") */
  equipmentSources?:  Record<string, string>;
}

/**
 * Data extracted from a manufacturer PDF bula; stored in app state so
 * AddLotModal (or a batch-creation flow) can pre-fill lot fields.
 * `levels` always has at least one entry; typically 1–3 entries.
 */
export interface PendingBulaData {
  controlName: string | null;
  expiryDate:  Date | null;
  levels:      BulaLevelData[];
  warnings:    string[];
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';
export type View = 'hub' | 'analyzer' | 'bulaparser' | 'labadmin' | 'superadmin' | 'reports' | 'ciq-imuno';
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

export interface DatabaseService {
  saveState(state: StoredState): Promise<void>;
  loadState(): Promise<StoredState | null>;
  subscribeToState(callback: (state: StoredState) => void): Unsubscribe;
  uploadFile(file: File, path: string): Promise<string>;
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
