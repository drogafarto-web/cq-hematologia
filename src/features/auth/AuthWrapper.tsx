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
import { LabCQISettings } from '../labSettings/LabCQISettings';
import { CoagulacaoView } from '../coagulacao/CoagulacaoView';
import { UroanaliseView } from '../uroanalise/UroanaliseView';
import { InsumosView } from '../insumos/InsumosView';
import { EducacaoContinuadaView } from '../educacao-continuada/EducacaoContinuadaView';
import { ControlTemperaturaView } from '../controle-temperatura/ControlTemperaturaView';

// ─── Full-screen loader ───────────────────────────────────────────────────────

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] flex items-center justify-center transition-colors duration-300">
      <svg
        className="animate-spin w-6 h-6 text-slate-300 dark:text-white/20"
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Carregando"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
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

// ─── Router for ready state ───────────────────────────────────────────────────

function AppRouter() {
  const isSuperAdmin = useIsSuperAdmin();
  const activeLab = useActiveLab();
  const currentView = useAppStore((s) => s.currentView);

  // Resolve which view to render
  let view: React.ReactNode;
  if (isSuperAdmin && !activeLab) {
    view = <SuperAdminDashboard />;
  } else if (currentView === 'superadmin' && isSuperAdmin) {
    view = <SuperAdminDashboard />;
  } else if (currentView === 'hub') {
    view = <ModuleHub />;
  } else if (currentView === 'bulaparser') {
    view = <BulaProcessor />;
  } else if (currentView === 'reports') {
    view = <ReportsView />;
  } else if (currentView === 'lab-settings') {
    view = <LabCQISettings />;
  } else if (currentView === 'coagulacao') {
    view = <CoagulacaoView />;
  } else if (currentView === 'uroanalise') {
    view = <UroanaliseView />;
  } else if (currentView === 'insumos') {
    view = <InsumosView />;
  } else if (currentView === 'educacao-continuada') {
    view = <EducacaoContinuadaView />;
  } else if (currentView === 'controle-temperatura') {
    view = <ControlTemperaturaView />;
  } else {
    view = <AnalyzerView />;
  }

  // Shell views (analyzer + ciq-imuno) share the same key so AnalyzerView
  // persists across module switches; other views get their own key.
  const shellViews = new Set(['analyzer', 'ciq-imuno']);
  const viewKey = shellViews.has(currentView) ? 'shell' : currentView;

  return (
    <div key={viewKey} className="view-enter">
      {view}
    </div>
  );
}

// ─── AuthWrapper ──────────────────────────────────────────────────────────────

export const AuthWrapper: React.FC = () => {
  const { status } = useAuthFlow();

  switch (status) {
    case 'loading':
      return <FullScreenLoader />;
    case 'unauthenticated':
      return <LoginScreen />;
    case 'suspended':
      return <SuspendedScreen />;
    case 'email_not_verified':
      return <EmailVerificationScreen />;
    case 'first_setup':
      return <FirstLabSetupScreen />;
    case 'pending_access':
      return <PendingLabAccessScreen />;
    case 'select_lab':
      return <LabSelectorScreen />;
    case 'ready':
      return <AppRouter />;
  }
};
