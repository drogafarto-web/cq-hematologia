// ─── SuspendedScreen ─────────────────────────────────────────────────────────
// Shown when userDoc.disabled === true (ITEM 2).
// User is already signed out at this point — this is a terminal error state.

export function SuspendedScreen() {
  function handleBack() {
    // Clear the suspended flag by refreshing — the auth state will reset
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-400"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <h1 className="text-lg font-semibold text-white/80 tracking-tight mb-2">Conta suspensa</h1>
        <p className="text-sm text-white/35 leading-relaxed mb-8">
          Seu acesso foi suspenso pelo administrador.
          <br />
          Entre em contato para mais informações.
        </p>

        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-white/60 text-sm transition-all"
        >
          Voltar ao login
        </button>

        <p className="text-xs text-white/15 mt-10">Labclin © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
