import { useAuthFlow } from './hooks/useAuthFlow';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 7v4l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PendingLabAccessScreen() {
  const { signOut } = useAuthFlow();

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6 text-amber-400">
          <ClockIcon />
        </div>

        <h2 className="text-lg font-semibold text-white/90 mb-2">Acesso pendente de aprovação</h2>
        <p className="text-sm text-white/40 leading-relaxed mb-8">
          Sua solicitação de acesso ao laboratório foi enviada e está aguardando aprovação do
          administrador.
        </p>

        <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12] text-left mb-6">
          <p className="text-xs text-amber-400/70 leading-relaxed">
            Você receberá acesso assim que um administrador aprovar sua solicitação. Faça login
            novamente após a aprovação.
          </p>
        </div>

        <button
          onClick={signOut}
          className="text-sm text-white/35 hover:text-white/60 transition-colors"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}
