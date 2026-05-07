import React, { useState } from 'react';
import { useAuthFlow } from './hooks/useAuthFlow';
import { useIsSuperAdmin, useActiveLab, useUser } from '../../store/useAuthStore';
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
import { SGQView } from '../sgq/SGQView';
import { ListaMestraView } from '../sgq/ListaMestraView';
import { RastreabilidadeView } from '../traceability/RastreabilidadeView';
import { AnalyticsHub } from '../analytics/components/AnalyticsHub';
import { ExportQueueView } from '../export/components/ExportQueueView';
import { ExportWizard } from '../export/components/ExportWizard';
import { CEQDashboard } from '../ceq/components/CEQDashboard';
import { AuditoriaView } from '../auditoria-interna/components/AuditoriaView';
import { CAPADashboard } from '../capa-tracking/components/CAPADashboard';
import CalibracaoDashboard from '../calibracao/components/CalibracaoDashboard';
import PersonnelDashboard from '../personnel/components/PersonnelDashboard';
import ManagementReviewDashboard from '../management-review/components/ManagementReviewDashboard';
import { ReclamacoesView } from '../reclamacoes';
import { SugestaoDashboard } from '../sugestoes';

// Lazy: bioquimica é o primeiro módulo lazy-loaded por chunk dedicado
// (`module-bioquimica` em vite.config.ts). Plans 09-02+ ainda vão crescer
// esse bundle — manter lazy desde o início evita regressão de LCP.
const BioquimicaView = React.lazy(() => import('../bioquimica'));

// Phase 10: Liberação + Críticos (lazy-loaded)
const LiberacaoView = React.lazy(() => import('../liberacao'));
const CriticosView = React.lazy(() => import('../criticos'));
const PortalMedicoView = React.lazy(() => import('../portal-medico'));

// Phase 0: Turnos (lazy-loaded)
const TurnosView = React.lazy(() =>
  import('../turnos/components/TurnosView').then((m) => ({ default: m.TurnosView })),
);

// Phase 0: Risks (lazy-loaded)
const RisksView = React.lazy(() =>
  import('../risks/components/RisksView').then((m) => ({ default: m.RisksView })),
);

// Phase 1.4: Auditoria — Trilha de eventos (lazy-loaded)
const AuditTrailView = React.lazy(() =>
  import('../auditoria-trail').then((m) => ({ default: m.AuditTrailView })),
);

import { useBrowserHistorySync } from '../../shared/hooks/useBrowserHistorySync';

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

function ExportsView() {
  const activeLab = useActiveLab();
  const user = useUser();
  const [wizardOpen, setWizardOpen] = useState(false);
  const labId = activeLab?.id ?? '';
  const operatorId = user?.uid ?? '';

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-400/80 mb-1">
              Ferramentas
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Exportações</h1>
            <p className="text-sm text-white/40 mt-1">
              XLSX, relatórios PDF, histórico de exports
            </p>
          </div>
          {labId && (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 4v9M7 10l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.5 14v1.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Novo export
            </button>
          )}
        </div>

        {labId ? (
          <ExportQueueView labId={labId} />
        ) : (
          <p className="text-white/40 text-sm">Nenhum laboratório ativo.</p>
        )}

        {wizardOpen && labId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#141417] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg">
              <ExportWizard
                labId={labId}
                operatorId={operatorId}
                onSubmitted={() => setWizardOpen(false)}
              />
              <div className="px-6 pb-5">
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="w-full py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppRouter() {
  const isSuperAdmin = useIsSuperAdmin();
  const activeLab = useActiveLab();
  const currentView = useAppStore((s) => s.currentView);

  // Integra rota interna (zustand) com History API: voltar do browser
  // navega entre views internas em vez de sair do app.
  useBrowserHistorySync();

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
  } else if (currentView === 'sgq-documentos') {
    view = <SGQView />;
  } else if (currentView === 'sgq-lista-mestra') {
    view = <ListaMestraView />;
  } else if (currentView === 'rastreabilidade') {
    view = <RastreabilidadeView />;
  } else if (currentView === 'analytics') {
    view = <AnalyticsHub />;
  } else if (currentView === 'exports') {
    view = <ExportsView />;
  } else if (currentView === 'ceq') {
    view = <CEQDashboard />;
  } else if (currentView === 'auditoria-interna') {
    view = <AuditoriaView />;
  } else if (currentView === 'auditoria-trail') {
    view = (
      <React.Suspense fallback={<FullScreenLoader />}>
        <AuditTrailView />
      </React.Suspense>
    );
  } else if (currentView === 'capa-tracking') {
    view = <CAPADashboard />;
  } else if (currentView === 'calibracao') {
    view = <CalibracaoDashboard />;
  } else if (currentView === 'personnel') {
    view = <PersonnelDashboard />;
  } else if (currentView === 'management-review') {
    view = <ManagementReviewDashboard />;
  } else if (currentView === 'reclamacoes') {
    view = <ReclamacoesView />;
  } else if (currentView === 'sugestoes') {
    view = <SugestaoDashboard />;
  } else if (currentView === 'bioquimica') {
    view = (
      <React.Suspense fallback={<FullScreenLoader />}>
        <BioquimicaView />
      </React.Suspense>
    );
  } else if (currentView === 'liberacao') {
    view = (
      <React.Suspense fallback={<FullScreenLoader />}>
        <LiberacaoView />
      </React.Suspense>
    );
  } else if (currentView === 'criticos') {
    view = (
      <React.Suspense fallback={<FullScreenLoader />}>
        <CriticosView />
      </React.Suspense>
    );
  } else if (currentView === 'portal-medico') {
    view = (
      <React.Suspense fallback={<FullScreenLoader />}>
        <PortalMedicoView />
      </React.Suspense>
    );
  } else if (currentView === 'turnos') {
    view = (
      <React.Suspense fallback={<FullScreenLoader />}>
        <TurnosView />
      </React.Suspense>
    );
  } else if (currentView === 'risks') {
    view = (
      <React.Suspense fallback={<FullScreenLoader />}>
        <RisksView />
      </React.Suspense>
    );
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
