import { useAuthFlow } from './hooks/useAuthFlow';
import { useAvailableLabs, useAuthError } from '../../store/useAuthStore';
import type { Lab } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function BeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M7 3v6.5L3 15a1.5 1.5 0 001.4 2h11.2A1.5 1.5 0 0017 15l-4-5.5V3"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M6 3h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Lab Row ──────────────────────────────────────────────────────────────────

function LabRow({ lab, onSelect, disabled }: { lab: Lab; onSelect: (l: Lab) => void; disabled: boolean }) {
  return (
    <button
      onClick={() => onSelect(lab)}
      disabled={disabled}
      className="
        w-full flex items-center gap-3 px-4 py-4 rounded-xl
        bg-white/[0.04] border border-white/[0.07]
        hover:bg-white/[0.07] hover:border-white/[0.12]
        disabled:opacity-40 disabled:cursor-not-allowed
        text-left transition-all group
      "
    >
      {lab.logoUrl ? (
        <img src={lab.logoUrl} alt={lab.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
          <BeakerIcon />
        </div>
      )}
      <span className="flex-1 text-sm font-medium text-white/80 group-hover:text-white/95 transition-colors truncate">
        {lab.name}
      </span>
      <span className="text-white/25 group-hover:text-white/50 transition-colors shrink-0">
        <ChevronIcon />
      </span>
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LabSelectorScreen() {
  const { selectLab, signOut, isLoading } = useAuthFlow();
  const labs  = useAvailableLabs();
  const error = useAuthError();

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white/90 mb-1">
            Selecione o laboratório
          </h2>
          <p className="text-sm text-white/35">
            Você tem acesso a {labs.length} {labs.length === 1 ? 'laboratório' : 'laboratórios'}.
          </p>
        </div>

        <div className="space-y-2">
          {labs.map((lab) => (
            <LabRow key={lab.id} lab={lab} onSelect={selectLab} disabled={isLoading} />
          ))}
        </div>

        {error && (
          <p className="mt-4 text-xs text-red-400/90 bg-red-500/[0.08] border border-red-500/[0.15] rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={signOut}
            className="text-sm text-white/30 hover:text-white/55 transition-colors"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
