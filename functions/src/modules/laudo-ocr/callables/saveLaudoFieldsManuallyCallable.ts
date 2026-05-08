/**
 * Save Laudo Fields Manually — Callable
 * Phase 6: Fallback when OCR fails; RT/director can manually enter fields 10–12
 *
 * Input: labId, laudoId, field10Text, field11CapturedBy, field12CapturedBy, etc.
 * Flow:
 *   1. Verify lab membership (RT/admin only)
 *   2. Validate field10 is non-empty
 *   3. Construct manual extraction record
 *   4. Store in /laudos/{labId}/extractions/{laudoId}
 *   5. Update laudo doc with manual entry metadata
 *   6. Audit: 'laudo-fields-manual-entry'
 *
 * Difference from OCR:
 *   - source='manual' (not 'auto')
 *   - capturedBy field tracks who entered each field
 *   - No Gemini call; no latency metric
 */

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  SaveLaudoFieldsManuallyInput,
  SaveLaudoFieldsManuallyInputSchema,
  LaudoExtractedFields,
} from '../types';
import { validateLaudoExtraction } from '../validators';

export const saveLaudoFieldsManuallyCallable = onCall(
  {
    region: 'southamerica-east1',
    memory: '512MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      // 1. Auth check
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      // 2. Parse and validate input
      let input: SaveLaudoFieldsManuallyInput;
      try {
        input = SaveLaudoFieldsManuallyInputSchema.parse(request.data);
      } catch (err) {
        throw new HttpsError(
          'invalid-argument',
          `Invalid input: ${(err as Error).message}`
        );
      }

      const {
        labId,
        laudoId,
        field10Text,
        field11CapturedBy,
        field12CapturedBy,
        field11Notes,
        field12Notes,
        field12Date,
      } = input;

      const db = admin.firestore();

      // 3. Verify lab membership (RT/admin only)
      const memberDoc = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();

      if (!memberDoc.exists) {
        throw new HttpsError(
          'permission-denied',
          `User not member of lab ${labId}`
        );
      }

      const memberData = memberDoc.data();
      const userRole = memberData?.role;

      // Allow RT and admin roles (configurable per lab)
      if (!['RT', 'admin', 'owner'].includes(userRole)) {
        throw new HttpsError(
          'permission-denied',
          `Role ${userRole} not authorized for manual field entry`
        );
      }

      // 4. Fetch laudo to verify it exists
      const laudoDoc = await db.doc(`labs/${labId}/laudos/${laudoId}`).get();

      if (!laudoDoc.exists) {
        return {
          ok: false,
          error: 'Laudo not found',
        };
      }

      // 5. Validate field10 is non-empty
      if (!field10Text || field10Text.trim().length === 0) {
        return {
          ok: false,
          error: 'Field 10 (Observações) is required and cannot be empty',
        };
      }

      // 6. Construct manual extraction record
      const now = admin.firestore.Timestamp.now();
      const extraction: LaudoExtractedFields = {
        labId,
        laudoId,
        field10: {
          text: field10Text.trim(),
          confidence: 'high', // Assume high confidence for manual entry
        },
        field11: {
          detected: field11CapturedBy ? true : false,
          notes: field11Notes,
          confidence: field11CapturedBy ? 'high' : undefined,
        },
        field12: {
          detected: field12CapturedBy ? true : false,
          dateText: field12Date || null,
          notes: field12Notes,
          confidence: field12CapturedBy ? 'high' : undefined,
        },
        source: 'manual',
        extractedAt: now,
        extractedBy: request.auth.uid,
        status: 'completed',
      };

      // 7. Validate extraction (should pass since field10 is verified)
      const validation = validateLaudoExtraction(extraction);
      if (!validation.ok) {
        return {
          ok: false,
          error: 'Validation failed: ' + validation.warnings.join('; '),
        };
      }

      // 8. Store extraction result in Firestore
      const extractionRef = db.doc(`laudos/${labId}/extractions/${laudoId}`);
      await extractionRef.set({
        ...extraction,
        storedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 9. Update laudo doc with manual entry metadata
      await laudoDoc.ref.update({
        ocr: {
          field10Confidence: 'high',
          field11Detected: field11CapturedBy ? true : false,
          field12Detected: field12CapturedBy ? true : false,
          extractedAt: extraction.extractedAt,
          source: 'manual',
          status: 'completed',
        },
        lastOCRAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 10. Log to audit
      await admin
        .firestore()
        .collection('auditLogs')
        .add({
          action: 'laudo-fields-manual-entry',
          labId,
          laudoId,
          operatorId: request.auth.uid,
          field11CapturedBy: field11CapturedBy || null,
          field12CapturedBy: field12CapturedBy || null,
          extractedAt: extraction.extractedAt,
          source: 'manual',
          warnings: validation.warnings,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((err) => {
          console.error('[saveLaudoFieldsManuallyCallable] Audit log failed:', err);
        });

      return {
        ok: true,
        extraction,
        message: `Fields saved manually by ${userRole} ${request.auth.uid}`,
      };
    } catch (error) {
      console.error('[saveLaudoFieldsManuallyCallable] Error:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        `Save failed: ${(error as Error).message}`
      );
    }
  }
);
