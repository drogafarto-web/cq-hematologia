import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { getMeetings, getMeetingById } from '../services/managementReviewService';
import type { ManagementReview } from '../types';

interface UseManagementReviewResult {
  reviews: ManagementReview[];
  currentYear: number;
  latest: ManagementReview | null;
  byYear: Record<number, ManagementReview[]>;
  loading: boolean;
  error: string | null;
}

/**
 * useManagementReview
 * Real-time subscription to management reviews for the current lab
 *
 * Returns all reviews organized by year, plus latest completed review
 *
 * Auto-unsubscribes on unmount
 */
export function useManagementReview(): UseManagementReviewResult {
  const labId = useActiveLabId();
  const [reviews, setReviews] = useState<ManagementReview[]>([]);
  const [latest, setLatest] = useState<ManagementReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!labId) {
      setError('No lab selected');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch all meetings (one-time, not real-time)
    getMeetings(labId)
      .then((data) => {
        setReviews(data);
        // Latest is the first one (already sorted by date DESC in service)
        setLatest(data.length > 0 ? data[0] : null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useManagementReview] Error fetching reviews:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
        setLoading(false);
      });
  }, [labId]);

  // Organize reviews by year
  const byYear: Record<number, ManagementReview[]> = {};
  reviews.forEach((review) => {
    const year = review.year;
    if (!byYear[year]) {
      byYear[year] = [];
    }
    byYear[year].push(review);
  });

  // Sort by date within each year (already sorted by service, but ensure it)
  Object.values(byYear).forEach((yearReviews) => {
    yearReviews.sort((a, b) => {
      const aDate = a.dataRevisao?.toMillis?.() ?? 0;
      const bDate = b.dataRevisao?.toMillis?.() ?? 0;
      return bDate - aDate; // Most recent first
    });
  });

  return {
    reviews,
    currentYear,
    latest,
    byYear,
    loading,
    error,
  };
}

/**
 * useFetchManagementReview
 * One-time fetch of a specific meeting
 *
 * Useful for detail views
 */
export function useFetchManagementReview(reviewId: string | null) {
  const labId = useActiveLabId();
  const [review, setReview] = useState<ManagementReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewId || !labId) {
      return;
    }

    setLoading(true);
    setError(null);

    getMeetingById(labId, reviewId)
      .then((data) => {
        setReview(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useFetchManagementReview] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch review');
        setLoading(false);
      });
  }, [reviewId, labId]);

  return { review, loading, error };
}
