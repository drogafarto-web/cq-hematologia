/**
 * PortalAuthGuard
 * Component wrapper — checks session validity
 * On invalid/expired: redirects to /portal/auth
 */

import React, { useEffect } from 'react';
import { usePatientSession, useIsTokenExpired } from '../hooks/usePatientAuthStore';

interface PortalAuthGuardProps {
  children: React.ReactNode;
}

export const PortalAuthGuard: React.FC<PortalAuthGuardProps> = ({ children }) => {
  const session = usePatientSession();
  const isExpired = useIsTokenExpired();

  useEffect(() => {
    if (!session || isExpired) {
      window.location.href = '/portal/auth';
    }
  }, [session, isExpired]);

  if (!session || isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#141417] via-[#1a1a1f] to-[#0c0c0f] flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
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

  return <>{children}</>;
};
