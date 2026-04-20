import { useState, useEffect, useRef, useCallback, useId } from 'react';
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

function UserXIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 14c0-3 2-5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 9l4 4M15 9l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 14c0-3 2-5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M11 10l2 2 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
};

const ROLE_STYLE: Record<UserRole, string> = {
  owner: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  admin: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  member: 'bg-white/10 text-white/50 border-white/10',
};

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: LabMember;
  isSelf: boolean;
  isOwner: boolean;
  busy: boolean;
  onRoleChange: (member: LabMember, role: UserRole) => void;
  onToggleActive: (member: LabMember) => void;
}

function MemberRow({
  member,
  isSelf,
  isOwner,
  busy,
  onRoleChange,
  onToggleActive,
}: MemberRowProps) {
  // Fix #11: safe fallback prevents crash when both fields are empty
  const displayName = member.displayName || member.email || '?';
  const avatarInitial = displayName[0].toUpperCase();

  return (
    // Fix #8: <li> instead of <div> for proper list semantics
    <li
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        member.active
          ? 'bg-white/[0.03] border-white/[0.07]'
          : 'bg-white/[0.01] border-white/[0.04] opacity-50'
      }`}
    >
      {/* Fix #9: avatar is decorative — hidden from AT since name is already in the row */}
      <div
        aria-hidden="true"
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold select-none ${
          member.active ? 'bg-white/10 text-white/70' : 'bg-white/5 text-white/30'
        }`}
      >
        {avatarInitial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-white/80 truncate">{displayName}</p>
          {/* Fix #15: "você" is decorative — reading "John Doe você" is redundant noise */}
          {isSelf && (
            <span
              aria-hidden="true"
              className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full"
            >
              você
            </span>
          )}
        </div>
        {/* Fix #17: text-white/40 minimum for contrast — /35 fails WCAG AA */}
        <p className="text-xs text-white/40 truncate">{member.email}</p>
      </div>

      {/* Role badge / selector */}
      {isOwner || isSelf ? (
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${ROLE_STYLE[member.role]}`}
        >
          {ROLE_LABEL[member.role]}
        </span>
      ) : (
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member, e.target.value as UserRole)}
          disabled={busy}
          // aria-label includes member name to disambiguate when multiple rows exist
          aria-label={`Papel de ${displayName}`}
          className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/60 focus:outline-none focus:border-white/20 disabled:opacity-40 shrink-0"
        >
          <option value="admin">Admin</option>
          <option value="member">Membro</option>
        </select>
      )}

      {/* Toggle active */}
      {!isOwner && !isSelf && (
        // Fix #7: aria-label instead of title — title is not reliably announced on focus
        // Fix #13: explicit type="button" to prevent accidental form submission
        <button
          type="button"
          onClick={() => onToggleActive(member)}
          disabled={busy}
          aria-label={
            member.active
              ? `Remover acesso de ${displayName}`
              : `Restaurar acesso de ${displayName}`
          }
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0 ${
            member.active
              ? 'text-white/25 hover:text-red-400 hover:bg-red-500/10'
              : 'text-white/25 hover:text-emerald-400 hover:bg-emerald-500/10'
          }`}
        >
          {member.active ? <UserXIcon /> : <UserCheckIcon />}
        </button>
      )}
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UserManagementModal({ labId, labName, currentUserUid, onClose }: Props) {
  const [members, setMembers] = useState<LabMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Fix #18: stable IDs for aria-labelledby and aria-describedby wiring
  const titleId = useId();
  const errorId = useId();

  // Fix #2: move focus into dialog on open; restore to trigger element on close
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  // Fix #4: Escape key closes the modal — primary keyboard dismissal mechanism
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fix #3: focus trap — Tab and Shift+Tab are contained within the dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const focusable = dialog!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fix #12: cancellation flag prevents state updates on unmounted component.
  // Load-on-mount pattern canônico — setLoading(true) síncrono é intencional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    getLabMembers(labId)
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch(() => {
        if (!cancelled) setError('Erro ao carregar membros.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [labId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fix #10: clear stale error before each new action
  const handleRoleChange = useCallback(
    async (member: LabMember, role: UserRole) => {
      if (member.role === role) return;
      setActionId(member.uid);
      setError(null);
      try {
        await updateMemberRole(labId, member.uid, role);
        setMembers((prev) => prev.map((m) => (m.uid === member.uid ? { ...m, role } : m)));
      } catch {
        setError('Erro ao atualizar papel. Tente novamente.');
      } finally {
        setActionId(null);
      }
    },
    [labId],
  );

  const handleToggleActive = useCallback(
    async (member: LabMember) => {
      setActionId(member.uid);
      setError(null);
      try {
        if (member.active) {
          await deactivateMember(labId, member.uid);
        } else {
          await reactivateMember(labId, member.uid, member.role);
        }
        setMembers((prev) =>
          prev.map((m) => (m.uid === member.uid ? { ...m, active: !m.active } : m)),
        );
      } catch {
        setError('Erro ao atualizar membro. Tente novamente.');
      } finally {
        setActionId(null);
      }
    },
    [labId],
  );

  return (
    // Backdrop: click-outside-to-close; no ARIA role (the dialog inside owns semantics)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/*
        Fix #1: role="dialog" + aria-modal="true" announces the dialog to AT
        Fix #2: tabIndex={-1} allows programmatic focus without entering tab order
        Fix #18: aria-labelledby wired to <h2> id for accessible name
        outline-none prevents visible focus ring on the container itself
      */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        tabIndex={-1}
        className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] outline-none"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div>
            {/* Fix #18: id wired to aria-labelledby on the dialog */}
            <h2 id={titleId} className="text-base font-semibold text-white/90">
              Membros
            </h2>
            <p className="text-xs text-white/40 mt-0.5">{labName}</p>
          </div>
          {/* Fix #13: explicit type="button" */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all"
          >
            {/* Fix #16: explicit aria-hidden="true" and focusable="false" */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {/* Fix #5: role="alert" + aria-live causes screen readers to announce errors immediately */}
          {error && (
            <p
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-3"
            >
              {error}
            </p>
          )}

          {loading ? (
            // Fix #6: role="status" + aria-live announces loading state to screen readers
            <div
              role="status"
              aria-live="polite"
              aria-label="Carregando membros"
              className="flex items-center gap-2 text-white/40 text-sm py-8 justify-center"
            >
              <span
                aria-hidden="true"
                className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full inline-block"
              />
              Carregando...
            </div>
          ) : members.length === 0 ? (
            // Fix #17: text-white/50 for acceptable contrast
            <p className="text-sm text-white/50 text-center py-8">Nenhum membro.</p>
          ) : (
            // Fix #8: <ul> provides list semantics — screen readers announce item count
            <ul
              aria-label="Membros do laboratório"
              aria-live="polite"
              aria-busy={actionId !== null ? 'true' : 'false'}
              className="space-y-2 list-none p-0 m-0"
            >
              {members.map((member) => (
                // Fix #14: MemberRow extracted — parent stays clean, rows are testable in isolation
                <MemberRow
                  key={member.uid}
                  member={member}
                  isSelf={member.uid === currentUserUid}
                  isOwner={member.role === 'owner'}
                  busy={actionId === member.uid}
                  onRoleChange={handleRoleChange}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.07] shrink-0">
          {/* Fix #13: explicit type="button" */}
          <button
            type="button"
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
