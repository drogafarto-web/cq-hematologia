/**
 * AnalyticsHub — Main entry point for all 4 analytics dashboard views
 *
 * Responsibilities:
 *   1. Calls useAnalyticsAggregates() once to establish Firestore subscriptions
 *   2. Provides tab navigation between 4 dashboard views
 *   3. Renders RefreshButton and cache age indicator in header
 *   4. All child dashboards read from Zustand store — no additional Firestore calls
 *   5. Hosts date range filter (useDateRangeFilter) — Phase 3.3-02 Task 2
 *   6. Hosts equipment + operator filters — Phase 3.3-02 Task 3
 *   7. 30s polling with meta diff guard — Phase 3.3-02 Task 1
 *
 * Multi-tenant: labId isolation enforced in useAnalyticsAggregates().
 * Performance: dashboards load <2s when aggregates cached in Zustand.
 * Responsive: max-w-screen-xl, filter bars wrap at sm; charts responsive at lg.
 */

import React, { useState } from 'react';
import { useAnalyticsAggregates } from '../hooks/useAnalyticsAggregates';
import { useAnalyticsMeta } from '../hooks/useAnalyticsMeta';
import { useRealtimePolling } from '../hooks/useRealtimePolling';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { useEquipmentFilter } from '../hooks/useEquipmentFilter';
import { useOperatorFilter } from '../hooks/useOperatorFilter';
import { ComplianceStatusDash } from './ComplianceStatusDash';
import { CIQTrendsDash } from './CIQTrendsDash';
import { NCHeatmapDash } from './NCHeatmapDash';
import { TrainingMatrixDash } from './TrainingMatrixDash';
import { RefreshButton } from './RefreshButton';
import { DateRangePickerBar } from './DateRangePickerBar';
import { FilterBar } from './FilterBar';

// ─── Tab definition ───────────────────────────────────────────────────────────

type TabId = 'compliance' | 'trends' | 'nc-heatmap' | 'training';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width={15} height={15} viewBox="0 0 20 20" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

