/**
 * Extract Laudo Fields via OCR — Callable
 * Phase 6: RDC 978 Art. 167 field extraction + storage
 *
 * Input: labId, laudoId, storageUrl, patientId (optional)
 * Flow:
 *   1. Fetch laudo from Firestore
 *   2. Check patient consent (LGPD Art. 9)
 *   3. Call extractLaudoFields() orchestrator
 *   4. Store result in /laudos/{labId}/extractions/{laudoId}
 *   5. Update laudo doc with OCR metadata
 *   6. Return extracted fields
 *
 * Fallback: if OCR fails, return error with allowManualEntry=true
 */

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { extractLaudoFields } from '../laudoOCRExtractor';
import { validateLaudoExtraction } from '../validators';
import {
  ExtractLaudoFieldsInput,
  ExtractLaudoFieldsResponse,
  ExtractLaudoFieldsInputSchema,
} from '../types';

export const extractLaudoFieldsCallable = onCall<
  ExtractLaudoFieldsInput,
  ExtractLaudoFieldsResponse
>(
  {
    region: 'southamerica-east1',
    memory: '1GB',
    timeoutSeconds: 60, // Gemini Vision may take a few seconds
  },
  async (request): Promise<ExtractLaudoFieldsResponse> => {
    try {
      // 1. Auth check
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      // 2. Parse and validate input
      let input: ExtractLaudoFieldsInput;
      try {
        input = ExtractLaudoFieldsInputSchema.parse(request.data);
      } catch (err) {
        throw new HttpsError(
          'invalid-argument',
          `Invalid input: ${(err as Error).message}`
        );
      }

      const { labId, laudoId, storageUrl, patientId } = input;

      // 3. Verify lab membership (RT/auditor/admin only)
      const db = admin.firestore();
      const memberDoc = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();

      if (!memberDoc.exists) {
        throw new HttpsError(
          'permission-denied',
          `User not member of lab ${labId}`
        );
      }

      const memberData = memberDoc.data();
      if (!memberData?.status === 'active') {
        throw new HttpsError(
          'permission-denied',
          `User not active member of lab ${labId}`
        );
      }

      // 4. Fetch laudo to verify it exists + get patient ID if not provided
      const laudoDoc = await db.doc(`labs/${labId}/laudos/${laudoId}`).get();

      if (!laudoDoc.exists) {
        return {
          ok: false,
          error: 'Laudo not found',
          code: 'not_found',
          allowManualEntry: true,
        };
      }

      const laudoData = laudoDoc.data();
      const actualPatientId = patientId ?? laudoData?.patientId;

      // 5. Call extractor (includes consent gate if patientId provided)
      let extraction;
      try {
        extraction = await extractLaudoFields(
          storageUrl,
          labId,
          actualPatientId,
          request.auth.uid,
          db
        );
      } catch (err) {
        const error = err as HttpsError | Error;
        const code = error instanceof HttpsError ? error.code : 'vision_failed';

        return {
          ok: false,
          error: error.message,
          code: code as any,
          allowManualEntry: true, // Allow RT to manually enter if OCR fails
        };
      }

      // 6. Populate laudoId in extraction
      extraction.laudoId = laudoId;

      // 7. Validate extraction
      const validation = validateLaudoExtraction(extraction);
      if (!validation.ok) {
        return {
          ok: false,
          error: 'Extraction validation failed: ' + validation.warnings.join('; '),
          code: 'validation_failed',
          allowManualEntry: true,
        };
      }

      // 8. Store extraction result in Firestore
      const extractionRef = db.doc(`laudos/${labId}/extractions/${laudoId}`);
      await extractionRef.set({
        ...extraction,
        storedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 9. Update laudo doc with OCR metadata
      await laudoDoc.ref.update({
        ocr: {
          field10Confidence: extraction.field10.confidence,
          field11Detected: extraction.field11.detected,
          field12Detected: extraction.field12.detected,
          extractedAt: extraction.extractedAt,
          status: 'completed',
        },
        lastOCRAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 10. Log to audit
      await admin
        .firestore()
        .collection('auditLogs')
        .add({
          action: 'laudo-ocr-extraction-complete',
          labId,
          laudoId,
          operatorId: request.auth.uid,
          extractedAt: extraction.extractedAt,
          source: 'auto',
          warnings: validation.warnings,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((err) => {
          console.error('[extractLaudoFieldsCallable] Audit log failed:', err);
        });

      return {
        ok: true,
        extraction,
        message: validation.warnings.length > 0
          ? `Extraction completed with ${validation.warnings.length} advisory warnings`
          : 'Extraction completed successfully',
      };
    } catch (error) {
      console.error('[extractLaudoFieldsCallable] Error:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        `Extraction failed: ${(error as Error).message}`
      );
    }
  }
);
