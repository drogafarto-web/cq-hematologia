import { useAuthFlow } from './hooks/useAuthFlow';

// ─── Icons ────────────────────────────────────────────────────────────────────

function BuildingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="4" width="16" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 19v-5h6v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8h1M7 12h1M14 8h1M14 12h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FirstLabSetupScreen() {
  const { signOut } = useAuthFlow();

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.09] flex items-center justify-center mx-auto mb-6 text-white/40">
          <BuildingIcon />
        </div>

        <h2 className="text-lg font-semibold text-white/90 mb-2">
          Nenhum laboratório vinculado
        </h2>
        <p className="text-sm text-white/40 leading-relaxed mb-8">
          Sua conta ainda não tem acesso a nenhum laboratório.
          Entre em contato com o administrador para solicitar acesso.
        </p>

        <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07] text-left mb-6">
          <p className="text-xs text-white/35 leading-relaxed">
            Um administrador precisará adicionar sua conta ao laboratório
            e conceder as permissões necessárias antes de você poder acessar o sistema.
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
