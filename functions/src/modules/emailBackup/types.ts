import type * as admin from 'firebase-admin';

// ─── Backup Config (stored in labs/{labId}.backup) ────────────────────────────

export interface LabBackupConfig {
  /** Destination email — null disables the backup for this lab */
  email: string | null;
  /** Master switch — set to false to suspend without removing the email */
  enabled: boolean;
  /**
   * Alert threshold in days.
   * If a module has data but no new runs in this many days, a staleness alert
   * is included in the email. Default: 3.
   */
  stalenessThresholdDays: number;
}

// ─── Module Section ───────────────────────────────────────────────────────────

/** A single row in a module's backup table. Keys are column labels → values. */
export type BackupRow = Record<string, string>;

/** All data a module contributes to a single backup run. */
export interface ModuleBackupSection {
  /** Module identifier — must be unique across all registered collectors */
  moduleId: string;
  /** Human-readable name shown as the section header in the PDF */
  moduleName: string;
  /** ISO date of the most recent run in this period, or null if no runs */
  lastRunDate: string | null;
  /** Total run count in the backup period */
  totalRuns: number;
  /** Count of non-conforming / rejected runs */
  nonConformingRuns: number;
  /** Column headers for the data table (ordered) */
  columns: string[];
  /** Data rows — each row must have a value for every column (use '—' for absent) */
  rows: BackupRow[];
  /** Additional key→value stats shown below the section header */
  summary: Record<string, string>;
}

// ─── Staleness Alert ──────────────────────────────────────────────────────────

export type StalenessLevel = 'warning' | 'critical';

export interface StalenessAlert {
  moduleId: string;
  moduleName: string;
  /** Days elapsed since the last run was registered for this module in this lab */
  daysSinceLastRun: number;
  level: StalenessLevel;
  /** ISO date-time of the last run, or null if the module has lots but zero runs */
  lastRunAt: string | null;
}

// ─── Backup Report ────────────────────────────────────────────────────────────

/** Full report assembled before generating the PDF and sending the email. */
export interface BackupReport {
  labId: string;
  labName: string;
  labCnpj?: string;
  /** Start of the period (UTC midnight 30 days ago) */
  periodStart: Date;
  /** End of the period (now) */
  periodEnd: Date;
  /** One section per module with data in the period */
  sections: ModuleBackupSection[];
  /** Staleness alerts for modules that have lots but no recent activity */
  stalenessAlerts: StalenessAlert[];
  /** ISO date-time when this report was generated */
  generatedAt: string;
  /** SHA-256 of the concatenated section data — integrity fingerprint */
  contentHash: string;
}

// ─── Module Collector Interface ───────────────────────────────────────────────

/**
 * Contract that every module must implement to participate in the backup system.
 *
 * Registration:
 *   import { moduleRegistry } from '../registry';
 *   moduleRegistry.register(myCollector);
 *
 * Adding a new module:
 *   1. Create a new file in collectors/ implementing this interface.
 *   2. Register it in collectors/index.ts.
 *   3. Done — the backup function will pick it up automatically.
 */
export interface ModuleCollector {
  /** Unique module identifier — same as the JWT claim key (e.g. 'hematologia') */
  moduleId: string;
  /** Display name used in PDF section headers and email body */
  moduleName: string;

  /**
   * Collect backup data for a lab within the given date range.
   * Should return null if the lab has no configured data for this module
   * (e.g. no lots at all), so the PDF omits the section cleanly.
   */
  collect(
    db: admin.firestore.Firestore,
    labId: string,
    from: Date,
    to: Date,
  ): Promise<ModuleBackupSection | null>;

  /**
   * Check when the last run was registered for this module.
   * Returns a StalenessAlert if the lab has lots but no recent activity,
   * or null if either: the module has no data, or activity is recent enough.
   */
  checkStaleness(
    db: admin.firestore.Firestore,
    labId: string,
    thresholdDays: number,
  ): Promise<StalenessAlert | null>;
}

// ─── Backup Log (stored in labs/{labId}/backup-logs/{YYYY-MM-DD}) ─────────────

export interface BackupLog {
  sentAt: admin.firestore.Timestamp;
  toEmail: string;
  labId: string;
  periodStart: string;
  periodEnd: string;
  totalRuns: number;
  sectionsIncluded: string[];
  stalenessAlerts: number;
  /** Subject line of the email that was sent */
  emailSubject: string;
}
