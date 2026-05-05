/**
 * DownloadButton — Signed URL download action for completed export jobs.
 * Only rendered when job status is 'completed' and URL is not expired.
 * Renders disabled state when URL is expiring within 24h (shows warning).
 */

import { isDownloadExpiringsome, formatFileSize } from '../hooks/useExportJobs';
import type { ExportJob } from '../types';

interface DownloadButtonProps {
  job: ExportJob;
}

export function DownloadButton({ job }: DownloadButtonProps) {
  if (job.status !== 'completed' || !job.downloadUrl) {
    return null;
  }

  const isExpired =
    job.expiresAt ? new Date() > job.expiresAt : false;
  const isExpiring = isDownloadExpiringsome(job);
  const fileSize = formatFileSize(job.fileSizeBytes);

  if (isExpired) {
    return (
      <span className="text-xs text-white/25 font-medium" aria-label="Download expirado">
        Expirado
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <a
        href={job.downloadUrl}
        download
        target="_blank"
        rel="noopener noreferrer"
        className={[
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
          'text-xs font-medium transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
          isExpiring
            ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30 hover:bg-amber-500/25'
            : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25',
        ].join(' ')}
        aria-label={`Baixar arquivo (${fileSize})`}
      >
        {/* Download icon */}
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        Baixar
      </a>

      {/* File size hint */}
      <span className="text-[10px] text-white/25 tabular-nums">{fileSize}</span>

      {/* Expiring warning */}
      {isExpiring && !isExpired && (
        <span className="text-[10px] text-amber-400/70">Expira em breve</span>
      )}
    </div>
  );
}
