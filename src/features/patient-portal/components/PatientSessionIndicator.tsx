/**
 * PatientSessionIndicator
 * Bottom-right corner: remaining time, warning at 10min, auto-logout at 0
 */

import React, { useEffect, useState } from 'react';
import { usePatientSession, usePatientAuthStore } from '../hooks/usePatientAuthStore';

export const PatientSessionIndicator: React.FC = () => {
  const session = usePatientSession();
  const { clearSession } = usePatientAuthStore();
  const [displayTime, setDisplayTime] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!session) return;

    const updateTimer = () => {
      const remaining = usePatientAuthStore.getState().getTimeRemaining();
      
      if (remaining <= 0) {
        // Session expired — auto-logout
        clearSession();
        window.location.href = '/portal/auth';
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      // Show warning at 10 minutes or less
      setShowWarning(hours === 0 && minutes <= 10);

      if (hours > 0) {
        setDisplayTime(`${hours}h ${minutes}m`);
      } else {
        setDisplayTime(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session, clearSession]);

  if (!session) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg backdrop-blur-sm transition-all ${
        showWarning
          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-100'
          : 'bg-white/5 border border-white/10 text-white/70'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {showWarning && <span>⚠️ Session expires in:</span>}
        {!showWarning && <span>Session expires in:</span>}
        <span className="font-semibold">{displayTime}</span>
      </div>
      {showWarning && (
        <p className="text-xs text-amber-100/70 mt-1">
          Log in again to extend your session
        </p>
      )}
    </div>
  );
};
