/**
 * Web Vitals Measurement Library
 *
 * Measures Core Web Vitals (LCP, INP, CLS) and sends to Firebase Analytics.
 * Used for production monitoring and performance optimization tracking.
 *
 * References:
 * - https://web.dev/articles/vitals
 * - https://github.com/GoogleChrome/web-vitals
 */

import { getPerformance } from 'firebase/performance';

export interface WebVitalsMetric {
  name: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

export interface PerformanceThresholds {
  LCP: { good: number; poor: number };
  INP: { good: number; poor: number };
  CLS: { good: number; poor: number };
  TTFB: { good: number; poor: number };
  FCP: { good: number; poor: number };
}

// Web Vitals thresholds (https://web.dev/articles/vitals)
export const VITALS_THRESHOLDS: PerformanceThresholds = {
  LCP: { good: 2500, poor: 4000 }, // ms
  INP: { good: 200, poor: 500 }, // ms
  CLS: { good: 0.1, poor: 0.25 }, // unitless
  TTFB: { good: 800, poor: 1800 }, // ms
  FCP: { good: 1800, poor: 3000 }, // ms
};

/**
 * Determines rating based on metric value and thresholds
 */
function getRating(
  metric: WebVitalsMetric['name'],
  value: number,
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = VITALS_THRESHOLDS[metric];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Generates unique metric ID for deduplication
 */
function generateMetricId(metric: WebVitalsMetric['name']): string {
  return `${metric}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Measures Largest Contentful Paint (LCP)
 * Measures when the largest visible content element is painted.
 */
export function measureLCP(callback: (metric: WebVitalsMetric) => void): void {
  let lastEntryTime = 0;
  let previousValue = 0;

  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1] as any;
    const value = lastEntry.renderTime || lastEntry.loadTime;

    if (value < lastEntryTime) return; // Ignore out-of-order entries

    lastEntryTime = value;
    const delta = value - previousValue;
    previousValue = value;

    if (delta <= 0) return; // Only report when LCP increases

    const metric: WebVitalsMetric = {
      name: 'LCP',
      value: Math.round(value),
      rating: getRating('LCP', value),
      delta: Math.round(delta),
      id: generateMetricId('LCP'),
      navigationType: (performance as any).navigation?.type || 'navigate',
    };

    callback(metric);
  });

  try {
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    console.warn('LCP observer not supported', e);
  }
}

/**
 * Measures Interaction to Next Paint (INP)
 * Measures the longest interaction latency in the page lifecycle.
 */
export function measureINP(callback: (metric: WebVitalsMetric) => void): void {
  let maxDuration = 0;
  let maxDurationEntry: PerformanceEntry | null = null;

  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();

    for (const entry of entries) {
      const duration = (entry as any).duration;

      if (duration > maxDuration) {
        maxDuration = duration;
        maxDurationEntry = entry;

        const metric: WebVitalsMetric = {
          name: 'INP',
          value: Math.round(maxDuration),
          rating: getRating('INP', maxDuration),
          delta: Math.round(maxDuration),
          id: generateMetricId('INP'),
          navigationType: (performance as any).navigation?.type || 'navigate',
        };

        callback(metric);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['interaction'] });
  } catch (e) {
    console.warn('INP observer not supported', e);
  }
}

/**
 * Measures Cumulative Layout Shift (CLS)
 * Measures unexpected layout shifts during page lifecycle.
 */
export function measureCLS(callback: (metric: WebVitalsMetric) => void): void {
  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];

  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();

    for (const entry of entries) {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
        clsEntries.push(entry);

        const metric: WebVitalsMetric = {
          name: 'CLS',
          value: Math.round(clsValue * 1000) / 1000,
          rating: getRating('CLS', clsValue),
          delta: Math.round((entry as any).value * 1000) / 1000,
          id: generateMetricId('CLS'),
          navigationType: (performance as any).navigation?.type || 'navigate',
        };

        callback(metric);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    console.warn('CLS observer not supported', e);
  }
}

/**
 * Measures First Contentful Paint (FCP)
 * Marks the time when the first content is painted on screen.
 */
export function measureFCP(callback: (metric: WebVitalsMetric) => void): void {
  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];

    const metric: WebVitalsMetric = {
      name: 'FCP',
      value: Math.round(lastEntry.startTime),
      rating: getRating('FCP', lastEntry.startTime),
      delta: Math.round(lastEntry.startTime),
      id: generateMetricId('FCP'),
      navigationType: (performance as any).navigation?.type || 'navigate',
    };

    callback(metric);
  });

  try {
    observer.observe({ entryTypes: ['paint'] });
  } catch (e) {
    console.warn('FCP observer not supported', e);
  }
}

/**
 * Measures Time to First Byte (TTFB)
 * Measures time from request start to first byte response.
 */
export function measureTTFB(callback: (metric: WebVitalsMetric) => void): void {
  // Only available on pages served with Navigation Timing API
  if (!window.performance || !performance.timing) return;

  // Use PerformanceNavigationTiming if available (Resource Timing API)
  const navTiming = performance.getEntriesByType('navigation')[0] as any;

  if (navTiming) {
    const ttfb = navTiming.responseStart - navTiming.requestStart;

    const metric: WebVitalsMetric = {
      name: 'TTFB',
      value: Math.round(ttfb),
      rating: getRating('TTFB', ttfb),
      delta: Math.round(ttfb),
      id: generateMetricId('TTFB'),
      navigationType: navTiming.type || 'navigate',
    };

    callback(metric);
  }
}

/**
 * Initializes all Web Vitals measurements
 * Automatically reports to Firebase Performance Monitoring if available
 */
export function initWebVitals(onMetric?: (metric: WebVitalsMetric) => void): void {
  const handleMetric = (metric: WebVitalsMetric) => {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[Web Vitals] ${metric.name}: ${metric.value}ms (${metric.rating})`);
    }

    // Send to Firebase Performance Monitoring if available
    try {
      const perf = getPerformance();
      if (perf) {
        const customMetric = (perf as any).trace(`web-vital-${metric.name}`);
        customMetric.putMetric('value', metric.value);
        customMetric.putAttribute('rating', metric.rating);
        customMetric.putAttribute('id', metric.id);
      }
    } catch (e) {
      // Firebase Performance not initialized or not available
    }

    // Call custom callback if provided
    if (onMetric) {
      onMetric(metric);
    }

    // Send to analytics endpoint for long-term tracking
    if (navigator.sendBeacon) {
      const data = JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });

      navigator.sendBeacon('/api/metrics', data);
    }
  };

  // Initialize all vital measurements
  measureLCP(handleMetric);
  measureINP(handleMetric);
  measureCLS(handleMetric);
  measureFCP(handleMetric);
  measureTTFB(handleMetric);
}

/**
 * Gets current Web Vitals summary for current page
 * Useful for debugging and manual testing
 */
export function getWebVitalsSummary(): {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
} {
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  const layoutShiftEntries = performance.getEntriesByType('layout-shift');
  const interactionEntries = performance.getEntriesByType('interaction');

  const lcp =
    lcpEntries.length > 0
      ? Math.round((lcpEntries[lcpEntries.length - 1] as any).renderTime)
      : null;

  let cls = 0;
  for (const entry of layoutShiftEntries) {
    if (!(entry as any).hadRecentInput) {
      cls += (entry as any).value;
    }
  }

  let inp = 0;
  for (const entry of interactionEntries) {
    inp = Math.max(inp, (entry as any).duration);
  }

  return {
    lcp,
    inp: inp > 0 ? Math.round(inp) : null,
    cls: cls > 0 ? Math.round(cls * 1000) / 1000 : null,
  };
}
