import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  getMeetings,
  getMeetingById
} from '../services/managementReviewService';
import type { ManagementReviewMeeting } from '../types';

interface UseManagementReviewResult {
  reviews: ManagementReviewMeeting[];
  currentYear: number;
  latest: ManagementReviewMeeting | null;
  byYear: Record<number, ManagementReviewMeeting[]>;
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
  const [reviews, setReviews] = useState<ManagementReviewMeeting[]>([]);
  const [latest, setLatest] = useState<ManagementReviewMeeting | null>(null);
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
  const byYear: Record<number, ManagementReviewMeeting[]> = {};
  reviews.forEach((meeting) => {
    const year = meeting.ano;
    if (!byYear[year]) {
      byYear[year] = [];
    }
    byYear[year].push(meeting);
  });

  // Sort by date within each year (already sorted by service, but ensure it)
  Object.values(byYear).forEach((yearMeetings) => {
    yearMeetings.sort((a, b) => {
      const aDate = typeof a.dataReuniao === 'number'
        ? a.dataReuniao
        : (a.dataReuniao as any)?.toMillis?.() || 0;
      const bDate = typeof b.dataReuniao === 'number'
        ? b.dataReuniao
        : (b.dataReuniao as any)?.toMillis?.() || 0;
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
 * One-time fetch of a specific meeting
 *
 * Useful for detail views
 */
export function useFetchManagementReview(meetingId: string | null) {
  const labId = useActiveLabId();
  const [meeting, setMeeting] = useState<ManagementReviewMeeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId || !labId) {
      return;
    }

    setLoading(true);
    setError(null);

    getMeetingById(labId, meetingId)
      .then((data) => {
        setMeeting(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useFetchManagementReview] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch meeting');
        setLoading(false);
      });
  }, [meetingId, labId]);

  return { meeting, loading, error };
}
