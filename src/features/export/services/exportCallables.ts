/**
 * Typed callable function references for the Export feature.
 * Wraps Firebase httpsCallable with proper generics so all callers share one source of truth.
 */

import { httpsCallable, type HttpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import type { ExportRequest, ExportInitiateResponse } from '../types';

/**
 * Callable: initiateExport
 * Creates a Firestore export-job document and publishes to Pub/Sub for async processing.
 */
export const initiateExportCallable: HttpsCallable<ExportRequest, ExportInitiateResponse> =
  httpsCallable(functions, 'initiateExport');
