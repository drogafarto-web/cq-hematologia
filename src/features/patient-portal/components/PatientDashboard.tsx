/**
 * PatientDashboard
 * Main portal view — shows patient's laudos (read-only)
 * WCAG AA, dark-first, responsive (mobile 375px tested)
 */

import React, { useState, useEffect } from 'react';
import { usePatientSession, usePatientAuthStore } from '../hooks/usePatientAuthStore';
import { PatientSessionIndicator } from './PatientSessionIndicator';
import type { PatientLaudo } from '../types';

interface PatientDashboardProps {
  labName?: string;
  patientName?: string;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  labName = 'Laboratory',
  patientName = 'Patient',
}) => {
  const session = usePatientSession();
  const { clearSession } = usePatientAuthStore();
  const [laudos, setLaudos] = useState<PatientLaudo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLgpdModal, setShowLgpdModal] = useState(false);

  useEffect(() => {
    setLaudos([
      {
        id: '1',
        laudoId: 'LAUDO-001',
        patientId: session?.patientId || '',
        labId: session?.labId || '',
        exameName: 'Complete Blood Count',
        examDate: new Date('2026-05-01'),
        releaseDate: new Date('2026-05-02'),
        status: 'ready',
        versionId: 'v1',
        signatureHash: 'abc123def456',
        expiresAt: new Date('2026-07-31'),
      },
    ]);
    setIsLoading(false);
  }, [session]);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/portal/auth';
  };

  const handleDownloadPDF = (laudo: PatientLaudo) => {
    console.log('Download PDF:', laudo.id);
  };

  const getStatusBadge = (status: PatientLaudo['status']) => {
    const styles = {
      ready: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
      pending: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
      blocked: 'bg-red-500/20 text-red-200 border-red-500/30',
    };
    const labels = {
      ready: 'Ready',
      pending: 'Pending',
      blocked: 'Blocked',
    };
    return (
      <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full border $[styles[status]]`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f]">
      <header className="bg-white/5 border-b border-white/10 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{labName}</h1>
            <p className="text-sm text-white/50 mt-1">
              Logged in as <span className="text-white/70 font-medium">{patientName}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1 text-sm text-blue-200">
            <p>
              Results are protected under LGPD.{' '}
              <button
                onClick={() => setShowLgpdModal(true)}
                className="ml-2 underline hover:text-blue-100"
              >
                Learn more
              </button>
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <svg
              className="w-8 h-8 mx-auto animate-spin text-white/30"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.25"
              />
              <path
                d="M22 12a10 10 0 00-10-10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : laudos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/50">No results available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {laudos.map((laudo) => (
              <div key={laudo.id} className="p-6 bg-white/5 border border-white/10 rounded-lg hover:border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">{laudo.exameName}</h3>
                <div className="space-y-2 text-sm text-white/60 mb-4">
                  <div className="flex justify-between">
                    <span>Exam Date:</span>
                    <span className="text-white/80">{formatDate(laudo.examDate)}</span>
                  </div>
                </div>
                <div className="mb-4">{getStatusBadge(laudo.status)}</div>
                {laudo.status === 'ready' && (
                  <button
                    onClick={() => handleDownloadPDF(laudo)}
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
                  >
                    Download PDF
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showLgpdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1f] border border-white/10 rounded-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">LGPD Privacy Rights</h2>
            <div className="space-y-2 text-sm text-white/70">
              <p>Results are protected under Brazilian data protection law (LGPD).</p>
            </div>
            <button
              onClick={() => setShowLgpdModal(false)}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      <PatientSessionIndicator />
    </div>
  );
};
