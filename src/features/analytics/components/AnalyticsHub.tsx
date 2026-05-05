/**
 * AnalyticsHub — Main entry point for all 4 analytics dashboard views
 *
 * Responsibilities:
 *   1. Calls useAnalyticsAggregates() once to establish Firestore subscriptions
 *   2. Provides tab navigation between 4 dashboard views
 *   3. Renders RefreshButton and cache age indicator in header
 *   4. All child dashboards read from Zustand store — no additional Firestore calls
 *
 * Multi-tenant: labId isolation enforced in useAnalyticsAggregates().
 * Performance: dashboards load <2s when aggregates cached in Zustand.
 */

import React, { useState } from 'react';
import { useAnalyticsAggregates } from '../hooks/useAnalyticsAggregates';
import { useAnalyticsMeta } from '../hooks/useAnalyticsMeta';
import { ComplianceStatusDash } from './ComplianceStatusDash';
import { CIQTrendsDash } from './CIQTrendsDash';
import { NCHeatmapDash } from './NCHeatmapDash';
import { TrainingMatrixDash } from './TrainingMatrixDash';
import { RefreshButton } from './RefreshButton';

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

function TabPanel({ tab, activeTab }: { tab: TabId; activeTab: TabId }) {
  if (tab !== activeTab) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${tab}`}
      aria-labelledby={`tab-${tab}`}
    >
      {tab === 'compliance' && <ComplianceStatusDash />}
      {tab === 'trends' && <CIQTrendsDash />}
      {tab === 'nc-heatmap' && <NCHeatmapDash />}
      {tab === 'training' && <TrainingMatrixDash />}
    </div>
  );
}

// ─── Staleness indicator ──────────────────────────────────────────────────────

function StalenessIndicator() {
  const { ageLabel, isStale } = useAnalyticsMeta();
  return (
    <div
      className={[
        'flex items-center gap-1.5 text-xs',
        isStale ? 'text-amber-400' : 'text-white/30',
      ].join(' ')}
      aria-live="polite"
      aria-label={`Cache: ${ageLabel}`}
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
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyticsHub() {
  // Establish Firestore subscriptions — populates the Zustand store
  useAnalyticsAggregates();

  const [activeTab, setActiveTab] = useState<TabId>('compliance');

  return (
    <main
      className="min-h-screen bg-[#141417] text-white"
      aria-label="Analytics Dashboard"
    >
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <header className="border-b border-white/8 px-6 pt-8 pb-0">
        <div className="max-w-7xl mx-auto">
          {/* Title row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Analytics CIQ
              </h1>
              <p className="text-sm text-white/40 mt-0.5">
                Indicadores de qualidade consolidados — atualização horária
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StalenessIndicator />
              <RefreshButton />
            </div>
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {TABS.map((tab) => (
          <TabPanel key={tab.id} tab={tab.id} activeTab={activeTab} />
        ))}
      </div>
    </main>
  );
}
