import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  watchManagementReviews,
  getManagementReview,
  getLatestManagementReview
} from '../services/managementReviewService';
import { ManagementReview, ReviewStatus } from '../types';

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

    // Subscribe to real-time reviews
    const unsubscribe = watchManagementReviews(labId, async (data) => {
      setReviews(data);
      setLoading(false);

      // Fetch latest completed review
      try {
        const latestReview = await getLatestManagementReview(labId);
        setLatest(latestReview);
      } catch (err) {
        console.warn('[useManagementReview] Could not fetch latest review:', err);
      }
    });

    // Cleanup: unsubscribe on unmount
    return () => {
      unsubscribe();
    };
  }, [labId]);

  // Organize reviews by year
  const byYear: Record<number, ManagementReview[]> = {};
  reviews.forEach((review) => {
    if (!byYear[review.year]) {
      byYear[review.year] = [];
    }
    byYear[review.year].push(review);
  });

  // Sort by date within each year
  Object.values(byYear).forEach((yearReviews) => {
    yearReviews.sort((a, b) => {
      const aDate = a.dataRevisao?.toDate?.().getTime() || 0;
      const bDate = b.dataRevisao?.toDate?.().getTime() || 0;
      return bDate - aDate; // Most recent first
    });
  });

  return {
    reviews,
    currentYear,
    latest,
    byYear,
    loading,
    error
  };
}

/**
 * useFetchManagementReview
 * One-time fetch of a specific review
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

    getManagementReview(labId, reviewId)
      .then((data) => {
        setReview(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useFetchManagementReview] Error:', err);
        setError(err.message || 'Failed to fetch review');
        setLoading(false);
      });
  }, [reviewId, labId]);

  return { review, loading, error };
}
