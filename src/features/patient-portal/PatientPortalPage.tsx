/**
 * PatientPortalPage
 * Standalone patient portal app (separate from main HC Quality)
 * Routes handled by index.html rewrites
 * This component auto-detects current path and renders appropriate view
 */

import React, { useEffect, useState } from 'react';
import {
  initializePatientAuthStore,
  usePatientSession,
  useIsTokenExpired,
} from './hooks/usePatientAuthStore';
import { PortalAuthLink } from './components/PortalAuthLink';
import { PatientAuthForm } from './components/PatientAuthForm';
import { PatientDashboard } from './components/PatientDashboard';
import { PatientLaudoViewer } from './components/PatientLaudoViewer';

export const PatientPortalPage: React.FC = () => {
  const session = usePatientSession();
  const isExpired = useIsTokenExpired();
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    // Initialize auth store from localStorage on mount
    initializePatientAuthStore();

    // Update path on navigation
    const handlePopState = () => {
      setPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Determine which view to render based on path
  const isAuthenticated = session && !isExpired;

  if (path.includes('/portal/auth/link')) {
    return <PortalAuthLink />;
  }

  if (path.includes('/portal/laudo')) {
    if (!isAuthenticated) {
      window.location.href = '/portal/auth';
      return null;
    }
    const laudoId = new URLSearchParams(window.location.search).get('id');
    return <PatientLaudoViewer laudoId={laudoId || undefined} />;
  }

  if (path.includes('/portal/dashboard')) {
    if (!isAuthenticated) {
      window.location.href = '/portal/auth';
      return null;
    }
    return <PatientDashboard />;
  }

  // Default to auth form
  return <PatientAuthForm labId="" />;
};
