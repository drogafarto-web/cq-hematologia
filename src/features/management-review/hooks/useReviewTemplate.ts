import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { generateReviewTemplate } from '../services/reviewTemplateService';
import { ReviewTemplate, createEmptyReviewTemplate } from '../types';

interface UseReviewTemplateResult {
  template: ReviewTemplate;
  loading: boolean;
  error: string | null;
  ready: boolean;
}

/**
 * useReviewTemplate
 * Async hook that fetches and caches pre-populated review template
 *
 * Pulls live data from 7 collections (audits, NC/CAPA, KPIs, feedback, personnel, infrastructure, suppliers)
 * Caches result to avoid re-fetching on re-render
 *
 * If a data source is unavailable, returns empty but continues with warnings
 */
export function useReviewTemplate(year: number): UseReviewTemplateResult {
  const labId = useActiveLabId();
  const [template, setTemplate] = useState<ReviewTemplate>(createEmptyReviewTemplate(year));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cachedYear, setCachedYear] = useState<number | null>(null);

  useEffect(() => {
    if (!labId) {
      setError('No lab selected');
      return;
    }

    // Skip if already loaded for this year
    if (cachedYear === year) {
      setReady(true);
      return;
    }

    setLoading(true);
    setError(null);
    setReady(false);

    generateReviewTemplate(labId, year)
      .then((data) => {
        setTemplate(data);
        setCachedYear(year);
        setReady(true);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useReviewTemplate] Error generating template:', err);
        // Don't fail completely, just show warnings
        setError(err.message || 'Could not load template data');
        setTemplate(createEmptyReviewTemplate(year));
        setCachedYear(year);
        setReady(true); // Still mark as ready, but with empty template
        setLoading(false);
      });
  }, [labId, year, cachedYear]);

  return {
    template,
    loading,
    error,
    ready
  };
}