function ComplianceIcon() {
  return (
    <Svg>
      <path
        d="M4 10l4.5 4.5L16 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrendIcon() {
  return (
    <Svg>
      <path
        d="M2.5 13.5L7 8l3.5 3 4-5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HeatmapIcon() {
  return (
    <Svg>
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.8" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.3" />
    </Svg>
  );
}

function TrainingIcon() {
  return (
    <Svg>
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2 17c0-3.314 2.686-6 6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 13l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const TABS: Tab[] = [
  {
    id: 'compliance',
    label: 'Conformidade',
    icon: <ComplianceIcon />,
    ariaLabel: 'Status de conformidade CIQ',
  },
  {
    id: 'trends',
    label: 'Tendências',
    icon: <TrendIcon />,
    ariaLabel: 'Tendências CIQ — Levey-Jennings',
  },
  {
    id: 'nc-heatmap',
    label: 'NCs',
    icon: <HeatmapIcon />,
    ariaLabel: 'Heatmap de não-conformidades',
  },
  {
    id: 'training',
    label: 'Treinamentos',
    icon: <TrainingIcon />,
    ariaLabel: 'Matriz de treinamentos e certificações',
  },
];

// ─── Tab panel ────────────────────────────────────────────────────────────────

interface ActiveFilters {
  equipmentIds: Set<string>;
  operatorIds: Set<string>;
}

function TabPanel({
  tab,
  activeTab,
  activeFilters,
}: {
  tab: TabId;
  activeTab: TabId;
  activeFilters: ActiveFilters;
}) {
  if (tab !== activeTab) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${tab}`}
      aria-labelledby={`tab-${tab}`}
    >
      {tab === 'compliance' && (
        <ComplianceStatusDash activeFilters={activeFilters} />
      )}
      {tab === 'trends' && (
        <CIQTrendsDash activeFilters={activeFilters} />
      )}
      {tab === 'nc-heatmap' && (
        <NCHeatmapDash activeFilters={activeFilters} />
      )}
      {tab === 'training' && (
        <TrainingMatrixDash activeFilters={activeFilters} />
      )}
    </div>
  );
}

// ─── Inline SVG for polling ────────────────────────────────────────────────────

function SpinnerIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={['animate-spin', className].join(' ')}
      style={{ animationDuration: '700ms' }}
    >
      <path
        d="M17 10a7 7 0 1 1-7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Staleness indicator ──────────────────────────────────────────────────────

interface StalenessIndicatorProps {
  isPolling: boolean;
  lastCheckedAt: Date | null;
  nextCheckIn: number;
}

function StalenessIndicator({ isPolling, lastCheckedAt, nextCheckIn }: StalenessIndicatorProps) {
  const { ageLabel, isStale } = useAnalyticsMeta();

  // Compute "checked Xs ago" from lastCheckedAt
  const checkedLabel = React.useMemo(() => {
    if (!lastCheckedAt) return null;
    const secsAgo = Math.floor((Date.now() - lastCheckedAt.getTime()) / 1000);
    if (secsAgo < 5) return 'verificado agora';
    if (secsAgo < 60) return `verificado há ${secsAgo}s`;
    return null;
  }, [lastCheckedAt]);

  return (
    <div
      className="flex items-center gap-2 text-xs"
      aria-live="polite"
      aria-label={`Cache: ${ageLabel}`}
    >
      {/* Cache staleness */}
      <div
        className={[
          'flex items-center gap-1.5',
          isStale ? 'text-amber-400' : 'text-white/30',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block w-1.5 h-1.5 rounded-full',
            isStale ? 'bg-amber-400' : 'bg-emerald-500',
          ].join(' ')}
          aria-hidden
        />
        {ageLabel}
      </div>

      {/* Polling status */}
      {isPolling ? (
        <div className="flex items-center gap-1 text-white/30">
          <SpinnerIcon />
          <span>Verificando…</span>
        </div>
      ) : checkedLabel ? (
        <span className="text-white/20">{checkedLabel}</span>
      ) : (
        <span className="text-white/20">próx. {nextCheckIn}s</span>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyticsHub() {
  // Establish Firestore subscriptions — populates the Zustand store
  useAnalyticsAggregates();

  // 30s polling with meta diff guard (Phase 3.3 Task 1)
  const { isPolling, lastCheckedAt, nextCheckIn } = useRealtimePolling();

  // Date range filter (Phase 3.3 Task 2)
  const dateRange = useDateRangeFilter();

  // Equipment + operator filters (Phase 3.3 Task 3)
  const equipmentFilter = useEquipmentFilter();
  const operatorFilter = useOperatorFilter();

  const [activeTab, setActiveTab] = useState<TabId>('compliance');

  // Memoized active filter state to pass to dashboards
  const activeFilters = React.useMemo<ActiveFilters>(() => ({
    equipmentIds: equipmentFilter.selectedIds,
    operatorIds: operatorFilter.selectedIds,
  }), [equipmentFilter.selectedIds, operatorFilter.selectedIds]);

  return (
    <main
      className="min-h-screen bg-[#141417] text-white"
      aria-label="Analytics Dashboard"
    >
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <header className="border-b border-white/8 px-4 sm:px-6 pt-8 pb-0">
        <div className="max-w-screen-xl mx-auto">
          {/* Title row */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Analytics CIQ
              </h1>
              <p className="text-sm text-white/40 mt-0.5">
                Indicadores de qualidade consolidados — atualização horária
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StalenessIndicator
                isPolling={isPolling}
                lastCheckedAt={lastCheckedAt}
                nextCheckIn={nextCheckIn}
              />
              <RefreshButton />
            </div>
          </div>

          {/* ── Filter bars ──────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4 flex-wrap">
            <DateRangePickerBar
              range={dateRange.range}
              setPreset={dateRange.setPreset}
              setCustomRange={dateRange.setCustomRange}
            />
            <div className="w-px h-4 bg-white/10 hidden sm:block" aria-hidden />
            <FilterBar
              equipment={equipmentFilter}
              operators={operatorFilter}
            />
          </div>

          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <nav aria-label="Dashboard sections">
            <ol
              role="tablist"
              aria-label="Abas do dashboard"
              className="flex items-end gap-0.5"
            >
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <li key={tab.id} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id={`tab-${tab.id}`}
                      aria-controls={`panel-${tab.id}`}
                      aria-selected={isActive}
                      aria-label={tab.ariaLabel}
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium',
                        'border-b-2 transition-all duration-150 rounded-t-lg',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                        isActive
                          ? 'border-violet-500 text-white bg-white/[0.04]'
                          : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/[0.025]',
                      ].join(' ')}
                    >
                      <span aria-hidden>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </header>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        {TABS.map((tab) => (
          <TabPanel
            key={tab.id}
            tab={tab.id}
            activeTab={activeTab}
            activeFilters={activeFilters}
          />
        ))}
      </div>
    </main>
  );
}
