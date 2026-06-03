import { onCall, CallableOptions } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { ManagementReview, ReviewEntry, LogicalSignature } from './types';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';

/**
 * Cloud Function: submitReview
 *
 * Validates and creates a management review with LogicalSignature
 *
 * Validation:
 * - Auth required (director level enforced server-side)
 * - All 15 sections must have content
 * - Director + Quality Manager + at least 1 other participant
 *
 * On success:
 * - Creates ManagementReview document with status='submitted'
 * - Generates LogicalSignature (HMAC-SHA256 hash)
 * - Links associated Atas if provided
 *
 * Returns:
 * - reviewId
 * - signature (hash, operatorId, ts)
 */

const db = getFirestore();

interface SubmitReviewRequest {
  labId: string;
  year: number;
  entries: ReviewEntry[];
  participantes: string[];
  diretor: string;
  gerenteQualidade: string;
  outrasCargos?: string[];
  ataIds?: string[];
}

interface SubmitReviewResponse {
  success: boolean;
  reviewId?: string;
  signature?: LogicalSignature;
  error?: string;
}

const options: CallableOptions = {
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'southamerica-east1',
  secrets: [HCQ_SIGNATURE_HMAC_KEY],
};

export const submitReview = onCall<SubmitReviewRequest>(
  options,
  async (request): Promise<SubmitReviewResponse> => {
    try {
      const {
        labId,
        year,
        entries,
        participantes,
        diretor,
        gerenteQualidade,
        outrasCargos = [],
        ataIds = [],
      } = request.data;

      const uid = request.auth?.uid;

      // Auth check
      if (!uid) {
        throw new Error('Auth required');
      }

      // Validate lab exists
      const labRef = db.collection('labs').doc(labId);
      const labDoc = await labRef.get();
      if (!labDoc.exists) {
        throw new Error('Lab not found');
      }

      // Validate user is lab member (permission check)
      const members = labDoc.data()?.members || [];
      if (!members.includes(uid)) {
        throw new Error('Not a lab member');
      }

      // Validate all 15 sections have content
      if (entries.length !== 15) {
        throw new Error('Review must have all 15 sections');
      }

      for (const entry of entries) {
        if (!entry.content || entry.content.trim().length === 0) {
          throw new Error(`Section ${entry.sectionNumber} is required`);
        }
      }

      // Validate metadata
      if (!diretor.trim()) {
        throw new Error('Director must be specified');
      }

      if (!gerenteQualidade.trim()) {
        throw new Error('Quality Manager must be specified');
      }

      // Validate minimum participants
      const allParticipants = [diretor, gerenteQualidade, ...participantes, ...outrasCargos].filter(
        (p) => p && p.trim(),
      );

      if (allParticipants.length < 3) {
        throw new Error('Minimum 3 participants required (Director + QM + 1 other)');
      }

      // Check for duplicate review in same year
      const existingReview = await db
        .collection('labs')
        .doc(labId)
        .collection('management-reviews')
        .where('year', '==', year)
        .where('status', 'in', ['submitted', 'approved'])
        .limit(1)
        .get();

      if (!existingReview.empty) {
        throw new Error(`A review for year ${year} already exists`);
      }

      // Generate LogicalSignature
      const now = Timestamp.now();
      const reviewHash = generateChainHash(labId, year, uid, now);

      const signature: LogicalSignature = {
        hash: reviewHash,
        operatorId: uid,
        ts: now,
      };

      // Create ManagementReview document
      const reviewRef = db.collection('labs').doc(labId).collection('management-reviews').doc();

      const review: ManagementReview = {
        id: reviewRef.id,
        labId,
        year,
        dataRevisao: now,
        entries,
        participantes,
        diretor,
        gerenteQualidade,
        outrasCargos,
        chainHash: signature,
        status: 'submitted',
        ataIds,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      // Write review to Firestore
      await reviewRef.set(review);

      // Link atas if provided
      if (ataIds.length > 0) {
        const batch = db.batch();

        for (const ataId of ataIds) {
          const ataRef = db
            .collection('labs')
            .doc(labId)
            .collection('management-review-atas')
            .doc(ataId);

          batch.update(ataRef, {
            managementReviewId: reviewRef.id,
            updatedAt: now,
          });
        }

        await batch.commit();
      }

      console.log(
        `[submitReview] Created review ${reviewRef.id} for lab ${labId} year ${year}`,
        `signed by ${uid}`,
      );

      return {
        success: true,
        reviewId: reviewRef.id,
        signature,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[submitReview] Error:', message);
      return {
        success: false,
        error: message,
      };
    }
  },
);

/**
 * Generate chain hash for management review
 * Format: HMAC-SHA256(labId + year + operatorId + timestamp)
 */
function generateChainHash(labId: string, year: number, operatorId: string, ts: Timestamp): string {
  const data = `${labId}|${year}|${operatorId}|${ts.toDate().toISOString()}`;
  const secret = HCQ_SIGNATURE_HMAC_KEY.value();
  if (!secret) {
    throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured — cannot generate chain hash');
  }

  const hash = crypto.createHmac('sha256', secret).update(data).digest('hex');

  return hash;
}
