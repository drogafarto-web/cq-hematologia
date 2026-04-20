import { useState, useEffect, useRef, useId } from 'react';
import type { UserRole } from '../../types';
import type { AdminLabRecord } from './services/userService';
import { createUserViaFunction, fetchAllLabs } from './services/userService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onCreated: () => void; // signal parent to reload user list
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 2l12 12M6.5 6.6A2 2 0 009.4 9.5M4.5 4.6C3.1 5.5 2 6.9 2 8c0 1.7 2.7 5 6 5a7 7 0 002.9-.7M6.7 3.1A7 7 0 0114 8c-.4 1-1.1 2-2 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 8c0-1.7 2.7-5 6-5s6 3.3 6 5-2.7 5-6 5-6-3.3-6-5z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M12 7A5 5 0 112.1 5M2 2v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Password generator ───────────────────────────────────────────────────────

function generatePassword(): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const syms   = '!@#$%';
  const pool   = upper + lower + digits + syms;

  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  // Guarantee at least one of each category
  const required = [rand(upper), rand(lower), rand(digits), rand(syms)];
  const rest = Array.from({ length: 8 }, () => rand(pool));
  return [...required, ...rest]
    .sort(() => Math.random() - 0.5)
    .join('');
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label, id, children, hint,
}: {
  label: string; id: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-white/50">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-white/25">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:border-white/25 transition-all disabled:opacity-40';

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateUserModal({ onClose, onCreated }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [assignToLab, setAssignToLab] = useState(false);
  const [labId, setLabId]             = useState('');
  const [role, setRole]               = useState<'admin' | 'member'>('member');
  const [labs, setLabs]               = useState<AdminLabRecord[]>([]);
  const [labsError, setLabsError]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId   = useId();
  const errorId   = useId();
  const nameId    = useId();
  const emailId   = useId();
  const pwdId     = useId();

  // Focus management
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', h);
    return () => dialog.removeEventListener('keydown', h);
  }, []);

  // Load labs for optional assignment — falha não impede criar usuário sem lab,
  // mas precisa ser visível: um admin confundir "não há labs" com "failed silently"
  // já aconteceu antes.
  useEffect(() => {
    fetchAllLabs()
      .then((result) => { setLabs(result); setLabsError(null); })
      .catch((err) => {
        console.error('[CreateUserModal] failed to load labs:', err);
        setLabsError(err instanceof Error ? err.message : 'Falha ao carregar laboratórios.');
      });
  }, []);

  function handleGenerate() {
    setPassword(generatePassword());
    setShowPwd(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password) return;

    setLoading(true);
    setError(null);
    try {
      await createUserViaFunction({
        displayName: displayName.trim(),
        email:       email.trim(),
        password,
        ...(assignToLab && labId ? { labId, role } : {}),
      });
      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar usuário.';
      // Strip Firebase Functions prefix if present
      setError(msg.replace(/^.*?:\s*/, ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        tabIndex={-1}
        className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col outline-none"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-white/90">
              Criar usuário
            </h2>
            <p className="text-xs text-white/35 mt-0.5">
              Criado via Firebase Admin SDK — sua sessão não é afetada
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">
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

            {/* Success */}
            {success && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Usuário criado com sucesso!
              </div>
            )}

            {/* Name */}
            <Field label="Nome completo" id={nameId}>
              <input
                id={nameId}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Maria Silva"
                required
                disabled={loading || success}
                className={inputCls}
              />
            </Field>

            {/* Email */}
            <Field label="E-mail" id={emailId}>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@laboratorio.com"
                required
                disabled={loading || success}
                className={inputCls}
              />
            </Field>

            {/* Password */}
            <Field
              label="Senha temporária"
              id={pwdId}
              hint="Mínimo 8 caracteres. Compartilhe com o usuário para o primeiro acesso."
            >
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    id={pwdId}
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    disabled={loading || success}
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <EyeIcon off={showPwd} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || success}
                  title="Gerar senha segura"
                  className="flex items-center gap-1.5 px-3 rounded-xl border border-white/10 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.05] disabled:opacity-40 transition-all shrink-0"
                >
                  <RefreshIcon />
                  Gerar
                </button>
              </div>
            </Field>

            {/* Optional lab assignment */}
            <div className="pt-1 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={assignToLab}
                  onChange={(e) => setAssignToLab(e.target.checked)}
                  disabled={loading || success}
                  className="w-4 h-4 rounded border border-white/20 bg-white/5 accent-violet-500"
                />
                <span className="text-sm text-white/60">Adicionar a um laboratório agora</span>
              </label>

              {assignToLab && (
                <div className="flex flex-col gap-2 pl-6">
                  {labsError && (
                    <p className="text-[11px] text-red-400/80">
                      Falha ao carregar laboratórios: {labsError}
                    </p>
                  )}
                  <div className="flex gap-2">
                  <select
                    value={labId}
                    onChange={(e) => setLabId(e.target.value)}
                    disabled={loading || success || !!labsError}
                    aria-label="Selecionar laboratório"
                    className="flex-1 min-w-0 text-xs bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-white/60 focus:outline-none focus:border-white/20 disabled:opacity-40"
                  >
                    <option value="">Selecionar laboratório…</option>
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                    disabled={loading || success}
                    aria-label="Papel"
                    className="text-xs bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-white/60 focus:outline-none focus:border-white/20 disabled:opacity-40 shrink-0"
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || success || !displayName.trim() || !email.trim() || password.length < 8}
              className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium text-white/80 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" /> Criando…</>
                : 'Criar usuário'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
