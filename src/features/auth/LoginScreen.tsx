import { useState, useEffect } from 'react';
import { z } from 'zod';
import { FirebaseError } from 'firebase/app';
import { signIn } from './services/authService';
import { useAuthFlow } from './hooks/useAuthFlow';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});

// ─── Firebase auth error messages ────────────────────────────────────────────

function authErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) return 'Erro inesperado. Tente novamente.';
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail ou senha inválidos.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos.';
    case 'auth/network-request-failed':
      return 'Erro de conexão. Verifique sua internet.';
    default:
      return 'Erro ao entrar. Tente novamente.';
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path
          d="M11 2L3 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6L11 2z"
          fill="white"
          fillOpacity="0.9"
        />
        <path
          d="M8 11l2 2 4-4"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginScreen() {
  const { error: globalError } = useAuthFlow();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  // Sync local error with global error from hook
  const displayError = localError || globalError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const parsed = schema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setLocalError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      // onAuthStateChanged in useAuthFlow picks up the state automatically
    } catch (err) {
      console.error('[LoginScreen] Error:', err);
      setLocalError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <LogoMark />
          <h1 className="mt-4 text-xl font-semibold text-white/90 tracking-tight">
            CQ Hematologia
          </h1>
          <p className="text-sm text-white/35 mt-1">LabClin</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
              E-mail
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              disabled={loading}
              className="
                w-full px-4 py-3 rounded-xl
                bg-white/[0.06] border border-white/[0.09]
                text-white/90 placeholder-white/20
                text-sm focus:outline-none
                focus:border-violet-500/60 focus:bg-white/[0.08]
                disabled:opacity-40 transition-all
              "
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
              Senha
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              disabled={loading}
              className="
                w-full px-4 py-3 rounded-xl
                bg-white/[0.06] border border-white/[0.09]
                text-white/90 placeholder-white/20
                text-sm focus:outline-none
                focus:border-violet-500/60 focus:bg-white/[0.08]
                disabled:opacity-40 transition-all
              "
            />
          </div>

          {/* Error */}
          {displayError && (
            <p className="text-xs text-red-400/90 bg-red-500/[0.08] border border-red-500/[0.15] rounded-lg px-3 py-2.5">
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="
              w-full flex items-center justify-center gap-2
              mt-2 py-3 rounded-xl
              bg-violet-600 hover:bg-violet-500
              text-white text-sm font-medium
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all shadow-lg shadow-violet-500/20
            "
          >
            {loading ? <><Spinner /> Entrando…</> : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-white/20 mt-8">
          Labclin © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
