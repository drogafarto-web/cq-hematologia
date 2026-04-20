import { useState } from 'react';
import { useAuthFlow } from './hooks/useAuthFlow';

// ─── EmailVerificationScreen ──────────────────────────────────────────────────
// Shown when firebaseUser.emailVerified === false (ITEM 6).
// Lets the user resend the verification email and check status.

export function EmailVerificationScreen() {
  const { profile, resendVerificationEmail, signOut } = useAuthFlow();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const email = profile?.user.email ?? '';

  async function handleResend() {
    setLoading(true);
    await resendVerificationEmail();
    setSent(true);
    setLoading(false);
  }

  async function handleRefresh() {
    // Force-reload the auth state by reloading the page.
    // Firebase will re-evaluate emailVerified on the new token.
    await profile?.user.reload();
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-400"
            aria-hidden
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-white/80 tracking-tight mb-2">
            Confirme seu e-mail
          </h1>
          <p className="text-sm text-white/35 leading-relaxed">
            Enviamos um link de verificação para{' '}
            <span className="text-white/60 font-medium">{email}</span>.
            <br />
            Confirme para continuar.
          </p>
        </div>

        <div className="space-y-3">
          {sent && (
            <div className="text-xs text-emerald-400/90 bg-emerald-500/[0.08] border border-emerald-500/[0.2] rounded-xl px-4 py-3 text-center leading-relaxed">
              E-mail reenviado. Verifique também a pasta de spam.
            </div>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/20"
          >
            Já confirmei — continuar
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={loading || sent}
            className="w-full flex items-center justify-center py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.08] text-white/60 text-sm transition-all disabled:opacity-40"
          >
            {loading ? 'Reenviando…' : sent ? 'E-mail reenviado' : 'Reenviar e-mail de verificação'}
          </button>

          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center justify-center py-3 text-white/25 hover:text-white/50 text-xs transition-colors"
          >
            Sair e usar outra conta
          </button>
        </div>

        <p className="text-xs text-white/15 text-center mt-10">
          Labclin © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
