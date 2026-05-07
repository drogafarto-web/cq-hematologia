/**
 * IA Strip Image Module
 * Phase 9: OCR strip image upload + Gemini Vision classification
 *
 * Integrates with Gemini Vision API for immunology strip classification
 * Supports IgG, IgM, IgA and other immunology markers
 */

import * as functions from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  validateStripImageSafe
} from '../../shared/ia';
import type {
  StripUploadResponse,
  StripClassificationResponse
} from './types';

/**
 * Upload Strip Image
 *
 * Phase 9 Placeholder:
 * - Validate image metadata
 * - Upload to Cloud Storage with lab/operator signing
 * - Return storage URL + image ID
 *
 * Production (Phase 9):
 * - Use validateStripImage helper to validate metadata
 * - Save to /labs/{labId}/imuno-ias-dev/images/{docId}
 * - Trigger async classification pipeline
 * - Return signed URL for immediate access
 *
 * @param request Image upload request with metadata
 * @returns Image ID and Cloud Storage URL
 */
export const uploadStripImage = functions.onCall(
  async (request): Promise<StripUploadResponse> => {
    // Phase 9: Validate + upload strip image to Cloud Storage
    if (!request.data?.imageUrl && !request.data?.imageBase64) {
      return {
        status: 'ERROR',
        message: 'Missing image data'
      };
    }

    if (!request.data?.labId) {
      return {
        status: 'ERROR',
        message: 'Missing labId'
      };
    }

    // Validate image metadata using shared validator
    const validationResult = validateStripImageSafe({
      imageUrl: request.data.imageUrl || 'https://placeholder.example.com/image.jpg',
      imageDim: request.data.imageDim || { width: 0, height: 0 },
      classesDetected: [],
      confidence: 0,
      model_version: '1.0.0'
    });

    if (!validationResult.success) {
      return {
        status: 'INVALID',
        message: validationResult.error || 'Image validation failed'
      };
    }

    return {
      status: 'PLACEHOLDER',
      imageId: `image-${Date.now()}`,
      imageUrl: request.data.imageUrl || 'https://storage.googleapis.com/example/strip.jpg',
      message: 'Strip image upload (Phase 9)'
    };
  }
);

/**
 * Classify Strip Image via Gemini Vision
 *
 * Phase 9 Placeholder:
 * - Load image from Cloud Storage
 * - Call Gemini Vision API for classification
 * - Parse response for immunology markers
 * - Store results + confidence scores
 * - Return classification results
 *
 * Production (Phase 9):
 * - Initialize Gemini Vision client
 * - Call vision.generateContent() with image + prompt
 * - Parse model response for [IgG, IgM, IgA, ...] markers
 * - Store in /labs/{labId}/imuno-ias-dev/images/{docId}
 * - Support feedback loop for model retraining
 *
 * @param request Classification request with image ID
 * @returns Detected classes, confidence, model version
 */
export const classifyStrip = functions.onCall(
  async (request): Promise<StripClassificationResponse> => {
    // Phase 9: Call Gemini Vision API for strip classification
    if (!request.data?.imageUrl) {
      return {
        status: 'ERROR',
        message: 'Missing imageUrl',
        classes: [],
        confidence: 0
      };
    }

    if (!request.data?.labId) {
      return {
        status: 'ERROR',
        message: 'Missing labId',
        classes: [],
        confidence: 0
      };
    }

    // Placeholder response - will be replaced in Phase 9
    return {
      status: 'PLACEHOLDER',
      classes: ['IgG', 'IgM'],
      confidence: 0.95,
      message: 'Strip image classification (Phase 9)'
    };
  }
);

/**
 * Get Classification Results
 * Phase 9+: Retrieve stored classification for an image
 */
export const getClassificationResult = functions.onCall(
  async (request): Promise<any> => {
    // Phase 9: Implement result retrieval
    return {
      status: 'PLACEHOLDER',
      message: 'Get classification result (Phase 9)'
    };
  }
);

/**
 * Submit Classification Feedback
 * Phase 9+: Human-in-the-loop retraining
 */
export const submitClassificationFeedback = functions.onCall(
  async (request): Promise<any> => {
    // Phase 9: Implement feedback collection
    return {
      status: 'PLACEHOLDER',
      message: 'Submit classification feedback (Phase 9)'
    };
  }
);

/**
 * Batch Classify Strip Images
 * Phase 9+: Background job for bulk classification
 */
export const batchClassifyStrips = onSchedule(
  {
    schedule: 'every 30 minutes',
    region: 'southamerica-east1',
    timeoutSeconds: 300
  },
  async () => {
    // Phase 9: Implement batch classification
    // Returns void (Cloud Scheduler doesn't use return value)
  }
);

/**
 * Train IA Model
 * Phase 10+: Model retraining based on feedback
 */
export const trainStripClassifier = functions.onRequest(
  async (req: any, res: any) => {
    // Phase 10: Implement model training
    res.json({
      status: 'PLACEHOLDER',
      message: 'Train strip classifier (Phase 10)'
    });
  }
);
