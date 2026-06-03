/**
 * PatientAuthForm
 * Email-based auth request (fallback for expired/invalid tokens)
 * RN-P03: 3 attempts max per day (enforced server-side)
 * WCAG AA compliant, dark-first design
 */

import React, { useState } from 'react';
import { generatePatientAuthLink, isValidEmail } from '../services/patientAuthService';
import type { GenerateAuthLinkResponse } from '../types';

interface PatientAuthFormProps {
  labId: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const PatientAuthForm: React.FC<PatientAuthFormProps> = ({ labId, onSuccess, onError }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<GenerateAuthLinkResponse | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');

    // Validation
    if (!email.trim()) {
      setFieldError('Email is required');
      return;
    }

    if (!isValidEmail(email)) {
      setFieldError('Please enter a valid email address');
      return;
    }

    if (attempts >= 5) {
      const message = 'Too many attempts. Please try again later.';
      setFieldError(message);
      onError?.(message);
      return;
    }

    setIsLoading(true);
    try {
      const result = await generatePatientAuthLink({
        email: email.trim().toLowerCase(),
        labId,
      });

      setResponse(result);
      setAttempts(attempts + 1);

      if (result.success) {
        setEmail('');
        const message = `Authentication link sent to ${email}. It expires in ${result.expiresInHours || 72} hours.`;
        onSuccess?.(message);
      } else {
        const message = result.error || 'Failed to send authentication link';
        setFieldError(message);
        onError?.(message);
      }
    } catch (error: any) {
      const message = error?.message || 'An unexpected error occurred';
      setFieldError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Input */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-white/90">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldError('');
          }}
          placeholder="you@example.com"
          disabled={isLoading}
          aria-label="Email address"
          aria-invalid={fieldError ? 'true' : 'false'}
          aria-describedby={fieldError ? 'email-error' : undefined}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 transition-colors"
        />
        {fieldError && (
          <p id="email-error" className="text-sm text-red-400">
            {fieldError}
          </p>
        )}
      </div>

      {/* Attempt Counter (for UX feedback) */}
      {attempts > 0 && attempts < 5 && (
        <p className="text-xs text-white/50">Attempts: {attempts}/5</p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || attempts >= 5}
        className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#141417]"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
            Sending...
          </span>
        ) : (
          'Request Authentication Link'
        )}
      </button>

      {/* Success Message */}
      {response?.success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-sm text-emerald-300">✓ {response.message}</p>
        </div>
      )}

      {/* Rate Limit Message */}
      {attempts >= 5 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-300">
            You've reached the maximum number of attempts. Please try again later.
          </p>
        </div>
      )}

      {/* Accessibility: info text */}
      <p className="text-xs text-white/50 leading-relaxed">
        We'll send you a secure link to access your lab results. The link expires in 72 hours.
      </p>
    </form>
  );
};
