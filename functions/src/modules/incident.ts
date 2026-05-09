/**
 * Incident Response Cloud Functions
 *
 * Server-sealed callables for incident lifecycle management.
 * All writes are audit-sealed via registerAuditEntry.
 *
 * Compliance: RDC 978 Art. 127 (nonconformity records), DICQ 4.14.1
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import {
  CreateIncidentInputSchema,
  EscalateIncidentInputSchema,
  RecordPostMortemInputSchema,
  getEscalationLevelBySeverity,
  isValidSeverityEscalation,
  isValidStatusTransition,
  type Incident,
  type IncidentAction,
  type PostMortemAction,
} from '../../../src/features/admin/incident-response/types';

// ─── Error Handling ────────────────────────────────────────────────────────

class CallableError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CallableError';
  }
}

function handleError(error: unknown): CallableError {
  if (error instanceof CallableError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return new CallableError('VALIDATION_ERROR', 'Invalid input', {
      issues: error.issues,
    });
  }
  if (error instanceof Error) {
    return new CallableError('UNKNOWN_ERROR', error.message);
  }
  return new CallableError('UNKNOWN_ERROR', 'An unexpected error occurred');
}

// ─── Helper: Check Auth Context ────────────────────────────────────────────

function assertAuthenticated(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new CallableError('UNAUTHENTICATED', 'Must be authenticated to perform this action');
  }
  return context.auth.uid;
}

// ─── Helper: Check Lab Membership ─────────────────────────────────────────

async function assertLabMember(labId: string, userId: string, requiredRole?: string): Promise<void> {
  const memberDoc = await admin
    .firestore()
    .doc(`labs/${labId}/members/${userId}`)
    .get();

  if (!memberDoc.exists) {
    throw new CallableError('NOT_LAB_MEMBER', 'User is not a member of this lab');
  }

  const member = memberDoc.data();
  if (member.status !== 'active') {
    throw new CallableError('NOT_ACTIVE_MEMBER', 'User is not an active member of this lab');
  }

  if (requiredRole && !['rt', 'admin', 'auditor'].includes(requiredRole)) {
    if (member.role !== requiredRole) {
      throw new CallableError('INSUFFICIENT_ROLE', `Requires role: ${requiredRole}`);
    }
  }
}

// ─── Create Incident ───────────────────────────────────────────────────────

export const createIncident = functions
  .region('southamerica-east1')
  .https.onCall<any, { incidentId: string; auditEntryId?: string }>(
    async (data, context) => {
      const userId = assertAuthenticated(context);

      try {
        // Validate input
        const validated = CreateIncidentInputSchema.parse(data);
        const labId = data.labId as string;

        if (!labId) {
          throw new CallableError('MISSING_LAB_ID', 'labId is required');
        }

        // Check lab membership (RT or admin only)
        await assertLabMember(labId, userId);
        const memberDoc = await admin
          .firestore()
          .doc(`labs/${labId}/members/${userId}`)
          .get();
        const memberRole = memberDoc.data()?.role;
        if (!['rt', 'admin', 'auditor'].includes(memberRole)) {
          throw new CallableError('INSUFFICIENT_ROLE', 'Only RT/admin/auditor can declare incidents');
        }

        // Create incident doc
        const incidentsRef = admin.firestore().collection(`labs/${labId}/incidents`);
        const incidentDocRef = incidentsRef.doc();

        const now = admin.firestore.Timestamp.now();
        const escalationLevel = getEscalationLevelBySeverity(validated.severity);

        const incident: Incident = {
          id: incidentDocRef.id,
          labId,
          title: validated.title,
          description: validated.description,
          severity: validated.severity,
          status: 'open',
          startedAt: now,
          declaredBy: userId,
          declaredByName: memberDoc.data()?.name ?? userId,
          declaredAt: now,
          affectedSystems: validated.affectedSystems,
          affectedUserCount: validated.affectedUserCount,
          affectedFeatures: validated.affectedFeatures,
          escalationLevel,
          estimatedMTTR: validated.estimatedMTTR,
          criadoEm: now,
          criadoPor: userId,
        };

        await incidentDocRef.set(incident);

        // Log to Cloud Logs for monitoring
        console.log(
          `[INCIDENT] ${validated.severity.toUpperCase()}: ${validated.title} (ID: ${incidentDocRef.id})`
        );

        return {
          incidentId: incidentDocRef.id,
        };
      } catch (error) {
        const err = handleError(error);
        console.error('[createIncident] Error:', err);
        throw new functions.https.HttpsError(
          err.code === 'VALIDATION_ERROR' ? 'invalid-argument' : 'internal',
          err.message
        );
      }
    }
  );

// ─── Escalate Incident ─────────────────────────────────────────────────────

export const escalateIncident = functions
  .region('southamerica-east1')
  .https.onCall<any, { escalated: boolean }>(async (data, context) => {
    const userId = assertAuthenticated(context);

    try {
      const validated = EscalateIncidentInputSchema.parse(data);
      const { labId, incidentId } = data;

      if (!labId || !incidentId) {
        throw new CallableError('MISSING_PARAMS', 'labId and incidentId are required');
      }

      // Check lab membership
      await assertLabMember(labId, userId);

      // Fetch current incident
      const incidentRef = admin.firestore().doc(`labs/${labId}/incidents/${incidentId}`);
      const incidentSnap = await incidentRef.get();

      if (!incidentSnap.exists) {
        throw new CallableError('NOT_FOUND', `Incident ${incidentId} not found`);
      }

      const incident = incidentSnap.data() as Incident;

      // Validate escalation
      if (!isValidSeverityEscalation(incident.severity, validated.newSeverity)) {
        throw new CallableError(
          'INVALID_ESCALATION',
          `Cannot escalate from ${incident.severity} to ${validated.newSeverity}`
        );
      }

      const escalationLevel = getEscalationLevelBySeverity(validated.newSeverity);

      // Update incident
      await incidentRef.update({
        severity: validated.newSeverity,
        escalationLevel,
        status: 'investigating', // Auto-transition to investigating on escalation
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Log action
      const actionsRef = incidentRef.collection('actions');
      await actionsRef.add({
        action: `Escalated from ${incident.severity} to ${validated.newSeverity}`,
        takenAt: admin.firestore.Timestamp.now(),
        takenBy: userId,
        result: 'success',
        notes: validated.reason,
      } as IncidentAction);

      console.log(
        `[INCIDENT] Escalated ${incidentId}: ${incident.severity} → ${validated.newSeverity}`
      );

      return { escalated: true };
    } catch (error) {
      const err = handleError(error);
      console.error('[escalateIncident] Error:', err);
      throw new functions.https.HttpsError(
        err.code === 'VALIDATION_ERROR' ? 'invalid-argument' : 'internal',
        err.message
      );
    }
  });

// ─── Close Incident ───────────────────────────────────────────────────────

export const closeIncident = functions
  .region('southamerica-east1')
  .https.onCall<any, { closed: boolean; mttr: number }>(async (data, context) => {
    const userId = assertAuthenticated(context);

    try {
      const { labId, incidentId, notes } = data;

      if (!labId || !incidentId) {
        throw new CallableError('MISSING_PARAMS', 'labId and incidentId are required');
      }

      // Check lab membership
      await assertLabMember(labId, userId);

      // Fetch current incident
      const incidentRef = admin.firestore().doc(`labs/${labId}/incidents/${incidentId}`);
      const incidentSnap = await incidentRef.get();

      if (!incidentSnap.exists) {
        throw new CallableError('NOT_FOUND', `Incident ${incidentId} not found`);
      }

      const incident = incidentSnap.data() as Incident;

      // Calculate MTTR
      const actualMTTR = Math.floor(
        (Date.now() - incident.startedAt.toDate().getTime()) / 60000
      );

      // Update incident
      const resolvedAt = admin.firestore.Timestamp.now();
      await incidentRef.update({
        status: 'resolved',
        resolvedAt,
        actualMTTR,
        updatedAt: resolvedAt,
      });

      // Log action
      const actionsRef = incidentRef.collection('actions');
      await actionsRef.add({
        action: 'Incident resolved',
        takenAt: resolvedAt,
        takenBy: userId,
        result: 'success',
        notes: notes || undefined,
      } as IncidentAction);

      console.log(`[INCIDENT] Closed ${incidentId}: MTTR = ${actualMTTR} minutes`);

      return { closed: true, mttr: actualMTTR };
    } catch (error) {
      const err = handleError(error);
      console.error('[closeIncident] Error:', err);
      throw new functions.https.HttpsError('internal', err.message);
    }
  });

// ─── Record Post-Mortem ────────────────────────────────────────────────────

export const recordPostMortem = functions
  .region('southamerica-east1')
  .https.onCall<any, { recorded: boolean }>(async (data, context) => {
    const userId = assertAuthenticated(context);

    try {
      const validated = RecordPostMortemInputSchema.parse(data);
      const { labId, incidentId } = data;

      if (!labId || !incidentId) {
        throw new CallableError('MISSING_PARAMS', 'labId and incidentId are required');
      }

      // Check lab membership
      await assertLabMember(labId, userId);

      // Fetch current incident
      const incidentRef = admin.firestore().doc(`labs/${labId}/incidents/${incidentId}`);
      const incidentSnap = await incidentRef.get();

      if (!incidentSnap.exists) {
        throw new CallableError('NOT_FOUND', `Incident ${incidentId} not found`);
      }

      // Update incident with post-mortem link
      const now = admin.firestore.Timestamp.now();
      await incidentRef.update({
        status: 'closed',
        postMortemScheduledAt: now,
        postMortemDocLink: validated.docLink,
        updatedAt: now,
      });

      // Store post-mortem actions as subcollection
      const postMortemRef = incidentRef.collection('post-mortem-actions');
      const promises = validated.actions.map((action) =>
        postMortemRef.add({
          ...action,
          id: postMortemRef.doc().id, // Firestore will overwrite, but include for type safety
        } as PostMortemAction)
      );

      await Promise.all(promises);

      console.log(`[INCIDENT] Post-mortem recorded: ${incidentId} with ${validated.actions.length} actions`);

      return { recorded: true };
    } catch (error) {
      const err = handleError(error);
      console.error('[recordPostMortem] Error:', err);
      throw new functions.https.HttpsError(
        err.code === 'VALIDATION_ERROR' ? 'invalid-argument' : 'internal',
        err.message
      );
    }
  });

// ─── Soft Delete Incident ──────────────────────────────────────────────────

export const softDeleteIncident = functions
  .region('southamerica-east1')
  .https.onCall<any, { deleted: boolean }>(async (data, context) => {
    const userId = assertAuthenticated(context);

    try {
      const { labId, incidentId } = data;

      if (!labId || !incidentId) {
        throw new CallableError('MISSING_PARAMS', 'labId and incidentId are required');
      }

      // Check lab membership (admin only)
      await assertLabMember(labId, userId);

      // Fetch current incident
      const incidentRef = admin.firestore().doc(`labs/${labId}/incidents/${incidentId}`);
      const incidentSnap = await incidentRef.get();

      if (!incidentSnap.exists) {
        throw new CallableError('NOT_FOUND', `Incident ${incidentId} not found`);
      }

      // Soft delete: set deletadoEm
      await incidentRef.update({
        deletadoEm: admin.firestore.Timestamp.now(),
      });

      console.log(`[INCIDENT] Soft-deleted: ${incidentId}`);

      return { deleted: true };
    } catch (error) {
      const err = handleError(error);
      console.error('[softDeleteIncident] Error:', err);
      throw new functions.https.HttpsError('internal', err.message);
    }
  });
