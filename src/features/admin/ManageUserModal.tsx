import { useState, useEffect, useRef, useId } from 'react';
import type { UserRole } from '../../types';
import type { AdminUserRecord, AdminLabRecord } from './services/userService';
import {
  setSuperAdmin,
  setUserDisabledViaFunction,
  addUserToLab,
  updateUserLabRole,
  removeUserFromLab,
  deleteUserViaFunction,
  fetchAllLabs,
} from './services/userService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  user: AdminUserRecord;
  currentUserUid: string;
  onClose: () => void;
  onUserUpdated: (updated: Partial<AdminUserRecord> & { uid: string }) => void;
  onUserDeleted?: (uid: string) => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1L1 4v4c0 3.5 3 5.5 6 6 3-.5 6-2.5 6-6V4L7 1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.8 3.8l8.4 8.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 8l2 2 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManageUserModal({
  user,
  currentUserUid,
  onClose,
  onUserUpdated,
  onUserDeleted,
}: Props) {
  const isSelf = user.uid === currentUserUid;

  // Local mirror so UI reacts instantly without prop drilling
  const [local, setLocal] = useState<AdminUserRecord>(user);
  const [allLabs, setAllLabs] = useState<AdminLabRecord[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);

  // Action state
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "Add to lab" form state
  const [addLabId, setAddLabId] = useState('');
  const [addRole, setAddRole] = useState<'admin' | 'member'>('member');

  // Delete confirmation state: null → step1 → step2
  const [deleteStep, setDeleteStep] = useState<null | 'confirm' | 'type-email'>(null);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');

  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const errorId = useId();

  // Focus management
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // Escape closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', h);
    return () => panel.removeEventListener('keydown', h);
  }, []);

  // Load all labs once
  useEffect(() => {
    let cancelled = false;
    fetchAllLabs()
      .then((labs) => {
        if (!cancelled) setAllLabs(labs);
      })
      .catch(() => {
        if (!cancelled) setError('Erro ao carregar laboratórios.');
      })
      .finally(() => {
        if (!cancelled) setLabsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset "add to lab" select when user membership changes.
  // Padrão canônico de "clear controlled input ao trocar entidade de referência".
  // Alternativas (key-remount, reducer) são mais custosas e não agregam.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddLabId('');
  }, [local.labIds]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function patch(updates: Partial<AdminUserRecord>) {
    const next = { ...local, ...updates };
    setLocal(next);
    onUserUpdated({ uid: local.uid, ...updates });
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusyAction(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setBusyAction(null);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleToggleSuspend() {
    const next = !local.disabled;
    await run('suspend', async () => {
      await setUserDisabledViaFunction(local.uid, next);
      patch({ disabled: next });
    });
  }

  async function handleToggleSuperAdmin() {
    const next = !local.isSuperAdmin;
    await run('superadmin', async () => {
      await setSuperAdmin(local.uid, next);
      patch({ isSuperAdmin: next });
    });
  }

  async function handleRoleChange(labId: string, role: UserRole) {
    await run(`role-${labId}`, async () => {
      await updateUserLabRole(local.uid, labId, role);
      patch({ roles: { ...local.roles, [labId]: role } });
    });
  }

  async function handleRemoveFromLab(labId: string) {
    await run(`remove-${labId}`, async () => {
      await removeUserFromLab(labId, local.uid);
      patch({
        labIds: local.labIds.filter((id) => id !== labId),
        roles: Object.fromEntries(Object.entries(local.roles).filter(([k]) => k !== labId)),
      });
    });
  }

  async function handleAddToLab() {
    if (!addLabId) return;
    await run(`add-${addLabId}`, async () => {
      await addUserToLab(local.uid, addLabId, addRole);
      patch({
        labIds: [...local.labIds, addLabId],
        roles: { ...local.roles, [addLabId]: addRole },
      });
    });
  }

  async function handleDeleteConfirmed() {
    await run('delete', async () => {
      await deleteUserViaFunction(local.uid);
      onUserDeleted?.(local.uid);
      onClose();
    });
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const labsAvailableToAdd = allLabs.filter((l) => !local.labIds.includes(l.id));
  const displayName = local.displayName || local.email;
  const initial = displayName[0]?.toUpperCase() ?? '?';

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Clickable backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Side panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        tabIndex={-1}
        className="w-full max-w-md bg-[#111111] border-l border-white/[0.08] flex flex-col overflow-hidden shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-white/[0.07] shrink-0">
          <div className="flex items-start justify-between mb-5">
            <h2
              id={titleId}
              className="text-sm font-semibold text-white/60 uppercase tracking-wider"
            >
              Gerenciar usuário
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="p-1.5 -mt-1 -mr-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all"
            >
              <XIcon />
            </button>
          </div>

          {/* User identity */}
          <div className="flex items-center gap-4">
            <div
              aria-hidden
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-xl font-semibold select-none ${
                local.disabled
                  ? 'bg-white/[0.04] text-white/20'
                  : 'bg-gradient-to-br from-white/10 to-white/5 text-white/70'
              }`}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-semibold text-white/90 truncate">{displayName}</p>
                {local.disabled && (
                  <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                    <BanIcon />
                    Suspenso
                  </span>
                )}
                {local.isSuperAdmin && (
                  <span className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/15 border border-violet-500/25 px-1.5 py-0.5 rounded-full shrink-0">
                    <ShieldIcon />
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-white/40 truncate mt-0.5">{local.email}</p>
              {local.createdAt && (
                <p className="text-xs text-white/25 mt-1">
                  Criado em {formatDate(local.createdAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* Error */}
          {error && (
            <p
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
            >
              {error}
            </p>
          )}

          {/* ── Account control ─────────────────────────────────────────── */}
          <Section title="Conta">
            <div className="space-y-2">
              {/* Suspend / Enable */}
              <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div>
                  <p className="text-sm font-medium text-white/80">
                    {local.disabled ? 'Conta suspensa' : 'Acesso ativo'}
                  </p>
                  <p className="text-xs text-white/35 mt-0.5">
                    {local.disabled
                      ? 'Reabilitar devolve acesso imediatamente'
                      : 'Suspender revoga todos os tokens ativos'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSuspend}
                  disabled={isSelf || busyAction === 'suspend'}
                  title={isSelf ? 'Você não pode suspender sua própria conta' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 shrink-0 ${
                    local.disabled
                      ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                  }`}
                >
                  {busyAction === 'suspend' ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : local.disabled ? (
                    <CheckCircleIcon />
                  ) : (
                    <BanIcon />
                  )}
                  {local.disabled ? 'Reabilitar' : 'Suspender'}
                </button>
              </div>

              {/* Super Admin toggle */}
              <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div>
                  <p className="text-sm font-medium text-white/80">Super Admin</p>
                  <p className="text-xs text-white/35 mt-0.5">Acesso irrestrito a todos os dados</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSuperAdmin}
                  disabled={isSelf || busyAction === 'superadmin'}
                  title={isSelf ? 'Você não pode alterar seu próprio papel' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 shrink-0 ${
                    local.isSuperAdmin
                      ? 'text-violet-400 bg-violet-500/15 hover:bg-violet-500/25'
                      : 'text-white/40 bg-white/[0.06] hover:bg-white/[0.1]'
                  }`}
                >
                  {busyAction === 'superadmin' ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ShieldIcon />
                  )}
                  {local.isSuperAdmin ? 'Revogar' : 'Promover'}
                </button>
              </div>

              {/* Delete user */}
              {!isSelf && (
                <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-red-500/[0.04] border border-red-500/15">
                  <div>
                    <p className="text-sm font-medium text-red-400/80">Deletar conta</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      Permanente — remove Auth + Firestore
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteStep('confirm')}
                    disabled={!!busyAction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 transition-all shrink-0"
                  >
                    <TrashIcon />
                    Deletar
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* ── Lab memberships ─────────────────────────────────────────── */}
          <Section title="Laboratórios">
            {/* Current memberships */}
            {local.labIds.length === 0 ? (
              <p className="text-sm text-white/25 text-center py-4">Sem laboratório associado</p>
            ) : (
              <ul className="space-y-1.5 list-none p-0 m-0">
                {local.labIds.map((labId) => {
                  const lab = allLabs.find((l) => l.id === labId);
                  const currentRole = local.roles[labId] as UserRole | undefined;
                  const busyKey = `role-${labId}`;
                  const removeKey = `remove-${labId}`;
                  const isBusy = busyAction === busyKey || busyAction === removeKey;

                  return (
                    <li
                      key={labId}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07]"
                    >
                      {/* Lab name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">
                          {lab?.name ?? (
                            <span className="font-mono text-white/30">{labId.slice(0, 8)}…</span>
                          )}
                        </p>
                      </div>

                      {/* Role — Super Admin pode alterar qualquer cargo, inclusive rebaixar owner */}
                      <select
                        value={currentRole ?? 'member'}
                        onChange={(e) => handleRoleChange(labId, e.target.value as UserRole)}
                        disabled={isBusy}
                        aria-label={`Papel em ${lab?.name ?? labId}`}
                        className="text-xs bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1 text-white/60 focus:outline-none focus:border-white/20 disabled:opacity-40 shrink-0"
                      >
                        <option value="owner" className="bg-[#111111] text-white/90">
                          Proprietário
                        </option>
                        <option value="admin" className="bg-[#111111] text-white/90">
                          Admin
                        </option>
                        <option value="member" className="bg-[#111111] text-white/90">
                          Membro
                        </option>
                      </select>

                      {/* Remove — Super Admin pode remover qualquer membro, inclusive owner */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromLab(labId)}
                        disabled={isBusy}
                        aria-label={`Remover de ${lab?.name ?? labId}`}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors shrink-0"
                      >
                        {busyAction === removeKey ? (
                          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          <XSmallIcon />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Add to lab */}
            {!labsLoading && labsAvailableToAdd.length === 0 && (
              <p className="text-xs text-white/25 text-center py-2 italic">
                {allLabs.length === 0
                  ? 'Nenhum laboratório cadastrado no sistema'
                  : 'Usuário já participa de todos os laboratórios'}
              </p>
            )}

            {!labsLoading && labsAvailableToAdd.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={addLabId}
                  onChange={(e) => setAddLabId(e.target.value)}
                  disabled={!!busyAction}
                  aria-label="Selecionar laboratório"
                  className="flex-1 min-w-0 text-xs bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-2 text-white/60 focus:outline-none focus:border-white/20 disabled:opacity-40"
                >
                  <option value="" className="bg-[#111111] text-white/90">
                    Selecionar lab…
                  </option>
                  {labsAvailableToAdd.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#111111] text-white/90">
                      {l.name}
                    </option>
                  ))}
                </select>

                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as 'admin' | 'member')}
                  disabled={!!busyAction || !addLabId}
                  aria-label="Papel no laboratório"
                  className="text-xs bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white/60 focus:outline-none focus:border-white/20 disabled:opacity-40 shrink-0"
                >
                  <option value="member" className="bg-[#111111] text-white/90">
                    Membro
                  </option>
                  <option value="admin" className="bg-[#111111] text-white/90">
                    Admin
                  </option>
                </select>

                <button
                  type="button"
                  onClick={handleAddToLab}
                  disabled={!addLabId || !!busyAction}
                  aria-label="Adicionar ao laboratório"
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                >
                  {busyAction === `add-${addLabId}` ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PlusIcon />
                  )}
                  Adicionar
                </button>
              </div>
            )}

            {labsLoading && (
              <div className="flex items-center gap-2 text-white/25 text-xs py-2">
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                Carregando labs…
              </div>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.07] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* ── Delete confirmation — Step 1 ──────────────────────────────── */}
      {deleteStep === 'confirm' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#161616] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                <TrashIcon />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90">Deletar usuário?</p>
                <p className="text-xs text-white/40 mt-0.5">Esta ação é irreversível.</p>
              </div>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              A conta de <span className="text-white/80 font-medium">{local.email}</span> será
              permanentemente removida do Firebase Auth e do Firestore, incluindo todas as
              associações de laboratório.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteStep(null)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteEmailInput('');
                  setDeleteStep('type-email');
                }}
                className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-sm text-red-400 hover:bg-red-500/25 transition-all"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation — Step 2 (type email) ─────────────────── */}
      {deleteStep === 'type-email' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#161616] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <p className="text-sm font-semibold text-white/90">Confirme digitando o e-mail</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Digite <span className="font-mono text-white/70">{local.email}</span> para confirmar.
            </p>
            <input
              type="email"
              value={deleteEmailInput}
              onChange={(e) => setDeleteEmailInput(e.target.value)}
              placeholder={local.email}
              autoFocus
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/40 transition-all"
            />
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteStep(null);
                  setError(null);
                }}
                className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={deleteEmailInput.trim() !== local.email || busyAction === 'delete'}
                className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-sm text-red-400 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {busyAction === 'delete' ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <TrashIcon />
                )}
                Deletar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
