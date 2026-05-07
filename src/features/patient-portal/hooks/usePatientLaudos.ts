import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  listenToPatientLaudos,
  getPatientLaudosInDateRange,
  countPatientLaudos,
} from '../services/patientLaudoService';
import type { PatientPortalLaudo, LaudoFilterState } from '../types/index';

interface UsePatientLaudosReturn {
  laudos: PatientPortalLaudo[];
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
  refetch: () => void;
  applyDateFilter: (range: '30d' | '60d' | '90d' | 'custom', start?: Date, end?: Date) => void;
}

/**
 * Hook: Real-time listener for patient's laudos
 *
 * Fetches via onSnapshot (real-time), handles loading + error states
 * Client-side filtering by date range
 *
 * Usage:
 *   const { laudos, isLoading, error, refetch } = usePatientLaudos(labId, patientId);
 */
export function usePatientLaudos(
  labId: string | null,
  patientId: string | null
): UsePatientLaudosReturn {
  const [laudos, setLaudos] = useState<PatientPortalLaudo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [dateFilter, setDateFilter] = useState<{
    startDate?: Timestamp;
    endDate?: Timestamp;
  }>({});

  // Fetch total count on mount
  useEffect(() => {
    if (!labId || !patientId) return;

    (async () => {
      try {
        const count = await countPatientLaudos(labId, patientId);
        setTotalCount(count);
      } catch (err) {
        console.error('[usePatientLaudos] count error:', err);
      }
    })();
  }, [labId, patientId]);

  // Real-time listener
  useEffect(() => {
    if (!labId || !patientId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = listenToPatientLaudos(
      labId,
      patientId,
      (data) => {
        // Apply date filter if set
        let filtered = data;
        if (dateFilter.startDate && dateFilter.endDate) {
          filtered = data.filter(
            (l) =>
              l.dataEmissao >= dateFilter.startDate! &&
              l.dataEmissao <= dateFilter.endDate!
          );
        }
        setLaudos(filtered);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [labId, patientId, dateFilter]);

  const refetch = () => {
    setIsLoading(true);
  };

  const applyDateFilter = async (
    range: '30d' | '60d' | '90d' | 'custom',
    customStart?: Date,
    customEnd?: Date
  ) => {
    if (!labId || !patientId) return;

    const now = new Date();
    let startDate: Date;

    if (range === 'custom' && customStart && customEnd) {
      startDate = customStart;
    } else {
      const days = range === '30d' ? 30 : range === '60d' ? 60 : 90;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const endDate = customEnd || now;

    try {
      setIsLoading(true);
      const filtered = await getPatientLaudosInDateRange(
        labId,
        patientId,
        Timestamp.fromDate(startDate),
        Timestamp.fromDate(endDate),
        50
      );
      setLaudos(filtered);
      setDateFilter({
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
      });
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    laudos,
    isLoading,
    error,
    totalCount,
    refetch,
    applyDateFilter,
  };
}
