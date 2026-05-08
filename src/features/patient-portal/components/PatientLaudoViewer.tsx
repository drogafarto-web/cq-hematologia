/**
 * PatientLaudoViewer
 * Single laudo detail view — read-only PDF/HTML
 * Accessible, responsive, includes QR code verification
 */

import React, { useState, useEffect } from 'react';
import { usePatientSession } from '../hooks/usePatientAuthStore';
import type { PatientLaudo } from '../types';

interface PatientLaudoViewerProps {
  laudoId?: string;
}

export const PatientLaudoViewer: React.FC<PatientLaudoViewerProps> = ({ laudoId: laudoIdProp }) => {
  const session = usePatientSession();
  const [laudo, setLaudo] = useState<PatientLaudo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const laudoId = laudoIdProp || new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!laudoId || !session) {
      window.location.href = '/portal/dashboard';
      return;
    }

    // TODO: Fetch laudo from Firestore
    const mockLaudo: PatientLaudo = {
      id: laudoId,
      laudoId: 'LAUDO-001',
      patientId: session.patientId,
      labId: session.labId,
      exameName: 'Complete Blood Count',
      examDate: new Date('2026-05-01'),
      releaseDate: new Date('2026-05-02'),
      status: 'ready',
      versionId: 'v1',
      signatureHash: 'abc123def456789abc123def456789abc123def456789abc123def456789abc1',
      materialType: 'Whole Blood',
      analyticMethod: 'Flow Cytometry',
      expiresAt: new Date('2026-07-31'),
    };

    setLaudo(mockLaudo);
    setIsLoading(false);
  }, [laudoId, session]);

  const handleDownloadPDF = async () => {
    if (!laudo) return;
    try {
      // TODO: Implement PDF download via Cloud Function
      console.log('Downloading PDF for laudo:', laudo.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to download PDF');
    }
  };

  const handleVerifyQR = async () => {
    if (!laudo) return;
    try {
      // TODO: Verify QR signature server-side
      console.log('Verifying QR signature for laudo:', laudo.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to verify QR code');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f] flex items-center justify-center">
        <svg
          className="w-8 h-8 animate-spin text-emerald-500"
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
    );
  }

  if (!laudo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-white mb-2">Laudo Not Found</h1>
          <p className="text-white/60 mb-4">This laudo does not exist or you dont have access to it.</p>
          <button
            onClick={() => { window.location.href = '/portal/dashboard'; }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f]">
      <header className="bg-white/5 border-b border-white/10 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => { window.location.href = '/portal/dashboard'; }}
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Back to dashboard"
          >
            Back
          </button>
          <h1 className="text-xl font-semibold text-white">{laudo.exameName}</h1>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
          >
            Download PDF
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-lg p-8 space-y-8">
          <div className="grid grid-cols-2 gap-6 pb-8 border-b border-white/10">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase mb-2">Exam Name</p>
              <p className="text-lg text-white">{laudo.exameName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase mb-2">Exam Date</p>
              <p className="text-lg text-white">{formatDate(laudo.examDate)}</p>
            </div>
            {laudo.releaseDate && (
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase mb-2">Released</p>
                <p className="text-lg text-white">{formatDate(laudo.releaseDate)}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase mb-2">Expires</p>
              <p className="text-lg text-white">{formatDate(laudo.expiresAt)}</p>
            </div>
            {laudo.materialType && (
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase mb-2">Material Type</p>
                <p className="text-lg text-white">{laudo.materialType}</p>
              </div>
            )}
            {laudo.analyticMethod && (
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase mb-2">Method</p>
                <p className="text-lg text-white">{laudo.analyticMethod}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Results</h2>
            <p className="text-white/60">Detailed results would be displayed here (PDF embedded or HTML table)</p>
          </div>

          {laudo.signatureHash && (
            <div className="space-y-4 pt-8 border-t border-white/10">
              <h2 className="text-lg font-semibold text-white">Verification</h2>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-24 h-24 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
                  <span className="text-white/40 text-xs text-center px-2">QR Code</span>
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-white/60">
                    Scan the QR code above to verify the authenticity of this laudo.
                  </p>
                  <button
                    onClick={handleVerifyQR}
                    className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                  >
                    Verify Signature
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-white/40 pt-8 border-t border-white/10">
            <p>This laudo will expire on {formatDate(laudo.expiresAt)}.</p>
            <p>After expiration, this data will be securely deleted under LGPD requirements.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
