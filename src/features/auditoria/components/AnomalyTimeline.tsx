/**
 * SA-14: AnomalyTimeline — CSS-grid heatmap, no chart deps
 *
 * Renders a heatmap grid visualization of anomalies over time.
 * X-axis = time bucket (day/week), Y-axis = severity.
 * Cell color intensity scales with alert count.
 *
 * Pure CSS grid, no external chart libraries.
 */

import React, { useMemo } from 'react';
import type { JSX } from 'react';
import { useAnomalyAlerts, type AlertSeverity } from '../hooks/useAnomalyAlerts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnomalyTimelineProps {
  labId: string;
  from: number; // ms epoch
  to: number; // ms epoch
  granularity?: 'day' | 'week';
}

// ─── Intensity scale ────────────────────────────────────────────────────────────

const INTENSITY_COLORS: Record<AlertSeverity, string[]> = {
  low: ['bg-blue-500/5', 'bg-blue-500/15', 'bg-blue-500/30', 'bg-blue-500/45', 'bg-blue-500/60'],
  medium: [
    'bg-amber-500/5',
    'bg-amber-500/15',
    'bg-amber-500/30',
    'bg-amber-500/45',
    'bg-amber-500/60',
  ],
  high: [
    'bg-orange-500/5',
    'bg-orange-500/15',
    'bg-orange-500/30',
    'bg-orange-500/45',
    'bg-orange-500/60',
  ],
  critical: [
    'bg-rose-500/20',
    'bg-rose-500/35',
    'bg-rose-500/50',
    'bg-rose-500/65',
    'bg-rose-500/80',
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnomalyTimeline({
  labId,
  from,
  to,
  granularity = 'day',
}: AnomalyTimelineProps): JSX.Element {
  const { alerts } = useAnomalyAlerts(labId, { from, to });

  // Group alerts by bucket and severity
  const data = useMemo(() => {
    const buckets = new Map<string, Map<AlertSeverity, number>>();

    // Generate time buckets
    const bucketSize = granularity === 'day' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    let current = Math.floor(from / bucketSize) * bucketSize;
    while (current <= to) {
      const bucketKey = new Date(current).toISOString().split('T')[0];
      buckets.set(
        bucketKey,
        new Map([
          ['low', 0],
          ['medium', 0],
          ['high', 0],
          ['critical', 0],
        ]),
      );
      current += bucketSize;
    }

    // Count alerts per bucket/severity
    alerts.forEach((alert) => {
      const bucketKey = new Date(alert.detectedAt).toISOString().split('T')[0];

      if (buckets.has(bucketKey)) {
        const severityMap = buckets.get(bucketKey)!;
        severityMap.set(alert.severity, (severityMap.get(alert.severity) ?? 0) + 1);
      }
    });

    // Sort buckets by date
    const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));

    return sorted;
  }, [alerts, from, to, granularity]);

  const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low'];

  if (from > to || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg bg-white/5 border border-white/10">
        <p className="text-sm text-white/60">Sem anomalias no período</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Legend */}
      <div className="flex gap-6 text-xs">
        <div>
          <p className="text-white/60 mb-2">Intensidade (contagem):</p>
          <div className="flex gap-2">
            {[
              { label: 'Vazio', color: 'bg-white/5' },
              { label: '1', color: 'bg-rose-500/20' },
              { label: '2-3', color: 'bg-rose-500/40' },
              { label: '4-7', color: 'bg-rose-500/60' },
              { label: '8+', color: 'bg-rose-500/80' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded ${item.color}`} />
                <span className="text-white/50">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Y-axis (Severity) */}
          <div className="flex gap-0.5">
            {/* Y-axis labels */}
            <div className="w-20 flex-shrink-0 flex flex-col gap-0.5">
              <div className="h-8" /> {/* align with header */}
              {severities.map((severity) => (
                <div
                  key={severity}
                  className="h-8 flex items-center px-2 text-xs text-white/60 font-medium"
                >
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="flex-1">
              {/* Header row (dates) */}
              <div className="flex gap-0.5 pb-2 border-b border-white/10 mb-2">
                {data.map(([bucketKey]) => (
                  <div
                    key={bucketKey}
                    className="flex-1 min-w-12 h-8 flex items-center justify-center text-xs text-white/50 truncate"
                    title={bucketKey}
                  >
                    {new Date(bucketKey).getDate()}
                  </div>
                ))}
              </div>

              {/* Severity rows */}
              {severities.map((severity) => (
                <div key={severity} className="flex gap-0.5 mb-0.5">
                  {data.map(([bucketKey, severityMap]) => {
                    const count = severityMap.get(severity) ?? 0;

                    // Determine intensity level (0-4)
                    let intensity = 0;
                    if (count >= 8) intensity = 4;
                    else if (count >= 4) intensity = 3;
                    else if (count >= 2) intensity = 2;
                    else if (count >= 1) intensity = 1;

                    const colorClass =
                      intensity === 0 ? 'bg-white/5' : INTENSITY_COLORS[severity][intensity];

                    return (
                      <div
                        key={`${bucketKey}-${severity}`}
                        className={`flex-1 min-w-12 h-8 rounded ${colorClass} border border-white/5 hover:border-white/20 transition-colors cursor-default`}
                        title={`${bucketKey} — ${count} alertas ${severity}`}
                        aria-label={`${bucketKey} — ${count} alertas ${severity}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
