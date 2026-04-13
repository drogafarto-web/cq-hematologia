import { useState, useEffect } from 'react';
import { AccessRequestsTab } from './AccessRequestsTab';
import { LabManagementTab } from './LabManagementTab';
import { fetchSuperAdminStats, type SuperAdminStats } from './services/superAdminService';
import { useUser } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 18c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="15" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M19 17c0-2.5-1.6-4.3-4-4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function BeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M7 3v6.5L3 15a1.5 1.5 0 001.4 2h11.2A1.5 1.5 0 0017 15l-4-5.5V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 3h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 5l3 3-3 3M14 8H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  accent?: string;
}

function StatCard({ icon, label, value, accent }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent ?? 'bg-white/[0.07] text-white/50'}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-white/90 leading-none">
          {value === null ? '–' : value}
        </p>
        <p className="text-xs text-white/40 mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'requests' | 'labs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Solicitações' },
  { id: 'labs',     label: 'Laboratórios' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SuperAdminDashboard() {
  const user                      = useUser();
  const setCurrentView            = useAppStore((s) => s.setCurrentView);
  const [tab, setTab]             = useState<Tab>('requests');
  const [stats, setStats]         = useState<SuperAdminStats | null>(null);

  useEffect(() => {
    fetchSuperAdminStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      {/* Top bar */}
      <header className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L1 4v4c0 3.5 3 5.5 6 6 3-0.5 6-2.5 6-6V4L7 1z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90 leading-none">Super Admin</p>
            <p className="text-xs text-white/35 mt-0.5 leading-none">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={() => setCurrentView('analyzer')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all"
        >
          <SignOutIcon />
          Sair do painel
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<UsersIcon />}
            label="Usuários"
            value={stats?.totalUsers ?? null}
            accent="bg-blue-500/15 text-blue-400"
          />
          <StatCard
            icon={<BeakerIcon />}
            label="Laboratórios"
            value={stats?.totalLabs ?? null}
            accent="bg-emerald-500/15 text-emerald-400"
          />
          <StatCard
            icon={<ClockIcon />}
            label="Pendentes"
            value={stats?.pendingRequests ?? null}
            accent={
              (stats?.pendingRequests ?? 0) > 0
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-white/[0.07] text-white/30'
            }
          />
        </div>

        {/* Tab navigation */}
        <div>
          <div className="flex border-b border-white/[0.07] mb-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium transition-all relative ${
                  tab === t.id
                    ? 'text-white/90'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-white/60 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {tab === 'requests' && <AccessRequestsTab />}
          {tab === 'labs'     && <LabManagementTab />}
        </div>
      </main>
    </div>
  );
}
