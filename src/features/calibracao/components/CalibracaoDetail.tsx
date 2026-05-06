/**
 * CalibracaoDetail.tsx
 *
 * Detail view modal showing:
 * - Equipment information
 * - Complete certificate history (timeline)
 * - Download links for certificates
 * - Calibration timeline (past → future)
 */

import React, { useMemo } from 'react';
import { getDownloadUrl } from '../services/certificateUploadService';
import type { CalibracaoRecord } from '../types/index';

interface CalibracaoDetailProps {
  record: CalibracaoRecord;
  onClose: () => void;
}

/**
 * Timeline visualization of calibrations past-to-future.
 */
function CalibracaoTimeline({ record }: { record: CalibracaoRecord }) {
  const sortedCerts = useMemo(() => {
    const sorted = [...(record.certificates || [])];
    return sorted.sort(
      (a, b) => b.uploadedAt.toMillis() - a.uploadedAt.toMillis(),
    );
  }, [record.certificates]);

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-500 via-violet-400 to-transparent" />

      {/* Timeline items */}
      <div className="space-y-6 pl-12">
        {sortedCerts.map((cert, idx) => (
          <div key={cert.id} className="relative">
            {/* Timeline dot */}
            <div className="absolute -left-8 top-1.5 h-3 w-3 rounded-full border-2 border-violet-500 bg-slate-900" />

            {/* Certificate card */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-300">
                    {idx === 0 ? 'Mais recente' : `Certificado ${sortedCerts.length - idx}`}
                  </p>
                  <p className="font-mono text-sm text-white">
                    {cert.filename}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {cert.mimeType === 'application/pdf' ? '📄' : '📸'}
                </span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div>
                  <p className="text-gray-500">Upload:</p>
                  <p>
                    {cert.uploadedAt.toDate().toLocaleDateString('pt-BR')} às{' '}
                    {cert.uploadedAt.toDate().toLocaleTimeString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Tamanho:</p>
                  <p>{(cert.fileSize / 1024).toFixed(0)} KB</p>
                </div>
              </div>

              <div className="mb-3 space-y-1 text-xs">
                <div>
                  <p className="text-gray-500">Enviado por:</p>
                  <p className="font-mono text-gray-400">{cert.operatorId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Hash de integridade:</p>
                  <p className="break-all font-mono text-gray-500">{cert.hash}</p>
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={async () => {
                  try {
                    const downloadUrl = await getDownloadUrl(cert);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = cert.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  } catch (err) {
                    console.error('Erro ao fazer download:', err);
                    alert('Erro ao fazer download do certificado');
                  }
                }}
                className="w-full rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
              >
                Download
              </button>
            </div>
          </div>
        ))}

        {/* Next due date marker */}
        <div className="relative">
          <div className="absolute -left-8 top-1.5 h-3 w-3 rounded-full border-2 border-amber-500 bg-slate-900" />

          <div className="rounded-lg border border-amber-900/50 bg-amber-900/20 p-4">
            <p className="text-xs font-semibold text-amber-400">Próxima calibração</p>
            <p className="text-sm text-white">
              {record.dueDateInfo.nextDueDate.toDate().toLocaleDateString('pt-BR')}
            </p>
            <p className="mt-1 text-xs text-amber-400">
              {record.dueDateInfo.daysUntilDue} dias
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalibracaoDetail({
  record,
  onClose,
}: CalibracaoDetailProps) {
  const lastCalibrationDate = record.lastCalibrationDate.toDate().toLocaleDateString('pt-BR');
  const nextDueDate = record.dueDateInfo.nextDueDate.toDate().toLocaleDateString('pt-BR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-lg border border-white/10 bg-slate-900 p-6 shadow-lg">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-300"
          aria-label="Fechar modal"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{record.equipName}</h2>
          {record.equipSerial && (
            <p className="mt-1 text-sm text-gray-400">SN: {record.equipSerial}</p>
          )}
        </div>

        {/* Equipment info grid */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-gray-400">Última calibração</p>
            <p className="mt-1 font-tabular-nums font-semibold text-white">
              {lastCalibrationDate}
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-gray-400">Próxima calibração</p>
            <p className="mt-1 font-tabular-nums font-semibold text-white">
              {nextDueDate}
            </p>
            <p className="mt-2 text-xs text-amber-400">
              {record.dueDateInfo.daysUntilDue} dias restantes
            </p>
          </div>

          {record.vendor && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Fornecedor</p>
              <p className="mt-1 text-sm text-white">{record.vendor}</p>
            </div>
          )}

          {record.vendorRef && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Referência do fornecedor</p>
              <p className="font-mono text-sm text-gray-300">{record.vendorRef}</p>
            </div>
          )}
        </div>

        {/* Notes */}
        {record.notes && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400">Observações</p>
            <p className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
              {record.notes}
            </p>
          </div>
        )}

        {/* Separator */}
        <div className="mb-6 border-t border-white/10" />

        {/* Timeline */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">
            Histórico de calibrações
          </h3>
          {record.certificates && record.certificates.length > 0 ? (
            <CalibracaoTimeline record={record} />
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm text-gray-400">
                Nenhum certificado registrado ainda
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="w-full rounded bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
