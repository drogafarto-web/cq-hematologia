/**
 * Portal RT — Main Layout Shell
 *
 * Responsive container with sidebar navigation, top bar, and content area.
 * Mobile: hamburger toggle, sidebar slides over. Desktop: side-by-side.
 */

import React, { useState } from 'react';
import { PortalRTNav } from './PortalRTNav';
import type { PortalRTSectionType } from '../types';
import { PortalRTTokens } from './_ui';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortalRTShellProps {
  labId: string;
  labName?: string;
  operatorName?: string;
  onLogout?: () => void;
  activeSection: PortalRTSectionType;
  onSelectSection: (section: PortalRTSectionType) => void;
  escalationCount?: number;
  children?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PortalRTShell({
  labId,
  labName = 'Lab',
  operatorName = 'Operador',
  onLogout,
  activeSection,
  onSelectSection,
  escalationCount = 0,
  children,
}: PortalRTShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className={`flex h-screen ${PortalRTTokens.bg.base} ${PortalRTTokens.text.primary}`}>
      {/* Sidebar — Desktop visible, mobile as overlay */}
      <div
        className={`
          fixed md:static
          top-0 left-0 bottom-0 z-50
          w-64 md:w-auto
          transition-transform duration-300
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <PortalRTNav
          activeSection={activeSection}
          onSelectSection={(section) => {
            onSelectSection(section);
            setMobileNavOpen(false); // Close sidebar on mobile when selecting
          }}
          escalationCount={escalationCount}
          labName={labName}
        />
      </div>

      {/* Mobile overlay when nav is open */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className={`
          h-16
          border-b ${PortalRTTokens.border.default}
          ${PortalRTTokens.bg.base}
          flex items-center justify-between px-4 md:px-6
          sticky top-0 z-40
        `}>
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className={`
              md:hidden
              p-2 rounded-lg
              transition-colors duration-150
              ${PortalRTTokens.bg.hover}
              ${PortalRTTokens.text.primary}
            `}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          </button>

          {/* Lab name (desktop) */}
          <div className="hidden md:block">
            <p className={`text-sm font-semibold ${PortalRTTokens.text.primary}`}>{labName}</p>
          </div>

          {/* Operator + Logout (right-aligned) */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-violet-400">
                  <path d="M8 8c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <p className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>{operatorName}</p>
                <p className={`text-xs ${PortalRTTokens.text.tertiary}`}>Responsável Técnico</p>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className={`
                  px-3 py-2 rounded-lg
                  text-sm font-medium
                  transition-colors duration-150
                  ${PortalRTTokens.bg.hover}
                  ${PortalRTTokens.text.secondary} hover:${PortalRTTokens.text.primary}
                `}
                aria-label="Logout"
              >
                Sair
              </button>
            )}
          </div>
        </header>

        {/* Content pane */}
        <main className={`
          flex-1 overflow-y-auto
          ${PortalRTTokens.bg.base}
          px-4 md:px-6 py-6
          max-w-7xl mx-auto w-full
        `}>
          {children || (
            <div className={`text-center py-12`}>
              <p className={PortalRTTokens.text.secondary}>
                Seção vazia — selecione uma abca na navegação
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
