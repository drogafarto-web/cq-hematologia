import { useState, useEffect } from 'react';
import type { UserRole } from '../../types';
import {
  getLabMembers,
  updateMemberRole,
  deactivateMember,
  reactivateMember,
  type LabMember,
} from './services/labAdminService';

interface Props {
  labId: string;
  labName: string;
  currentUserUid: string;
  onClose: () => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2L3 4.5V8c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4.5L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function UserXIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 14c0-3 2-5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 9l4 4M15 9l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 14c0-3 2-5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 10l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  owner:  'Proprietário',
  admin:  'Admin',
  member: 'Membro',
};

const ROLE_STYLE: Record<UserRole, string> = {
  owner:  'bg-violet-500/15 text-violet-300 border-violet-500/25',
  admin:  'bg-blue-500/15 text-blue-300 border-blue-500/25',
  member: 'bg-white/10 text-white/50 border-white/10',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function UserManagementModal({ labId, labName, currentUserUid, onClose }: Props) {
  const [members, setMembers]   = useState<LabMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    getLabMembers(labId)
      .then(setMembers)
      .catch(() => setError('Erro ao carregar membros.'))
      .finally(() => setLoading(false));
  }, [labId]);

  async function handleRoleChange(member: LabMember, role: UserRole) {
    if (member.role === role) return;
    setActionId(member.uid);
    try {
      await updateMemberRole(labId, member.uid, role);
      setMembers((prev) =>
        prev.map((m) => (m.uid === member.uid ? { ...m, role } : m))
      );
    } catch {
      setError('Erro ao atualizar papel. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  async function handleToggleActive(member: LabMember) {
    setActionId(member.uid);
    try {
      if (member.active) {
        await deactivateMember(labId, member.uid);
      } else {
        await reactivateMember(labId, member.uid, member.role);
      }
      setMembers((prev) =>
        prev.map((m) => (m.uid === member.uid ? { ...m, active: !m.active } : m))
      );
    } catch {
      setError('Erro ao atualizar membro. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white/90">Membros</h2>
            <p className="text-xs text-white/40 mt-0.5">{labName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-3">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-white/40 text-sm py-8 justify-center">
              <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full inline-block" />
              Carregando...
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-8">Nenhum membro.</p>
          ) : (
            members.map((member) => {
              const isSelf = member.uid === currentUserUid;
              const isOwner = member.role === 'owner';
              const busy = actionId === member.uid;

              return (
                <div
                  key={member.uid}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    member.active
                      ? 'bg-white/[0.03] border-white/[0.07]'
                      : 'bg-white/[0.01] border-white/[0.04] opacity-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                    member.active ? 'bg-white/10 text-white/70' : 'bg-white/5 text-white/30'
                  }`}>
                    {(member.displayName || member.email)[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white/80 truncate">{member.displayName}</p>
                      {isSelf && (
                        <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">você</span>
                      )}
                    </div>
                    <p className="text-xs text-white/35 truncate">{member.email}</p>
                  </div>

                  {/* Role badge / selector */}
                  {isOwner || isSelf ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${ROLE_STYLE[member.role]}`}>
                      {ROLE_LABEL[member.role]}
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                      disabled={busy}
                      className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/60 focus:outline-none focus:border-white/20 disabled:opacity-40 shrink-0"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Membro</option>
                    </select>
                  )}

                  {/* Toggle active */}
                  {!isOwner && !isSelf && (
                    <button
                      onClick={() => handleToggleActive(member)}
                      disabled={busy}
                      title={member.active ? 'Remover acesso' : 'Restaurar acesso'}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0 ${
                        member.active
                          ? 'text-white/25 hover:text-red-400 hover:bg-red-500/10'
                          : 'text-white/25 hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {member.active ? <UserXIcon /> : <UserCheckIcon />}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.07] shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
