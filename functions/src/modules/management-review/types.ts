/**
 * Management Review — server-side types (admin SDK)
 * Mirror of src/features/management-review/types but uses firebase-admin Timestamp.
 * Functions tsconfig only includes functions/src/, so client types cannot be imported.
 */

import { Timestamp } from 'firebase-admin/firestore';

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: Timestamp;
}

export interface ReviewEntry {
  id: string;
  sectionNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  sectionTitle: string;
  content: string;
  sourceData?: Record<string, any>;
  notes?: string;
}

export interface ReviewTemplate {
  year: number;
  entries: ReviewEntry[];
  sourceDataTimestamp: Timestamp;
  warnings?: string[];
}

export interface ManagementReview {
  id: string;
  labId: string;
  year: number;
  dataRevisao: Timestamp;
  entries: ReviewEntry[];
  participantes: string[];
  diretor: string;
  gerenteQualidade: string;
  outrasCargos?: string[];
  chainHash: LogicalSignature;
  status: 'draft' | 'submitted' | 'approved' | 'archived';
  ataIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;
}
