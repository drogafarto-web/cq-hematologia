import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { watchAtas, watchAtasForReview } from '../services/ataService';
import { Ata } from '../types';

interface UseAtasResult {
  atas: Ata[];
  byReview: Record<string, Ata[]>;
  loading: boolean;
  error: string | null;
}

/**
 * useAtas
 * Real-time subscription to all meeting minutes (atas) for the current lab
 *
 * Auto-unsubscribes on unmount
 */
export function useAtas(): UseAtasResult {
  const labId = useActiveLabId();
  const [atas, setAtas] = useState<Ata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setError('No lab selected');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = watchAtas(labId, (data) => {
      setAtas(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [labId]);

  // Organize atas by review
  const byReview: Record<string, Ata[]> = {};
  atas.forEach((ata) => {
    const reviewId = ata.managementReviewId || 'standalone';
    if (!byReview[reviewId]) {
      byReview[reviewId] = [];
    }
    byReview[reviewId].push(ata);
  });

  return {
    atas,
    byReview,
    loading,
    error
  };
}

/**
 * useAtasForReview
 * Real-time subscription to atas linked to a specific management review
 *
 * Useful in review detail/edit views to show related minutes
 */
export function useAtasForReview(managementReviewId: string | null): UseAtasResult {
  const labId = useActiveLabId();
  const [atas, setAtas] = useState<Ata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !managementReviewId) {
      setError(managementReviewId ? 'No lab selected' : 'No review selected');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = watchAtasForReview(labId, managementReviewId, (data) => {
      setAtas(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [labId, managementReviewId]);

  return {
    atas,
    byReview: { [managementReviewId || '']: atas },
    loading,
    error
  };
}
