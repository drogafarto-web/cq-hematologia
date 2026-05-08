/**
 * usePatientResults
 * Fetch patient's test results
 * Mock data for Phase 4 scaffold
 */

import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { PatientResult } from '../types';

interface UsePatientResultsReturn {
  results: PatientResult[];
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
}

/**
 * Hook to fetch patient results
 * Phase 4: mock data. Phase 5+: query Firestore
 * @param labId - Lab ID
 * @param patientId - Patient ID
 * @returns Results state
 */
export function usePatientResults(
  labId: string,
  patientId: string
): UsePatientResultsReturn {
  const [results, setResults] = useState<PatientResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !patientId) {
      setIsLoading(false);
      return;
    }

    // Phase 4: Simulate loading with mock data
    const timer = setTimeout(() => {
      const mockResults: PatientResult[] = [
        {
          id: 'result_001',
          labId,
          patientId,
          examName: 'Hemograma Completo',
          examDate: Timestamp.fromDate(new Date('2026-04-28')),
          resultDate: Timestamp.fromDate(new Date('2026-04-29')),
          status: 'ok',
          resultValue: '13.5',
          unit: 'g/dL',
          referenceRange: '13.5-17.5',
          laudoId: 'LAUDO_001',
          versionId: 'v1',
          signatureHash: 'hash_001',
        },
        {
          id: 'result_002',
          labId,
          patientId,
          examName: 'Glicemia de Jejum',
          examDate: Timestamp.fromDate(new Date('2026-04-28')),
          resultDate: Timestamp.fromDate(new Date('2026-04-29')),
          status: 'warning',
          resultValue: '115',
          unit: 'mg/dL',
          referenceRange: '70-100',
          laudoId: 'LAUDO_002',
          versionId: 'v1',
          signatureHash: 'hash_002',
        },
        {
          id: 'result_003',
          labId,
          patientId,
          examName: 'Colesterol Total',
          examDate: Timestamp.fromDate(new Date('2026-04-20')),
          resultDate: Timestamp.fromDate(new Date('2026-04-21')),
          status: 'pending',
          laudoId: 'LAUDO_003',
          versionId: 'v1',
        },
        {
          id: 'result_004',
          labId,
          patientId,
          examName: 'Creatinina',
          examDate: Timestamp.fromDate(new Date('2026-04-10')),
          resultDate: Timestamp.fromDate(new Date('2026-04-11')),
          status: 'ok',
          resultValue: '0.9',
          unit: 'mg/dL',
          referenceRange: '0.7-1.3',
          laudoId: 'LAUDO_004',
          versionId: 'v1',
          signatureHash: 'hash_004',
        },
        {
          id: 'result_005',
          labId,
          patientId,
          examName: 'Uroanálise',
          examDate: Timestamp.fromDate(new Date('2026-04-05')),
          resultDate: Timestamp.fromDate(new Date('2026-04-06')),
          status: 'critical',
          laudoId: 'LAUDO_005',
          versionId: 'v1',
          signatureHash: 'hash_005',
        },
      ];

      setResults(mockResults);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [labId, patientId]);

  return {
    results,
    isLoading,
    error,
    totalCount: results.length,
  };
}
