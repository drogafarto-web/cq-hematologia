import React, { useEffect } from 'react';
import { AuthWrapper } from './features/auth/AuthWrapper';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { ToastContainer } from './shared/components/ui/ToastContainer';
import { useSentryAuthSync } from './lib/useSentryAuthSync';
import { initWebVitals } from './lib/web-vitals';

export default function App() {
  useSentryAuthSync();

  // Initialize Web Vitals monitoring on app load
  useEffect(() => {
    initWebVitals();
  }, []);

  return (
    <ErrorBoundary>
      <div className="bg-gray-50 dark:bg-[#0c0c0c] min-h-screen text-gray-900 dark:text-white font-sans antialiased selection:bg-blue-500/30">
        <AuthWrapper />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
