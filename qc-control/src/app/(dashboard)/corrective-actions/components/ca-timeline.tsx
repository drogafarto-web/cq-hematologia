'use client';

import { cn } from '@/lib/utils';

export interface TimelineEntry {
  type: 'created' | 'status_change' | 'update';
  description: string;
  timestamp: string;
}

interface CATimelineProps {
  entries: TimelineEntry[];
}

const dotColors: Record<string, string> = {
  created: 'bg-primary',
  status_change: 'bg-warning',
  update: 'bg-on-surface-variant',
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CATimeline({ entries }: CATimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-on-surface-variant py-8 text-sm">
        No timeline entries available.
      </div>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <div className="flex flex-col gap-0">
      {sorted.map((entry, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn('w-3 h-3 rounded-full mt-1 shrink-0', dotColors[entry.type])} />
            {i < sorted.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
          </div>
          <div className="pb-6">
            <p className="text-sm text-on-surface">{entry.description}</p>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              {formatTimestamp(entry.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
