import React from 'react';
import { useAuthFlow } from './hooks/useAuthFlow';
import { useIsSuperAdmin, useActiveLab } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import LoginScreen from './LoginScreen';
import { FirstLabSetupScreen } from './FirstLabSetupScreen';
import { LabSelectorScreen } from './LabSelectorScreen';
import { PendingLabAccessScreen } from './PendingLabAccessScreen';
import { SuspendedScreen } from './SuspendedScreen';
import { EmailVerificationScreen } from './EmailVerificationScreen';
import { SuperAdminDashboard } from '../admin/SuperAdminDashboard';
import { ModuleHub } from '../hub/ModuleHub';
import { AnalyzerView } from '../analyzer/AnalyzerView';
import { BulaProcessor } from '../bulaparser/BulaProcessor';
import { ReportsView } from '../reports/ReportsView';

// ─── Full-screen loader ───────────────────────────────────────────────────────

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] flex items-center justify-center transition-colors duration-300">
      <svg className="animate-spin w-6 h-6 text-slate-300 dark:text-white/20" viewBox="0 0 24 24" fill="none" aria-label="Carregando">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
        <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ─── Router for ready state ───────────────────────────────────────────────────

function AppRouter() {
  const isSuperAdmin = useIsSuperAdmin();
  const activeLab = useActiveLab();
  const currentView = useAppStore((s) => s.currentView);

  // Super admin with no lab → always start in admin dashboard
  if (isSuperAdmin && !activeLab) return <SuperAdminDashboard />;

  if (currentView === 'superadmin' && isSuperAdmin) return <SuperAdminDashboard />;
  if (currentView === 'hub') return <ModuleHub />;
  if (currentView === 'bulaparser') return <BulaProcessor />;
  if (currentView === 'reports') return <ReportsView />;

  return <AnalyzerView />;
}

// ─── AuthWrapper ──────────────────────────────────────────────────────────────

export const AuthWrapper: React.FC = () => {
  const { status } = useAuthFlow();

  switch (status) {
    case 'loading': return <FullScreenLoader />;
    case 'unauthenticated': return <LoginScreen />;
    case 'suspended': return <SuspendedScreen />;
    case 'email_not_verified': return <EmailVerificationScreen />;
    case 'first_setup': return <FirstLabSetupScreen />;
    case 'pending_access': return <PendingLabAccessScreen />;
    case 'select_lab': return <LabSelectorScreen />;
    case 'ready': return <AppRouter />;
  }
};
