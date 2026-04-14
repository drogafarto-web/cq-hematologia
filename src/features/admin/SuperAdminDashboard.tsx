import { useState, useEffect, useCallback } from 'react';
import { AccessRequestsTab } from './AccessRequestsTab';
import { LabManagementTab } from './LabManagementTab';
import { ManageUserModal } from './ManageUserModal';
import { CreateUserModal } from './CreateUserModal';
import {
  fetchSuperAdminStats,
  fetchAllUsers,
  type SuperAdminStats,
  type AdminUserRecord,
} from './services/userService';
import { useUser } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

function UsersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
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

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1L1 4v4c0 3.5 3 5.5 6 6 3-.5 6-2.5 6-6V4L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
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

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const currentUser                         = useUser();
  const [users, setUsers]                   = useState<AdminUserRecord[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [search, setSearch]                 = useState('');
  const [selectedUser, setSelectedUser]     = useState<AdminUserRecord | null>(null);
  const [showCreate, setShowCreate]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchAllUsers());
    } catch {
      setError('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleUserUpdated(updated: Partial<AdminUserRecord> & { uid: string }) {
    setUsers((prev) =>
      prev.map((u) => u.uid === updated.uid ? { ...u, ...updated } : u)
    );
    setSelectedUser((prev) =>
      prev && prev.uid === updated.uid ? { ...prev, ...updated } : prev
    );
  }

  function handleUserDeleted(uid: string) {
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
    setSelectedUser(null);
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.11] border border-white/10 text-sm text-white/70 hover:text-white/90 transition-all shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Criar usuário
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-8">
            <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full inline-block" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-white/25">
            <UsersIcon size={32} />
            <p className="text-sm">{search ? 'Nenhum resultado' : 'Nenhum usuário'}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((user) => {
              const isSelf = user.uid === currentUser?.uid;
              const displayName = user.displayName || user.email;
              return (
                <button
                  key={user.uid}
                  type="button"
                  onClick={() => setSelectedUser(user)}
                  className="w-full text-left px-4 py-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.12] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold select-none ${
                        user.disabled
                          ? 'bg-white/[0.04] text-white/20'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {displayName[0]?.toUpperCase() ?? '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium truncate ${user.disabled ? 'text-white/35' : 'text-white/90'}`}>
                          {displayName}
                        </p>
                        {isSelf && (
                          <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full shrink-0">
                            você
                          </span>
                        )}
                        {user.disabled && (
                          <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                            Suspenso
                          </span>
                        )}
                        {user.isSuperAdmin && (
                          <span className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/15 border border-violet-500/25 px-1.5 py-0.5 rounded-full shrink-0">
                            <ShieldIcon />
                            Super Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>

                    {/* Lab count */}
                    {user.labIds.length > 0 && (
                      <span className="text-xs text-white/25 shrink-0">
                        {user.labIds.length} lab{user.labIds.length !== 1 ? 's' : ''}
                      </span>
                    )}

                    {/* Chevron */}
                    <svg
                      width="14" height="14" viewBox="0 0 14 14" fill="none"
                      aria-hidden
                      className="text-white/20 group-hover:text-white/40 transition-colors shrink-0"
                    >
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedUser && currentUser && (
        <ManageUserModal
          user={selectedUser}
          currentUserUid={currentUser.uid}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={handleUserUpdated}
          onUserDeleted={handleUserDeleted}
        />
      )}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'requests' | 'labs' | 'users';

const TABS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Solicitações' },
  { id: 'labs',     label: 'Laboratórios' },
  { id: 'users',    label: 'Usuários' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SuperAdminDashboard() {
  const user                      = useUser();
  const setCurrentView            = useAppStore((s) => s.setCurrentView);
  const [tab, setTab]             = useState<Tab>('requests');
  const [stats, setStats]         = useState<SuperAdminStats | null>(null);

  const refreshStats = useCallback(() => {
    fetchSuperAdminStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  // Refresh stats whenever the tab changes so counts stay accurate
  useEffect(() => { refreshStats(); }, [tab, refreshStats]);

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
          {tab === 'users'    && <UsersTab />}
        </div>
      </main>
    </div>
  );
}
