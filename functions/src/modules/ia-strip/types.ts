/**
 * IA Strip Image Module Types
 * Phase 11: Gemini Vision OCR + RDT Classification
 * Phase 9 legacy types preserved for compatibility
 */

import type { StripFeedback } from '../../shared/ia';
import type { LogicalSignature } from '../../shared/signature';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11: Gemini Vision RDT Classification
// ─────────────────────────────────────────────────────────────────────────────

export type TestType = 'hiv' | 'dengue' | 'syphilis' | 'covid' | 'hcg';
export type Classification = 'R' | 'NR' | 'INCONCLUSIVE';
export type PromptVariant = 'v1' | 'v2' | 'v3';
export type RecommendedAction = 'AUTO_SAVE' | 'MANUAL_REVIEW' | 'OPERATOR_OVERRIDE';

/**
 * Input to classifyStripGemini callable
 */
export interface ClassifyStripPayload {
  base64: string;                              // Image data in base64
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  testType: TestType;                          // hiv | dengue | syphilis | covid | hcg
  labId: string;                               // Multi-tenant lab identifier
  captureId: string;                           // Unique image identifier
  operatorId: string;                          // User who captured image
  patientId: string;                           // Subject of the image — gates LGPD consent check
  promptVariant?: PromptVariant;               // A/B test variant (v1|v2|v3)
}

/**
 * Raw response from Gemini Vision API (parsed JSON)
 */
export interface GeminiClassificationResult {
  classification: Classification;              // R | NR | INCONCLUSIVE
  confidence: number;                          // 0.0–1.0
  reasoning: string;                           // Brief explanation
  geminiModel: string;                         // 'gemini-2.5-flash'
  tokensUsed?: {
    input: number;
    output: number;
  };
}

/**
 * Output from classifyStripGemini callable
 * Includes confidence thresholding + recommended action
 */
export interface ClassifyStripResult {
  classification: Classification;              // R | NR | INCONCLUSIVE
  confidence: number;                          // 0.0–1.0
  reasoning: string;                           // Gemini reasoning
  geminiLatencyMs: number;                     // API call duration
  flaggedForManualReview: boolean;             // confidence < threshold
  threshold: number;                           // Confidence threshold used
  recommendedAction: RecommendedAction;       // AUTO_SAVE | MANUAL_REVIEW
  signature: LogicalSignature;                // {hash, operatorId, ts}
  operatorId: string;                         // Operator ID for audit
}

/**
 * Firestore event log entry (imuno-ia-dev/{labId}/events/{captureId})
 */
export interface IAEventLog {
  captureId: string;
  testType: TestType;
  classification: Classification;
  confidence: number;
  reasoning: string;
  geminiModel: string;
  promptVariant: PromptVariant;
  flaggedForManualReview: boolean;
  rtVerdict?: Classification;                 // RT manual override (if confidence < threshold)
  rtVerdictAt?: any;                          // Timestamp when RT classified
  rtOperatorId?: string;                      // Operator who made override
  rtNotes?: string;                           // Optional RT notes
  signature: LogicalSignature;
  operatorId: string;
  labId: string;
  classifiedAt: any;                          // Timestamp (Firestore)
  agreedWithGemini: boolean;                  // rtVerdict === classification
  geminiLatencyMs: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  createdAt: any;                             // Timestamp
  deletedAt?: any;                            // Soft-delete only
}

/**
 * Lab-specific IA configuration (imuno-ia-dev/{labId}/config)
 */
export interface IALabConfig {
  labId: string;
  confidenceThreshold: number;                // 0.85 default
  minImagesBeforeModelUpdate: number;         // 100
  dailyCollectionTarget: number;              // 50
  maxImagesPerDay: number;                    // 200 (soft limit)
  promptVariantAllocation?: {
    v1?: number;                              // % allocation (0–1)
    v2?: number;
    v3?: number;
  };
  recordGeolocation: boolean;
  retentionDays: number;                      // 365 default
  alertEmail?: string[];
  alertOnAccuracyDrop?: number;               // 0.80
  updatedAt: any;                             // Timestamp
  updatedBy: string;
}

/**
 * Daily cost tracking (imuno-ia-cost/{labId}/daily/{dateKey})
 */
export interface IACostDaily {
  labId: string;
  dateKey: string;                            // YYYY-MM-DD
  callCount: number;
  estimatedCost: number;                      // USD
  tokensUsed?: {
    input: number;
    output: number;
  };
  lastUpdated: any;                           // Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9 Legacy Types (preserved for compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export interface StripUploadRequest {
  imageUrl: string;
  imageBase64?: string;
  imageDim: {
    width: number;
    height: number;
  };
  batch_id?: string;
  labId: string;
  operatorId: string;
}

export interface StripUploadResponse {
  status: string;
  imageId?: string;
  imageUrl?: string;
  message: string;
}

export interface StripClassificationRequest {
  imageId: string;
  imageUrl: string;
  model_version?: string;
  labId: string;
}

export interface ClassificationResult {
  imageId: string;
  classesDetected: string[];
  confidence: number;
  model_version: string;
  classificationTime: number;
  rawScores?: Record<string, number>;
}

export interface StripClassificationResponse {
  status: string;
  classes: string[];
  confidence: number;
  message: string;
  result?: ClassificationResult;
}

export interface StripFeedbackRequest {
  imageId: string;
  classes: string[];
  correctedBy: string;
  labId: string;
}

export interface StripTrainingData {
  id: string;
  imageUrl: string;
  imageDim: {
    width: number;
    height: number;
  };
  groundTruth: string[];
  predictions: string[];
  feedback?: StripFeedback;
  accuracy: number;
  createdAt: number;
  updatedAt: number;
}
