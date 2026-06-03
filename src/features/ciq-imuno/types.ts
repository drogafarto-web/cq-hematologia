/**
 * types.ts
 * Phase 5 Task 05-03: Frontend types for IA Strip Classification
 */

export type TestType = 'HIV' | 'Dengue' | 'Syphilis' | 'COVID' | 'HCG';
export type Classification = 'Positive' | 'Negative' | 'Invalid' | 'Grey-Zone';
export type RecommendedAction = 'AUTO_SAVE' | 'MANUAL_REVIEW';

/**
 * Image metadata captured during upload
 */
export interface StripImageMetadata {
  runId: string;
  uploadedBy: string;
  filename: string;
  fileSize: number;
  dimensions: {
    width: number;
    height: number;
  };
  deviceInfo: {
    userAgent: string;
    isCamera: boolean;
  };
  lightingCondition?: string;
  testKitBatch?: string;
  imageUrl: string;
  deletadoEm?: Date;
}

/**
 * Gemini classification response
 */
export interface GeminiClassificationResult {
  classification: Classification;
  confidence: number;
  reasoning: string;
}

/**
 * Complete classification result (with confidence validation)
 */
export interface ClassifyStripResult {
  classification: Classification;
  confidence: number;
  reasoning: string;
  geminiLatencyMs: number;
  flaggedForManualReview: boolean;
  threshold: number;
  recommendedAction: RecommendedAction;
  costEstimateUsd: number;
}

/**
 * Manual override payload for RT
 */
export interface ManualOverridePayload {
  labId: string;
  runId: string;
  imageId: string;
  originalClassification: Classification;
  originalConfidence: number;
  manualClassification: Classification;
  reasoning: string;
}

/**
 * Lab-specific IA configuration
 */
export interface IALabConfig {
  labId: string;
  confidenceThreshold: number;
  minImagesBeforeModelUpdate: number;
  dailyCollectionTarget: number;
  maxImagesPerDay: number;
  recordGeolocation: boolean;
  retentionDays: number;
  alertEmail?: string[];
}

/**
 * IA Performance metrics for dashboard
 */
export interface IAPerfMetrics {
  totalImages: number;
  imagesByTestKit: Record<TestType, number>;
  accuracyPct: number;
  accuracyByTestKit: Record<TestType, number>;
  manualOverrideRate: number;
  avgConfidence: number;
  confidenceDistribution: Record<string, number>;
  dailyTrend: Array<{
    date: string;
    accuracy: number;
    count: number;
  }>;
}

/**
 * Confusion matrix for accuracy tracking
 */
export interface ConfusionMatrix {
  testKit: TestType;
  total: number;
  correct: number;
  incorrect: number;
  byClassification: Record<
    Classification,
    {
      count: number;
      correct: number;
    }
  >;
}
