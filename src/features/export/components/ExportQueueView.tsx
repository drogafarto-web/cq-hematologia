/**
 * ExportQueueView — List of past and pending export jobs with real-time status.
 * Columns: Format | Date Range | Submitted | Status | Size | Action
 * Status badges use JOB_STATUS_META for consistent styling.
 * Real-time via useExportJob per-row subscriptions.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { ExportJob } from '../types';
import { JOB_STATUS_META, FORMAT_LABELS } from '../services/jobStatusCodes';
import { formatFileSize } from '../hooks/useExportJobs';
import { DownloadButton } from './DownloadButton';

interface ExportQueueViewProps {
  labId: string;
  /** Max jobs to show (default: 20) */
  maxItems?: number;
}

function coerceJob(data: DocumentData): ExportJob {
  return {
    ...(data as ExportJob),
    createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt),
    startDate: data.startDate?.toDate?.() ?? new Date(data.startDate),
    endDate: data.endDate?.toDate?.() ?? new Date(data.endDate),
    expiresAt: data.expiresAt
      ? data.expiresAt?.toDate?.() ?? new Date(data.expiresAt)
      : undefined,
    generatedAt: data.generatedAt
      ? data.generatedAt?.toDate?.() ?? new Date(data.generatedAt)
      : undefined,
    startedAt: data.startedAt
      ? data.startedAt?.toDate?.() ?? new Date(data.startedAt)
      : undefined,
    completedAt: data.completedAt
      ? data.completedAt?.toDate?.() ?? new Date(data.completedAt)
      : undefined,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatSubmittedAt(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExportQueueView({
  labId,
  maxItems = 20,
}: ExportQueueViewProps) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'labs', labId, 'export-jobs'),
      orderBy('createdAt', 'desc'),
      limit(maxItems),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        const list = snap.docs.map((d) => coerceJob(d.data()));
        setJobs(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('[ExportQueueView] onSnapshot error:', err);
        setError(err.message || 'Falha ao carregar exportações');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId, maxItems]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl bg-white/[0.04] animate-pulse ring-1 ring-white/[0.06]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center gap-2.5 rounded-xl bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20"
        role="alert"
      >
        <svg
          className="h-4 w-4 shrink-0 text-red-400"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 1.999-.29 4.499-2.599 4.499H4.645c-2.309 0-3.752-2.5-2.598-4.499L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        {/* Empty state icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-white/10">
          <svg
            className="h-6 w-6 text-white/25"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-white/40">Nenhuma exportação</p>
          <p className="mt-0.5 text-xs text-white/25">
            Exportações geradas aparecerão aqui
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
      {/* Desktop table */}
      <div className="hidden sm:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.03]">
              {['Formato', 'Período', 'Enviado em', 'Status', 'Tamanho', 'Ação'].map(
                (col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-white/30"
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {jobs.map((job) => (
              <JobRow key={job.jobId} job={job} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-white/[0.06]">
        {jobs.map((job) => (
          <MobileJobCard key={job.jobId} job={job} />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ExportJob['status'] }) {
  const meta = JOB_STATUS_META[status];
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
        meta.bgClass,
        meta.textClass,
        meta.ringClass,
        meta.animate ? 'animate-pulse' : '',
      ].join(' ')}
    >
      {meta.label}
    </span>
  );
}

function JobRow({ job }: { job: ExportJob }) {
  return (
    <tr className="group hover:bg-white/[0.02] transition-colors duration-100">
      <td className="px-4 py-3.5 text-sm font-medium text-white/80">
        {FORMAT_LABELS[job.format] ?? job.format.toUpperCase()}
      </td>
      <td className="px-4 py-3.5 text-xs text-white/50 tabular-nums">
        {formatDate(job.startDate)} — {formatDate(job.endDate)}
      </td>
      <td className="px-4 py-3.5 text-xs text-white/40 tabular-nums">
        {formatSubmittedAt(job.createdAt)}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3.5 text-xs text-white/40 tabular-nums">
        {job.fileSizeBytes ? formatFileSize(job.fileSizeBytes) : '—'}
      </td>
      <td className="px-4 py-3.5">
        {job.status === 'completed' ? (
          <DownloadButton job={job} />
        ) : job.status === 'failed' ? (
          <span className="text-xs text-red-400/70" title={job.errorMessage}>
            {job.errorMessage ? 'Ver erro' : 'Falhou'}
          </span>
        ) : (
          <span className="text-xs text-white/20">—</span>
        )}
      </td>
    </tr>
  );
}

function MobileJobCard({ job }: { job: ExportJob }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white/80">
            {FORMAT_LABELS[job.format] ?? job.format.toUpperCase()}
          </span>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-xs text-white/40 tabular-nums">
          {formatDate(job.startDate)} — {formatDate(job.endDate)}
        </p>
        <p className="text-xs text-white/25 tabular-nums mt-0.5">
          {formatSubmittedAt(job.createdAt)}
        </p>
      </div>
      <div className="shrink-0">
        {job.status === 'completed' ? (
          <DownloadButton job={job} />
        ) : null}
      </div>
    </div>
  );
}
