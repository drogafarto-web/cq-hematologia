/**
 * PortalAuthLink
 * URL: /portal/auth?token=JWT&lab=labId
 * Validates token, sets session, redirects to dashboard
 * RN-P02: 72h expiry validation
 */

import React, { useEffect, useState } from 'react';
import { verifyPatientAuthToken } from '../services/patientAuthService';
import { usePatientAuthStore } from '../hooks/usePatientAuthStore';
import type { PatientSession } from '../types';

export const PortalAuthLink: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const { setSession, setError } = usePatientAuthStore();

  useEffect(() => {
    const validateAndSetSession = async () => {
      try {
        const token = params.get('token');
        const labId = params.get('lab');

        if (!token || !labId) {
          setStatus('error');
          setErrorMessage('Missing authentication parameters');
          setError('Invalid link');
          return;
        }

        // Verify token on server
        const response = await verifyPatientAuthToken({
          token,
          labId,
        });

        if (!response.valid || !response.patientId) {
          setStatus('error');
          setErrorMessage(response.error || 'Authentication failed');
          setError(response.error || 'Invalid token');
          return;
        }

        // Token is valid, set session
        const expiresAt = new Date(response.expiresAt || Date.now() + 72 * 60 * 60 * 1000);
        const session: PatientSession = {
          token,
          patientId: response.patientId,
          labId,
          email: '', // Not needed for session (already verified)
          expiresAt,
        };

        setSession(session);
        setStatus('success');

        // Redirect to dashboard after brief success state
        setTimeout(() => {
          window.location.href = '/portal/dashboard';
        }, 1500);
      } catch (error: any) {
        setStatus('error');
        const message = error?.message || 'Failed to authenticate';
        setErrorMessage(message);
        setError(message);
      }
    };

    validateAndSetSession();
  }, [setSession, setError]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f] flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <svg
              className="w-12 h-12 mx-auto animate-spin text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="Loading"
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
            <p className="text-white/70">Verifying your authentication link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f] flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-full">
              <svg
                className="w-6 h-6 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">
              Authentication Successful
            </h1>
            <p className="text-white/60 text-sm">
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f] flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/10 rounded-full">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">
            Authentication Failed
          </h1>
          <p className="text-white/60 text-sm">
            {errorMessage || 'Your authentication link is invalid or has expired.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => { window.location.href = '/portal/auth'; }}
            className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Request New Link
          </button>
          <a
            href="/portal/auth"
            className="block text-center text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
};
