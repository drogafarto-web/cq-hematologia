/**
 * usePatientConsent
 * Check patient consent status for AI processing
 * Reads from /consents/{labId}/patients/{patientId}
 */

import { useCallback, useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import type { PatientConsent, ConsentScope } from '../types';

interface UsePatientConsentReturn {
  hasConsent: boolean;
  consent: PatientConsent | null;
  isLoading: boolean;
  error: Error | null;
  consentedScopes: ConsentScope[];
  canRevoke: boolean;
}

/**
 * Hook to listen for patient consent status
 * @param labId - Lab ID
 * @param patientId - Patient ID
 * @returns Consent state
 */
export function usePatientConsent(
  labId: string,
  patientId: string
): UsePatientConsentReturn {
  const [consent, setConsent] = useState<PatientConsent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !patientId) {
      setIsLoading(false);
      return;
    }

    const db = getFirestore();
    const consentRef = doc(db, `consents/${labId}/patients/${patientId}`);

    // Real-time listener for consent doc
    const unsubscribe = onSnapshot(
      consentRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConsent(snapshot.data() as PatientConsent);
        } else {
          setConsent(null);
        }
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [labId, patientId]);

  const hasConsent = useCallback(() => {
    return consent != null && consent.revokedAt === null;
  }, [consent]);

  const consentedScopes = consent?.scope ?? [];
  const canRevoke = hasConsent();

  return {
    hasConsent: hasConsent(),
    consent,
    isLoading,
    error,
    consentedScopes,
    canRevoke,
  };
}

/**
 * Hook to call recordPatientConsent callable
 */
export function useRecordPatientConsent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const recordConsent = useCallback(
    async (labId: string, patientId: string, scopes: ConsentScope[]) => {
      setIsLoading(true);
      setError(null);

      try {
        // This will call a Cloud Function callable
        // For now, mock implementation — actual will call recordPatientConsent
        const response = {
          success: true,
          consentId: `consent_${Date.now()}`,
          consentedAt: new Date().toISOString(),
        };

        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { recordConsent, isLoading, error };
}
