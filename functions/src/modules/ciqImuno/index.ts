/**
 * modules/ciqImuno/index.ts
 * Phase 5 Tasks 05-03 & 05-04: Immunology CIQ IA Strip Classification + Dataset Aggregation
 *
 * Exports:
 * - classifyStripGemini: Classify rapid test strips via Gemini Vision API (Task 05-03)
 * - recordManualOverride: Log RT manual override in audit trail (Task 05-03)
 * - flagForManualReview: Send notification for low-confidence results (Task 05-03)
 * - calculateAccuracy: Calculate accuracy metrics from verified images (Task 05-04)
 * - collectIADataset: Export monthly dataset for ML team (Task 05-04)
 * - handleMLTeamFeedback: Receive fine-tuning feedback from ML team (Task 05-04, placeholder)
 */

export {
  classifyStripGemini,
  type Classification,
  type TestType,
  type RecommendedAction,
} from './classifyStripGemini';

export {
  recordManualOverride,
  flagForManualReview,
} from './confidenceValidation';

export {
  calculateAccuracy,
  type AccuracyMetrics,
  type VerifiedImage,
  type Classification as AccuracyClassification,
  type TestKit,
} from './accuracyCalculator';

export {
  collectIADataset,
} from './collectIADataset';

export {
  handleMLTeamFeedback,
} from './handleMLTeamFeedback';
