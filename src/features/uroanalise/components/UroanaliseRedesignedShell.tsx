import React, { useCallback, useMemo, useState } from 'react';
import { UroLotSidebar, type UroLotSidebarItem } from './UroLotSidebar';
import { UroBreadcrumbHeader } from './UroBreadcrumbHeader';
import { UroMobileTabBar, type UroTabKey } from './UroMobileTabBar';
import { UroAuditTable, type UroAuditRow } from './UroAuditTable';
import { UroAuditTrailDrawer, type UroAuditEvent } from './UroAuditTrailDrawer';
import { UroComplianceChecklist, type UroComplianceItem } from './UroComplianceChecklist';
import { UroanaliseFormRedesigned } from './UroanaliseFormRedesigned';
import type { UroanaliseFormData } from './UroanaliseForm.schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UroanaliseRedesignedShellProps {
  // Identity / scope
  labName?: string;

  // Lot list
  lots: UroLotSidebarItem[];
  lotsLoading?: boolean;
  selectedLotId?: string;
  onSelectLot: (id: string) => void;
  onTogglePinLot: (id: string, nextPinned: boolean) => void;
  onCreateLot?: () => void;

  // Selected lot detail (for breadcrumb)
  selectedLot?: {
    loteControle: string;
    fabricanteControle: string;
    nivel: 'N' | 'P';
    pinned?: boolean;
    setupType?: 'principal' | 'validacao_paralela' | null;
  };

  // Form (entry path)
  formInitialValues: Partial<UroanaliseFormData>;
  onSubmitRun: (data: UroanaliseFormData) => Promise<void>;
  formDisabled?: boolean;
  operadorDisplay?: string;

  // Audit (RT path)
  auditRows: UroAuditRow[];
  auditLoading?: boolean;
  onViewRun: (id: string) => void;
  onSignRun: (id: string) => void;
  onBulkSign?: (ids: string[]) => void;

  // Compliance
  complianceItems: UroComplianceItem[];
  complianceLoading?: boolean;

  // Audit trail drawer
  auditTrailEvents: UroAuditEvent[];
  auditTrailLoading?: boolean;
  auditTrailSubtitle?: string;

  // Extra header actions (e.g., approve/reject lot) rendered before the "Trilha" button
  headerActionsExtra?: React.ReactNode;

  // Optional banner rendered above breadcrumb (e.g., preview/beta indicator)
  banner?: React.ReactNode;

  // Optional cancel out of the whole module
  onCancel?: () => void;

  onAddTiraLot?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UroanaliseRedesignedShell({
  labName,
  lots,
  lotsLoading,
  selectedLotId,
  onSelectLot,
  onTogglePinLot,
  onCreateLot,
  selectedLot,
  formInitialValues,
  onSubmitRun,
  formDisabled,
  operadorDisplay,
  auditRows,
  auditLoading,
  onViewRun,
  onSignRun,
  onBulkSign,
  complianceItems,
  complianceLoading,
  auditTrailEvents,
  auditTrailLoading,
  auditTrailSubtitle,
  headerActionsExtra,
  banner,
  onCancel,
  onAddTiraLot,
}: UroanaliseRedesignedShellProps) {
  const [activeTab, setActiveTab] = useState<UroTabKey>('corrida');
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  const [selectedAuditIds, setSelectedAuditIds] = useState<Set<string>>(new Set());

  const pendingAuditCount = useMemo(
    () => auditRows.filter((r) => !r.signed).length,
    [auditRows]
  );

  const tabs = useMemo(
    () => [
      { key: 'lotes' as const, label: 'Lotes' },
      { key: 'corrida' as const, label: 'Corrida' },
      { key: 'auditoria' as const, label: 'Auditoria', badge: pendingAuditCount },
    ],
    [pendingAuditCount]
  );

  // ── Bulk audit selection handlers ────────────────────────────────────────
  const handleToggleAuditSelect = useCallback((id: string, next: boolean) => {
    setSelectedAuditIds((s) => {
      const out = new Set(s);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  }, []);

  const handleSelectAllAudit = useCallback(
    (next: boolean) => {
      setSelectedAuditIds(next ? new Set(auditRows.map((r) => r.id)) : new Set());
    },
    [auditRows]
  );

  const handleBulkSign = useCallback(
    (ids: string[]) => {
      if (onBulkSign) onBulkSign(ids);
      setSelectedAuditIds(new Set());
    },
    [onBulkSign]
  );

  // ── Header actions slot ──────────────────────────────────────────────────
  const headerActions = (
    <div className="flex items-center gap-2">
      {headerActionsExtra}
      <button
        type="button"
        onClick={() => setAuditTrailOpen(true)}
        className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/85 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.09] hover:border-slate-300 dark:hover:border-white/[0.18] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
      >
        Trilha
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#0f1318] text-slate-900 dark:text-white/90 overflow-hidden">
      {/* Optional banner — preview, beta, etc. */}
      {banner}

      {/* Breadcrumb header — full width */}
      <UroBreadcrumbHeader
        labName={labName}
        loteControle={selectedLot?.loteControle}
        fabricanteControle={selectedLot?.fabricanteControle}
        nivel={selectedLot?.nivel}
        pinned={selectedLot?.pinned}
        setupType={selectedLot?.setupType}
        onBackToList={() => setActiveTab('lotes')}
        actions={headerActions}
      />

      {/* Main 3-column body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — desktop always; mobile when activeTab === 'lotes' */}
        <aside
          className={[
            'border-r border-slate-200 dark:border-white/[0.08]',
            'w-full sm:w-72 lg:w-80 shrink-0',
            activeTab === 'lotes' ? 'flex' : 'hidden sm:flex',
          ].join(' ')}
        >
          <UroLotSidebar
            items={lots}
            selectedId={selectedLotId}
            onSelect={(id) => {
              onSelectLot(id);
              setActiveTab('corrida');
            }}
            onTogglePin={onTogglePinLot}
            onCreateLot={onCreateLot}
            loading={lotsLoading}
            className="w-full"
          />
        </aside>

        {/* Main content — desktop always; mobile when not lotes */}
        <main
          className={[
            'flex-1 overflow-y-auto',
            activeTab === 'lotes' ? 'hidden sm:flex' : 'flex',
            'flex-col min-w-0 pb-20 sm:pb-0',
          ].join(' ')}
        >
          {/* Mobile-only inline tabs that mirror the desktop side panel switch */}
          <div className="sm:hidden flex border-b border-slate-200 dark:border-white/[0.08]">
            <TabButton
              active={activeTab === 'corrida'}
              onClick={() => setActiveTab('corrida')}
              label="Corrida"
            />
            <TabButton
              active={activeTab === 'auditoria'}
              onClick={() => setActiveTab('auditoria')}
              label="Auditoria"
              badge={pendingAuditCount}
            />
          </div>

          {/* Desktop tab switcher — sticky at top of main */}
          <div className="hidden sm:flex items-center gap-1 px-6 pt-4 border-b border-slate-200 dark:border-white/[0.08]">
            <TabButton
              active={activeTab === 'corrida'}
              onClick={() => setActiveTab('corrida')}
              label="Corrida"
            />
            <TabButton
              active={activeTab === 'auditoria'}
              onClick={() => setActiveTab('auditoria')}
              label="Auditoria"
              badge={pendingAuditCount}
            />
          </div>

          {/* Active panel */}
          {activeTab === 'corrida' && selectedLotId && (
            <UroanaliseFormRedesigned
              initialValues={formInitialValues}
              onSubmit={onSubmitRun}
              onCancel={onCancel}
              disabled={formDisabled}
              operadorDisplay={operadorDisplay}
              onAddTiraLot={onAddTiraLot}
            />
          )}

          {activeTab === 'corrida' && !selectedLotId && (
            <EmptyState
              title="Selecione um lote"
              hint="Escolha um lote no painel à esquerda para iniciar uma corrida."
            />
          )}

          {activeTab === 'auditoria' && selectedLotId && (
            <div className="flex flex-col gap-8 px-6 py-6 max-w-5xl">
              <UroComplianceChecklist
                items={complianceItems}
                loading={complianceLoading}
                subtitle={selectedLot?.loteControle}
              />
              <div>
                <header className="flex items-baseline justify-between border-b border-slate-200 dark:border-white/[0.08] pb-3 mb-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
                    Corridas no lote
                  </h2>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-white/30">
                    {auditRows.length}
                  </span>
                </header>
                <UroAuditTable
                  rows={auditRows}
                  loading={auditLoading}
                  selectedIds={selectedAuditIds}
                  onToggleSelect={handleToggleAuditSelect}
                  onSelectAll={handleSelectAllAudit}
                  onView={onViewRun}
                  onSign={onSignRun}
                  onBulkSign={onBulkSign ? handleBulkSign : undefined}
                />
              </div>
            </div>
          )}

          {activeTab === 'auditoria' && !selectedLotId && (
            <EmptyState
              title="Selecione um lote"
              hint="A auditoria mostra as corridas do lote selecionado."
            />
          )}
        </main>
      </div>

      {/* Mobile tab bar */}
      <UroMobileTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Audit trail drawer */}
      <UroAuditTrailDrawer
        open={auditTrailOpen}
        onClose={() => setAuditTrailOpen(false)}
        title="Trilha de auditoria"
        subtitle={auditTrailSubtitle ?? selectedLot?.loteControle}
        events={auditTrailEvents}
        loading={auditTrailLoading}
      />
    </div>
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}

function TabButton({ active, onClick, label, badge }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={[
        'relative px-4 py-3 text-xs font-semibold uppercase tracking-wider',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded-md',
        active
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/85',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-2">
        {label}
        {badge && badge > 0 ? (
          <span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-amber-500 text-white tabular-nums">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      {active && (
        <span
          aria-hidden
          className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-500 rounded-full"
        />
      )}
    </button>
  );
}

interface EmptyStateProps {
  title: string;
  hint: string;
}

function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
      <p className="text-base font-semibold text-slate-700 dark:text-white/80">{title}</p>
      <p className="text-sm text-slate-500 dark:text-white/50 mt-2 max-w-sm">{hint}</p>
    </div>
  );
}
