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
  | '1-2s'   // Warning: 1 value beyond ±2SD
  | '1-3s'   // Rejection: 1 value beyond ±3SD
  | '2-2s'   // Rejection: 2 consecutive values beyond ±2SD (same side)
  | 'R-4s'   // Rejection: 2 consecutive values span >4SD (opposite sides)
  | '4-1s'   // Rejection: 4 consecutive values beyond ±1SD (same side)
  | '10x';   // Rejection: 10 consecutive values on same side of mean

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

export interface Lab {
  id: string;
  name: string;
  logoUrl?: string;
  createdAt: Date;
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

// ─── UI State ─────────────────────────────────────────────────────────────────

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';
export type View = 'analyzer' | 'bulaparser' | 'labadmin' | 'superadmin';
export type StatsSource = 'manufacturer' | 'internal';

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
