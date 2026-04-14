import { useState } from 'react';
import { z } from 'zod';
import { FirebaseError } from 'firebase/app';
import { signIn, sendPasswordReset } from './services/authService';
import { useAuthFlow } from './hooks/useAuthFlow';
import { ThemeToggle } from '../../shared/components/ui/ThemeToggle';
import {
  APP_NAME,
  APP_SUBTITLE,
  APP_TAGLINE,
  APP_MODULES_PREVIEW,
  APP_COPYRIGHT_ENTITY,
} from '../../constants/app';

// ─── Validation ───────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
});

const resetSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

// ─── Firebase auth error messages ────────────────────────────────────────────

function authErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) return 'Não foi possível acessar. Tente novamente.';
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail ou senha inválidos.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-disabled':
      return 'Conta suspensa. Entre em contato com o administrador.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos.';
    case 'auth/network-request-failed':
      return 'Erro de conexão. Verifique sua internet.';
    default:
      return 'Não foi possível acessar. Tente novamente.';
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function LogoMark({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const dim  = size === 'lg' ? 'w-14 h-14' : 'w-9 h-9';
  const icon = size === 'lg' ? 26 : 17;
  return (
    <div
      className={`${dim} rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 flex-shrink-0`}
      aria-hidden
    >
      <svg width={icon} height={icon} viewBox="0 0 22 22" fill="none">
        <path d="M11 2L3 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6L11 2z" fill="white" fillOpacity="0.9" />
        <path d="M8 11l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// SVG trust icons — no emoji, sharp & professional on any DPI
function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-violet-400/60 flex-shrink-0">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-violet-400/60 flex-shrink-0">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function IconBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-violet-400/60 flex-shrink-0">
      <circle cx="12" cy="8" r="6"/>
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  );
}

// ─── Left panel ───────────────────────────────────────────────────────────────

function TrustPanel() {
  return (
    <div
      className="lj-grid-bg hidden lg:flex flex-col justify-between h-full px-12 py-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#0d0d14] dark:to-[#110e1c] border-r border-slate-300/60 dark:border-white/[0.06]"
    >
      {/* Brand */}
      <div>
        <div className="flex items-center gap-3 mb-16">
          <LogoMark size="lg" />
          <div>
            <p className="text-slate-900 dark:text-white/90 font-semibold text-lg tracking-tight leading-none">
              {APP_NAME}
            </p>
            <p className="text-slate-500 dark:text-white/35 text-xs mt-0.5 tracking-wide">{APP_SUBTITLE}</p>
          </div>
        </div>

        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white/90 leading-tight tracking-tight">
          {APP_TAGLINE}.<br />
          <span className="text-violet-600 dark:text-violet-400">Precisão em cada análise.</span>
        </h2>
        <p className="text-slate-500 dark:text-white/40 text-sm mt-4 leading-relaxed max-w-xs">
          Extração de dados via IA, gráficos de Levey-Jennings e Regras de Westgard em tempo real.
        </p>

        {/* Module pills */}
        <div className="flex items-center gap-2 mt-6 flex-wrap">
          {APP_MODULES_PREVIEW.split(' · ').map((mod, i) => (
            <span
              key={mod}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium tracking-wide ${
                i === 0
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300/80'
                  : 'border-slate-300 dark:border-white/[0.08] bg-slate-200/60 dark:bg-white/[0.03] text-slate-400 dark:text-white/25'
              }`}
            >
              {mod}
            </span>
          ))}
        </div>
      </div>

      {/* Trust badges */}
      <div className="space-y-3">
        <div className="h-px bg-slate-300/60 dark:bg-white/[0.06] mb-6" />
        {[
          { Icon: IconLock,   text: 'Dados armazenados no Brasil (LGPD)' },
          { Icon: IconShield, text: 'Conexão criptografada (TLS 1.3)' },
          { Icon: IconBadge,  text: 'Uso exclusivo por profissionais habilitados' },
        ].map(({ Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <Icon />
            <span className="text-xs text-slate-500 dark:text-white/35 leading-relaxed">{text}</span>
          </div>
        ))}
        <div className="pt-4">
          <p className="text-xs text-slate-400 dark:text-white/20">
            {APP_COPYRIGHT_ENTITY} © {new Date().getFullYear()} · LGPD · Política de Privacidade
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Forgot Password Modal ────────────────────────────────────────────────────

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = resetSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(parsed.data.email);
      setSent(true);
    } catch {
      // Firebase doesn't reveal whether an email exists — always show success
      // to prevent user enumeration attacks.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Redefinir senha"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#14131c] border border-slate-200 dark:border-white/[0.09] rounded-2xl p-6 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-slate-900 dark:text-white/90 font-semibold text-base">Redefinir senha</h3>
            <p className="text-xs text-slate-500 dark:text-white/35 mt-1">
              {sent ? 'E-mail enviado' : 'Informe seu e-mail cadastrado'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60 transition-colors ml-4"
            aria-label="Fechar modal de redefinição de senha"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div
              role="status"
              className="bg-emerald-500/[0.08] border border-emerald-500/[0.2] rounded-xl px-4 py-3.5 text-sm text-emerald-600 dark:text-emerald-400/90 leading-relaxed"
            >
              Verifique sua caixa de entrada — enviamos um link de redefinição.{' '}
              <span className="text-slate-400 dark:text-white/40">(Verifique também o spam)</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.09] text-slate-700 dark:text-white/70 text-sm transition-all"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-3"
            noValidate
            aria-label="Formulário de redefinição de senha"
          >
            <div>
              <label htmlFor="reset-email" className="block text-xs font-medium text-slate-600 dark:text-white/45 mb-1.5">
                E-mail profissional
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-300 dark:border-white/[0.09] text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/60 focus:bg-white dark:focus:bg-white/[0.08] disabled:opacity-40 transition-all"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-xs text-red-600 dark:text-red-400/90 bg-red-500/[0.08] border border-red-500/[0.15] rounded-lg px-3 py-2.5"
              >
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.09] text-slate-600 dark:text-white/60 text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50 transition-all"
              >
                {loading ? <><Spinner /> Enviando…</> : 'Enviar link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LoginScreenProps {
  /**
   * Optional side-effect callback fired after a successful authentication event.
   * The AuthWrapper state machine handles all actual routing; this prop exists
   * for callers that need to run a side-effect on login (analytics, toasts, etc.)
   * without duplicating auth logic.
   */
  onSuccessRedirect?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginScreen({ onSuccessRedirect: _onSuccessRedirect }: LoginScreenProps = {}) {
  const { error: globalError, handleGoogleSignIn, isLoading: globalLoading } = useAuthFlow();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError,   setLocalError]   = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const displayError = localError || globalError;
  const anyLoading   = loading || googleLoading || globalLoading;

  const hasError = Boolean(displayError);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);

    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setLocalError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      // onAuthStateChanged in useAuthFlow handles the rest automatically
    } catch (err) {
      setLocalError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    setLocalError(null);
    setGoogleLoading(true);
    try {
      await handleGoogleSignIn();
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <>
      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}

      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] flex flex-col sm:flex-row relative">
        {/* ThemeToggle — topo direito */}
        <ThemeToggle className="absolute top-4 right-4 z-10" size="sm" />

        {/* ── Left trust panel (lg+) ─────────────────────────────────────── */}
        <div className="lg:w-[52%]">
          <TrustPanel />
        </div>

        {/* ── Right form panel ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-12">
          <div className="w-full max-w-[380px] mx-auto">

            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-10 lg:hidden">
              <LogoMark size="sm" />
              <div>
                <p className="text-slate-900 dark:text-white/90 font-semibold text-sm tracking-tight leading-none">
                  {APP_NAME}
                </p>
                <p className="text-slate-500 dark:text-white/35 text-xs mt-0.5">{APP_SUBTITLE}</p>
              </div>
            </div>

            {/* Form card */}
            <div className="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.09] shadow-lg shadow-slate-200/60 dark:shadow-black/40 backdrop-blur-xl rounded-2xl px-7 py-8">

              {/* Heading */}
              <div className="mb-7">
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white/90 tracking-tight">
                  Acesse sua conta
                </h1>
                <p className="text-sm text-slate-500 dark:text-white/35 mt-1.5">
                  Sistema restrito. Acesso por autorização.
                </p>
              </div>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                noValidate
                role="form"
                aria-label="Formulário de acesso"
              >
                {/* Email */}
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-600 dark:text-white/45 mb-1.5">
                    E-mail profissional
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    disabled={anyLoading}
                    aria-required="true"
                    aria-describedby={hasError ? 'login-error' : undefined}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.06] border text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08] disabled:opacity-40 transition-all ${
                      hasError
                        ? 'border-red-400 dark:border-red-500/50 focus:border-red-400 dark:focus:border-red-500/70 focus:ring-red-500/30'
                        : 'border-slate-300 dark:border-white/[0.09] focus:border-violet-500/60'
                    }`}
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-600 dark:text-white/45 mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={anyLoading}
                      aria-required="true"
                      aria-describedby={hasError ? 'login-error' : undefined}
                      className={`w-full px-4 py-3 pr-11 rounded-xl bg-slate-50 dark:bg-white/[0.06] border text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08] disabled:opacity-40 transition-all ${
                        hasError
                          ? 'border-red-400 dark:border-red-500/50 focus:border-red-400 dark:focus:border-red-500/70 focus:ring-red-500/30'
                          : 'border-slate-300 dark:border-white/[0.09] focus:border-violet-500/60'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-slate-400 dark:text-white/35 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                {/* Error */}
                {displayError && (
                  <div
                    id="login-error"
                    role="alert"
                    aria-live="assertive"
                    className="text-xs text-red-600 dark:text-red-400/90 bg-red-500/[0.08] border border-red-500/[0.2] rounded-lg px-3 py-2.5 leading-relaxed"
                  >
                    {displayError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={anyLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20 mt-1"
                >
                  {loading ? <><Spinner /> Verificando acesso…</> : 'Entrar'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5" role="separator" aria-hidden>
                <div className="flex-1 h-px bg-slate-200 dark:bg-white/[0.07]" />
                <span className="text-xs text-slate-400 dark:text-white/25 select-none">ou</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-white/[0.07]" />
              </div>

              {/* Google OAuth */}
              <div>
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={anyLoading}
                  aria-label="Entrar com conta Google institucional"
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.07] active:bg-slate-200 dark:active:bg-white/[0.10] text-slate-700 dark:text-white/70 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {googleLoading ? (
                    <><Spinner /> Conectando…</>
                  ) : (
                    <><GoogleIcon /> Continuar com Conta Institucional</>
                  )}
                </button>
                <p className="text-center text-xs text-slate-400 dark:text-white/20 mt-2">
                  Google Workspace autorizado
                </p>
              </div>

            </div>
            {/* end form card */}

            {/* Access notice */}
            <p className="text-xs text-slate-400 dark:text-white/25 text-center mt-5 leading-relaxed">
              O acesso depende de autorização prévia do administrador do laboratório.
            </p>

            {/* Footer (mobile only) */}
            <p className="text-center text-xs text-slate-400 dark:text-white/15 mt-6 lg:hidden">
              {APP_COPYRIGHT_ENTITY} © {new Date().getFullYear()} · LGPD · Política de Privacidade
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
