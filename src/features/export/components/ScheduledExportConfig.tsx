/**
 * ScheduledExportConfig — Configuration UI for weekly scheduled exports.
 *
 * Allows a lab admin to configure a weekly automated export:
 * - Toggle: enable/disable automatic weekly export
 * - Format selection: which formats to include (uses BatchFormatSelector)
 * - Recipient email: where to send the download links
 * - Schedule info: locked to Sunday 02:00 UTC (MVP)
 * - Last run display: "Última execução: X dias atrás"
 *
 * Save: calls useScheduledExport.saveConfig() — writes to /labs/{labId}/exportSchedule
 */

import { useId } from 'react';
import type { BatchExportFormat } from './BatchFormatSelector';
import { BatchFormatSelector } from './BatchFormatSelector';
import { useScheduledExport } from '../hooks/useScheduledExport';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function formatRelativeTime(date: Date): string {
  const nowMs = Date.now();
  const diffMs = nowMs - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
}

interface ScheduledExportConfigProps {
  labId: string;
}

export function ScheduledExportConfig({ labId }: ScheduledExportConfigProps) {
  const { config, updateConfig, saveConfig, isSaving, lastRunAt, saveError, isSaved } =
    useScheduledExport(labId);

  const toggleId = useId();
  const emailId = useId();
  const emailErrorId = useId();

  const emailValue = config.emailRecipient ?? '';
  const emailTouched = Boolean(emailValue);
  const emailInvalid = emailTouched && !EMAIL_RE.test(emailValue);

  const canSave =
    !isSaving &&
    config.formats.length > 0 &&
    (!config.enabled || (Boolean(emailValue) && EMAIL_RE.test(emailValue)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-white">Exportação automática semanal</h2>
        <p className="mt-1 text-xs text-white/40 leading-relaxed">
          Configure o HC Quality para gerar e entregar exportações automaticamente toda semana, sem
          intervenção manual.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white/80">Ativar exportação automática</p>
          <p className="mt-0.5 text-xs text-white/35">Executa toda domingo às 02:00 UTC</p>
        </div>
        <button
          type="button"
          id={toggleId}
          role="switch"
          aria-checked={config.enabled}
          onClick={() => updateConfig({ enabled: !config.enabled })}
          className={[
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full',
            'border-2 border-transparent transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
            config.enabled ? 'bg-violet-600' : 'bg-white/10',
          ].join(' ')}
          aria-label="Ativar exportação automática semanal"
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full',
              'bg-white shadow-sm transition-transform duration-200',
              config.enabled ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Schedule info (locked in MVP) */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-white/30 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-xs font-medium text-white/60">Agendamento</p>
            <p className="mt-0.5 text-xs text-white/35">
              Toda domingo às 02:00 UTC — cobertura dos últimos 7 dias
            </p>
          </div>
        </div>

        {/* Last run */}
        {lastRunAt && (
          <div className="mt-3 border-t border-white/[0.05] pt-3">
            <p className="text-xs text-white/30">
              Última execução:{' '}
              <span className="text-white/50">
                {formatRelativeTime(lastRunAt)} ({lastRunAt.toLocaleDateString('pt-BR')})
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Format selector */}
      <BatchFormatSelector
        selectedFormats={new Set(config.formats as BatchExportFormat[])}
        onToggle={(format) => {
          const current = new Set(config.formats as BatchExportFormat[]);
          if (current.has(format)) {
            current.delete(format);
          } else {
            current.add(format);
          }
          updateConfig({ formats: Array.from(current) });
        }}
      />

      {/* Email recipient */}
      <div className="space-y-2">
        <label htmlFor={emailId} className="block text-sm font-medium text-white/60">
          Email de entrega
          {config.enabled && <span className="ml-1 text-xs text-red-400/70">*</span>}
        </label>

        <input
          id={emailId}
          type="email"
          autoComplete="email"
          placeholder="responsavel@laboratorio.com"
          value={emailValue}
          onChange={(e) => updateConfig({ emailRecipient: e.target.value })}
          aria-describedby={emailInvalid ? emailErrorId : undefined}
          aria-invalid={emailInvalid}
          className={[
            'w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20',
            'bg-white/[0.05] border transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
            emailInvalid
              ? 'border-red-500/60 focus:border-red-500/60'
              : 'border-white/10 focus:border-violet-500/40',
          ].join(' ')}
        />

        {emailInvalid && (
          <p id={emailErrorId} role="alert" className="text-xs text-red-400">
            Informe um endereço de email válido.
          </p>
        )}

        <p className="text-xs text-white/25">
          Os links de download serão enviados para este email ao final de cada exportação.
          {config.enabled && ' Obrigatório quando a exportação automática está ativa.'}
        </p>
      </div>

      {/* Save button + feedback */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={saveConfig}
          disabled={!canSave}
          className={[
            'w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white',
            'transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
            canSave
              ? 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700'
              : 'bg-white/[0.07] text-white/30 cursor-not-allowed',
          ].join(' ')}
        >
          {isSaving ? 'Salvando...' : 'Salvar configuração'}
        </button>

        {saveError && (
          <p role="alert" className="text-xs text-red-400 text-center">
            {saveError}
          </p>
        )}

        {isSaved && !isSaving && !saveError && (
          <p className="text-xs text-emerald-400 text-center">Configuração salva com sucesso.</p>
        )}
      </div>

      {/* Info footer */}
      <p className="text-[11px] text-white/20 leading-relaxed">
        Os arquivos gerados ficam disponíveis por 7 dias no link enviado por email. As exportações
        automáticas usam os mesmos controles de acesso e trilha de auditoria das exportações manuais
        (RDC 978/2025 Art. 128).
      </p>
    </div>
  );
}
