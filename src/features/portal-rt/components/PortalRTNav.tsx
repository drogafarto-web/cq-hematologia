/**
 * Portal RT — Navigation
 *
 * Sidebar navigation with links to dashboard sections.
 * Dark-first, inline icons, active state with violet accent underline.
 */

import React, { useMemo } from 'react';
import type { PortalRTSectionType } from '../types';
import { PortalRTTokens } from './_ui';

// ─── Icon components (inline SVG, currentColor) ────────────────────────────────

function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="8" height="8" />
      <rect x="10" y="3" width="8" height="8" />
      <rect x="2" y="11" width="8" height="8" />
      <rect x="10" y="11" width="8" height="8" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="9" />
      <line x1="10" y1="6" x2="10" y2="10" />
      <line x1="10" y1="14" x2="10.01" y2="14" />
    </svg>
  );
}

function IconFileText() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      <line x1="6" y1="6" x2="14" y2="6" />
      <line x1="6" y1="9" x2="14" y2="9" />
      <line x1="6" y1="12" x2="10" y2="12" />
    </svg>
  );
}

function IconShieldCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2l7 3v5c0 5-7 7-7 7s-7-2-7-7V5l7-3z" />
      <polyline points="7 10 9 12 13 8" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2v2M10 14v2M18 10h-2M4 10H2M15.66 4.34l-1.41 1.41M5.75 14.25l-1.41 1.41M15.66 15.66l-1.41-1.41M5.75 5.75L4.34 4.34" />
    </svg>
  );
}

// ─── Navigation item ──────────────────────────────────────────────────────────

interface PortalRTNavItemProps {
  section: PortalRTSectionType;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  badge?: number;
  onClick: () => void;
}

function NavItem({ section, label, icon, isActive, badge, onClick }: PortalRTNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-lg
        transition-all duration-150
        relative
        ${
          isActive
            ? `${PortalRTTokens.bg.hover} ${PortalRTTokens.text.primary}`
            : `${PortalRTTokens.text.secondary} hover:${PortalRTTokens.bg.hover}`
        }
      `}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-violet-400' : PortalRTTokens.text.secondary}`}>
        {icon}
      </span>
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      {badge && badge > 0 && (
        <span className="flex-shrink-0 bg-rose-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
      {isActive && (
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-violet-400" />
      )}
    </button>
  );
}

// ─── Main navigation ──────────────────────────────────────────────────────────

export interface PortalRTNavProps {
  activeSection: PortalRTSectionType;
  onSelectSection: (section: PortalRTSectionType) => void;
  escalationCount?: number;
  labName?: string;
}

export function PortalRTNav({
  activeSection,
  onSelectSection,
  escalationCount = 0,
  labName = 'Lab',
}: PortalRTNavProps) {
  const navItems = useMemo(
    () => [
      {
        id: 'dashboard' as const,
        label: 'Dashboard',
        icon: <IconDashboard />,
      },
      {
        id: 'criticos' as const,
        label: 'Críticos',
        icon: <IconAlertCircle />,
        badge: escalationCount,
      },
      {
        id: 'resultados' as const,
        label: 'Resultados',
        icon: <IconFileText />,
      },
      {
        id: 'compliance' as const,
        label: 'Compliance',
        icon: <IconShieldCheck />,
      },
      {
        id: 'configuracao' as const,
        label: 'Configuração',
        icon: <IconSettings />,
      },
    ],
    [escalationCount]
  );

  return (
    <nav className={`flex flex-col ${PortalRTTokens.bg.base} border-r ${PortalRTTokens.border.default} h-screen sticky top-0`}>
      {/* Logo / Lab name */}
      <div className="px-4 py-6 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-violet-400">
              <path d="M10 2c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${PortalRTTokens.text.primary} truncate`}>
              {labName}
            </p>
            <p className={`text-xs ${PortalRTTokens.text.tertiary}`}>Lab QC</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            section={item.id}
            label={item.label}
            icon={item.icon}
            isActive={activeSection === item.id}
            badge={item.badge}
            onClick={() => onSelectSection(item.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className={`border-t ${PortalRTTokens.border.default} px-4 py-4`}>
        <p className={`text-xs ${PortalRTTokens.text.tertiary}`}>v1.4.0-alpha</p>
      </div>
    </nav>
  );
}
