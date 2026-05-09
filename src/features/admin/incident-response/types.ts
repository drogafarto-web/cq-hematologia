/**
 * Incident Response Types
 *
 * Type definitions for incident management, severity classification,
 * escalation procedures, and post-mortem tracking.
 *
 * Multi-tenant path: /labs/{labId}/incidents/{incidentId}
 * Subcollections: actions, post-mortem-actions
 *
 * Compliance: RDC 978 Art. 127 (nonconformity records), DICQ 4.14.1 (CAPA procedures)
 */

import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// ─── Severity Levels ───────────────────────────────────────────────────────

export const SeverityLevelSchema = z.enum(['green', 'yellow', 'red', 'black']);
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;

/**
 * Green — Low Risk / Development Issue
 * - No patient impact, internal systems only
 * - Response time SLA: Next business day
 */

/**
 * Yellow — Moderate Impact / Partial Degradation
 * - Some users affected, workaround available
 * - Response time SLA: 4 hours
 */

/**
 * Red — High Impact / Critical Degradation
 * - Core workflow down, many users affected
 * - Response time SLA: 1 hour
 */

/**
 * Black — Complete System Failure / Regulatory Crisis
 * - System down, patient safety risk, regulatory notification required
 * - Response time SLA: Immediate
 */

// ─── Incident Status ───────────────────────────────────────────────────────

export const IncidentStatusSchema = z.enum(['open', 'investigating', 'mitigating', 'resolved', 'closed']);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

// ─── Escalation Level ─────────────────────────────────────────────────────

export const EscalationLevelSchema = z.enum(['internal', 'team', 'leadership', 'legal']);
export type EscalationLevel = z.infer<typeof EscalationLevelSchema>;

// ─── Main Incident Document ────────────────────────────────────────────────

export interface Incident {
  // Identity
  readonly id: string;
  readonly labId: string;

  // Basics
  title: string;
  description: string;

  // Severity & Status
  severity: SeverityLevel;
  status: IncidentStatus;

  // Timeline
  readonly startedAt: Timestamp;
  resolvedAt?: Timestamp;
  readonly declaredAt: Timestamp;

  // Who
  readonly declaredBy: string; // operator ID (IC)
  declaredByName?: string;

  // Impact
  affectedSystems: string[]; // e.g., ['laudo-release', 'analytics']
  affectedUserCount: number; // 0–100+
  affectedFeatures: string[]; // Descriptions of affected features

  // Response
  runbookApplied?: string; // Link or ID of runbook applied
  escalationLevel: EscalationLevel; // Internal → Team → Leadership → Legal
  estimatedMTTR?: number; // minutes (time to recovery estimate)
  actualMTTR?: number; // minutes (calculated after resolve)

  // Post-mortem
  postMortemScheduledAt?: Timestamp;
  postMortemDocLink?: string; // URL to post-mortem Google Doc or Slack thread

  // Audit
  readonly criadoEm: Timestamp;
  readonly criadoPor: string; // operator ID
  readonly deletadoEm?: Timestamp;
}

// ─── Incident Action (Subcollection) ───────────────────────────────────────

export interface IncidentAction {
  readonly id: string;
  action: string; // e.g., "Rolled back function deploy", "Restarted service X"
  readonly takenAt: Timestamp;
  readonly takenBy: string; // operator ID
  result: 'success' | 'partial' | 'failed';
  notes?: string;
}

// ─── Escalation Path ──────────────────────────────────────────────────────

export interface EscalationPath {
  fromSeverity: SeverityLevel;
  toSeverity: SeverityLevel;
  trigger: string; // e.g., "Not resolved in 2 hours"
  notifyRoles: string[]; // e.g., ['rt', 'admin', 'cto']
  requiresApproval: boolean;
}

// ─── Post-Mortem Action (Subcollection) ────────────────────────────────────

export interface PostMortemAction {
  readonly id: string;
  item: string; // e.g., "Add pre-deploy timeout test"
  owner: string; // engineer name or ID
  eta: Date;
  status: 'open' | 'in-progress' | 'complete';
  notes?: string;
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export const CreateIncidentInputSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  severity: SeverityLevelSchema,
  affectedSystems: z.array(z.string()).optional().default([]),
  affectedUserCount: z.number().int().min(0).optional().default(0),
  affectedFeatures: z.array(z.string()).optional().default([]),
  estimatedMTTR: z.number().int().min(1).optional(),
});

export type CreateIncidentInput = z.infer<typeof CreateIncidentInputSchema>;

export const UpdateIncidentStatusInputSchema = z.object({
  newStatus: IncidentStatusSchema,
  notes: z.string().optional(),
  actualMTTR: z.number().int().min(1).optional(),
});

export type UpdateIncidentStatusInput = z.infer<typeof UpdateIncidentStatusInputSchema>;

export const EscalateIncidentInputSchema = z.object({
  newSeverity: SeverityLevelSchema,
  reason: z.string().min(10, 'Escalation reason must be at least 10 characters'),
});

export type EscalateIncidentInput = z.infer<typeof EscalateIncidentInputSchema>;

export const RecordPostMortemInputSchema = z.object({
  docLink: z.string().url('Must be a valid URL'),
  actions: z.array(
    z.object({
      item: z.string().min(5),
      owner: z.string().min(2),
      eta: z.date(),
      status: z.enum(['open', 'in-progress', 'complete']).optional().default('open'),
      notes: z.string().optional(),
    })
  ),
});

export type RecordPostMortemInput = z.infer<typeof RecordPostMortemInputSchema>;

// ─── Response Types ────────────────────────────────────────────────────────

export interface CreateIncidentResponse {
  incidentId: string;
  auditEntryId?: string;
}

export interface IncidentWithActions extends Incident {
  actions?: IncidentAction[];
  postMortemActions?: PostMortemAction[];
}

// ─── Validation Helpers ────────────────────────────────────────────────────

/**
 * Validates if a status transition is allowed
 * Green/Yellow/Red/Black can escalate, but not downgrade
 */
export function isValidStatusTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
    open: ['investigating', 'resolved', 'closed'],
    investigating: ['mitigating', 'resolved', 'closed'],
    mitigating: ['resolved', 'closed'],
    resolved: ['closed'],
    closed: [], // Terminal state
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Validates if a severity escalation is allowed
 */
export function isValidSeverityEscalation(from: SeverityLevel, to: SeverityLevel): boolean {
  const severityRank: Record<SeverityLevel, number> = {
    green: 1,
    yellow: 2,
    red: 3,
    black: 4,
  };

  return severityRank[to] >= severityRank[from];
}

/**
 * Determines escalation level based on severity
 */
export function getEscalationLevelBySeverity(severity: SeverityLevel): EscalationLevel {
  switch (severity) {
    case 'green':
      return 'internal';
    case 'yellow':
      return 'team';
    case 'red':
      return 'leadership';
    case 'black':
      return 'legal';
  }
}

/**
 * Gets response SLA in minutes based on severity
 */
export function getSLAMinutes(severity: SeverityLevel): number {
  switch (severity) {
    case 'green':
      return 480; // Next business day (8 hours)
    case 'yellow':
      return 240; // 4 hours
    case 'red':
      return 60; // 1 hour
    case 'black':
      return 15; // 15 minutes (escalate to CTO immediately)
  }
}
