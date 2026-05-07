/**
 * IA Strip Image Module Types
 * Phase 9 implementation pending
 */

import type { StripFeedback } from '../../shared/ia';

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
