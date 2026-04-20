import React, { useState } from 'react';
import { useUroOcrSetting } from '../hooks/useUroOcrSetting';
import { useUserRole, useIsSuperAdmin } from '../../../store/useAuthStore';

// ─── Props ────────────────────────────────────────────────────────────────────

interface UroanaliseSettingsModalProps {
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * UroanaliseSettingsModal — painel de configurações do módulo de uroanálise.
 *
 * MVP: apenas o toggle de OCR experimental. Futuras features:
 *   - Integração RS232/USB com Uri View 200 (WAMA)
 *   - Seleção de marca de tira padrão
 *   - Limites customizados de tolerância
 *
 * Persistência: `/labs/{labId}/ciq-uroanalise-config/settings`
 * Permissão: apenas owner/admin/superadmin podem alterar.
 */
export function UroanaliseSettingsModal({ onClose }: UroanaliseSettingsModalProps) {
  const { enabled, loading, error, setEnabled } = useUroOcrSetting();
  const userRole = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();
  const canEdit = isSuperAdmin || userRole === 'owner' || userRole === 'admin';

  const [toggling, setToggling] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  async function handleToggle(nextValue: boolean) {
    if (!canEdit || toggling) return;
    setToggling(true);
    setLocalErr(null);
    try {
      await setEnabled(nextValue);
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-xl w-full max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] shadow-2xl">
        <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              Configurações — Uroanálise
            </h2>
            <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">
              Preferências do laboratório ativo para o módulo de uroanálise
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
            aria-label="Fechar"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* OCR Toggle */}
          <section>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-white/85">
                  Leitura OCR de tiras — experimental
                </p>
                <p className="text-xs text-slate-500 dark:text-white/45 mt-1 leading-relaxed">
                  Quando habilitado, o formulário de nova corrida passa a exibir um botão de câmera.
                  Ao fotografar a tira reagente, a IA (Gemini) pré-preenche os campos com alta
                  confiança — o operador sempre revisa antes de confirmar.
                </p>
              </div>
              <Toggle
                checked={enabled}
                onChange={handleToggle}
                disabled={!canEdit || loading || toggling}
              />
            </div>

            {enabled && (
              <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/[0.06] text-amber-800 dark:text-amber-400 px-3.5 py-2.5 text-xs leading-relaxed">
                <strong>Recurso experimental.</strong> O resultado da IA nunca substitui a revisão
                do operador. Bilirrubina, Urobilinogênio e Densidade são sempre processados
                manualmente — contraste ótico insuficiente na cromatografia.
              </div>
            )}

            {(error || localErr) && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400/80">{error ?? localErr}</p>
            )}
          </section>

          {/* Info de roadmap */}
          <section className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-1.5">
              Em breve
            </p>
            <ul className="space-y-1 text-xs text-slate-500 dark:text-white/45 list-disc list-inside">
              <li>Integração RS232/USB com Uri View 200 (WAMA) — leitura direta do analisador</li>
              <li>Limites customizados de tolerância ordinal por analito</li>
              <li>Marca padrão de tira reagente do laboratório</li>
            </ul>
          </section>

          {!canEdit && (
            <p className="text-xs text-amber-600 dark:text-amber-400/70 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">
              Apenas proprietários e administradores podem alterar estas configurações.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-amber-500' : 'bg-slate-300 dark:bg-white/[0.1]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}
