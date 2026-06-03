import type { firestore } from 'firebase-admin';
import { z } from 'zod';

type Timestamp = firestore.Timestamp;

// ─── Severity Levels ───────────────────────────────────────────────────────

export const SeverityLevelSchema = z.enum(['green', 'yellow', 'red', 'black']);
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;

// ─── Incident Status ───────────────────────────────────────────────────────

export const IncidentStatusSchema = z.enum([
  'open',
  'investigating',
  'mitigating',
  'resolved',
  'closed',
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

// ─── Escalation Level ─────────────────────────────────────────────────────

export const EscalationLevelSchema = z.enum(['internal', 'team', 'leadership', 'legal']);
export type EscalationLevel = z.infer<typeof EscalationLevelSchema>;

// ─── Main Incident Document ────────────────────────────────────────────────

export interface Incident {
  readonly id: string;
  readonly labId: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  readonly startedAt: Timestamp;
  resolvedAt?: Timestamp;
  readonly declaredAt: Timestamp;
  readonly declaredBy: string;
  declaredByName?: string;
  affectedSystems: string[];
  affectedUserCount: number;
  affectedFeatures: string[];
  runbookApplied?: string;
  escalationLevel: EscalationLevel;
  estimatedMTTR?: number;
  actualMTTR?: number;
  postMortemScheduledAt?: Timestamp;
  postMortemDocLink?: string;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  readonly deletadoEm?: Timestamp;
}

// ─── Incident Action (Subcollection) ───────────────────────────────────────

export interface IncidentAction {
  readonly id: string;
  action: string;
  readonly takenAt: Timestamp;
  readonly takenBy: string;
  result: 'success' | 'partial' | 'failed';
  notes?: string;
}

// ─── Post-Mortem Action (Subcollection) ────────────────────────────────────

export interface PostMortemAction {
  readonly id: string;
  item: string;
  owner: string;
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
    }),
  ),
});

export type RecordPostMortemInput = z.infer<typeof RecordPostMortemInputSchema>;

// ─── Validation Helpers ────────────────────────────────────────────────────

export function isValidSeverityEscalation(from: SeverityLevel, to: SeverityLevel): boolean {
  const severityRank: Record<SeverityLevel, number> = {
    green: 1,
    yellow: 2,
    red: 3,
    black: 4,
  };
  return severityRank[to] >= severityRank[from];
}

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
