import React, { useState } from 'react';
import { useActiveLab, useIsSuperAdmin, useUser, useUserRole, useAvailableLabs } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useAuthFlow } from '../auth/hooks/useAuthFlow';
import { ThemeToggle } from '../../shared/components/ui/ThemeToggle';
import type { View } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M7 1L1 4v4c0 3.5 3 5.5 6 6 3-.5 6-2.5 6-6V4L7 1z" fill="white" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="3" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Module icons ─────────────────────────────────────────────────────────────

function HematologyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <path d="M10 2.5v2.5M10 15v2.5M2.5 10H5M15 10h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function BiochemIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M7.5 3h5l1.5 4H6L7.5 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 7l-1.5 9.5h11L14 7" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.5 12.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CoagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2.5 10C4 7 6 13 8 10C10 7 12 13 14 10C15.5 7.5 17 10 17.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function UrineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2.5C10 2.5 5 9 5 13a5 5 0 0 0 10 0C15 9 10 2.5 10 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.5 14.5C7.5 15.6 8.6 16.3 10 16.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Module definitions ───────────────────────────────────────────────────────

interface ModuleDef {
  id: string;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  status: 'active' | 'soon';
  view?: View;
}

const MODULES: ModuleDef[] = [
  {
    id: 'hematology',
    name: 'Hematologia',
    tagline: 'Controle de Qualidade Interno · Levey-Jennings · Westgard',
    icon: <HematologyIcon />,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    status: 'active',
    view: 'analyzer',
  },
  {
    id: 'biochemistry',
    name: 'Bioquímica',
    tagline: 'CQI para química clínica e enzimologia',
    icon: <BiochemIcon />,
    iconBg: 'bg-sky-500/10',
    iconColor: 'text-sky-400/50',
    status: 'soon',
  },
  {
    id: 'coagulation',
    name: 'Coagulação',
    tagline: 'Monitoramento de hemostasia e anticoagulação',
    icon: <CoagIcon />,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400/50',
    status: 'soon',
  },
  {
    id: 'urinalysis',
    name: 'Urinálise',
    tagline: 'Controle de qualidade para urina rotina',
    icon: <UrineIcon />,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400/50',
    status: 'soon',
  },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
};

// ─── ModuleHub ────────────────────────────────────────────────────────────────

export function ModuleHub() {
  const { signOut } = useAuthFlow();
  const activeLab = useActiveLab();
  const isSuperAdmin = useIsSuperAdmin();
  const user = useUser();
  const role = useUserRole();
  const availableLabs = useAvailableLabs();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const [menuOpen, setMenuOpen] = useState(false);

  const firstName =
    user?.displayName?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'Você';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white flex flex-col transition-colors duration-300">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 sm:px-6 h-12 border-b border-slate-200 dark:border-white/[0.06] shrink-0">
        <img
          src="/assets/labclin-logo.png"
          alt="CQ Labclin"
          className="h-8 w-auto"
        />

        <p className="text-sm font-semibold text-slate-800 dark:text-white/85 flex-1 min-w-0 truncate">
          CQ Labclin
        </p>

        <ThemeToggle size="sm" />

        <div className="relative">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-200 dark:hover:bg-white/[0.07] transition-all"
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-40 w-52 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden py-1">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.07] mb-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-white/70 truncate">
                    {user?.displayName ?? user?.email}
                  </p>
                  {user?.displayName && (
                    <p className="text-xs text-slate-400 dark:text-white/35 truncate mt-0.5">
                      {user.email}
                    </p>
                  )}
                </div>

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => { setCurrentView('superadmin'); setMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
                  >
                    Painel Super Admin
                  </button>
                )}

                {availableLabs.length > 1 && (
                  <button
                    type="button"
                    disabled
                    className="w-full px-4 py-2 text-left text-sm text-slate-400 dark:text-white/25 cursor-not-allowed"
                  >
                    Trocar laboratório
                    <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-white/[0.05] px-1 py-0.5 rounded text-slate-400 dark:text-white/20">
                      em breve
                    </span>
                  </button>
                )}

                <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-1" />
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full px-4 py-2 text-left text-sm text-red-500/70 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                >
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

          {/* Greeting */}
          <div className="mb-10">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              Olá, {firstName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm text-slate-500 dark:text-white/40">
                {activeLab?.name ?? 'Nenhum laboratório'}
              </span>
              {role && (
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-white/25 font-medium">
                  {ROLE_LABELS[role] ?? role}
                </span>
              )}
            </div>
          </div>

          {/* Modules */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-white/20 mb-4">
              Módulos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODULES.map((mod) => (
                <ModuleCard key={mod.id} mod={mod} onNavigate={setCurrentView} />
              ))}
            </div>
          </section>

          {/* Platform tools */}
          <section className="mt-10">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-white/20 mb-3">
              Ferramentas
            </h2>
            <div className="flex flex-wrap gap-2">
              <ToolButton
                label="Importar bula PDF"
                onClick={() => setCurrentView('bulaparser')}
                icon={
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                    <rect x="1.5" y="0.5" width="8" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M4 3.5h3.5M4 6h3.5M4 8.5h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                }
              />
              <ToolButton
                label="Relatórios"
                onClick={() => setCurrentView('reports')}
                icon={
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                    <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M4 9.5V6.5M6.5 9.5V4M9 9.5V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                }
              />
              {isSuperAdmin && (
                <ToolButton
                  label="Super Admin"
                  onClick={() => setCurrentView('superadmin')}
                  icon={
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                      <path d="M6.5 1L2 3.5v3.5C2 9.8 4 11.5 6.5 12 9 11.5 11 9.8 11 7V3.5L6.5 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  }
                />
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// ─── ModuleCard ───────────────────────────────────────────────────────────────

interface ModuleCardProps {
  mod: ModuleDef;
  onNavigate: (view: View) => void;
}

function ModuleCard({ mod, onNavigate }: ModuleCardProps) {
  if (mod.status === 'soon') {
    return (
      <div className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.01] opacity-40 select-none">
        <div className={`w-8 h-8 rounded-lg ${mod.iconBg} ${mod.iconColor} flex items-center justify-center shrink-0`}>
          {mod.icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-white/55">{mod.name}</span>
            <span className="text-[10px] px-1.5 py-px rounded bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-white/25 font-medium shrink-0">
              Em breve
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-white/25 mt-0.5 leading-relaxed">{mod.tagline}</p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => mod.view && onNavigate(mod.view)}
      className="group flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-violet-400/50 dark:hover:border-violet-500/25 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all duration-150 text-left w-full"
    >
      <div className={`w-8 h-8 rounded-lg ${mod.iconBg} ${mod.iconColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150`}>
        {mod.icon}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-slate-800 dark:text-white/85">{mod.name}</p>
        <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5 leading-relaxed">{mod.tagline}</p>
      </div>
      <span className="shrink-0 mt-1 text-slate-300 dark:text-white/20 group-hover:text-violet-500 dark:group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all duration-150">
        <ArrowRight />
      </span>
    </button>
  );
}

// ─── ToolButton ───────────────────────────────────────────────────────────────

interface ToolButtonProps {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}

function ToolButton({ label, onClick, icon }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-white/40 bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.07] hover:text-slate-800 dark:hover:text-white/65 transition-all duration-150"
    >
      {icon}
      {label}
    </button>
  );
}
