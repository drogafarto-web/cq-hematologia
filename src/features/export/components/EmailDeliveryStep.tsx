/**
 * EmailDeliveryStep — Optional step 4 in ExportWizard.
 *
 * Allows the operator to optionally enter an email address to receive
 * the signed download link when the export job completes.
 *
 * LGPD compliance: explicit notice that the email address will be used
 * to send a transactional email with the download link.
 *
 * Accessibility: validation errors use role="alert" for screen reader
 * announcement. Email input is properly labelled.
 */

import { useState, useCallback, useId } from 'react';

interface EmailDeliveryStepProps {
  /** Current value of the email field (empty string means no email delivery) */
  emailRecipient: string;
  /** Called whenever the email value changes (valid or empty) */
  onChange: (email: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function EmailDeliveryStep({ emailRecipient, onChange }: EmailDeliveryStepProps) {
  const [enabled, setEnabled] = useState(Boolean(emailRecipient));
  const [localEmail, setLocalEmail] = useState(emailRecipient);
  const [touched, setTouched] = useState(false);

  const checkboxId = useId();
  const inputId = useId();
  const errorId = useId();
  const helpId = useId();

  const handleToggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      // Clear the email when disabled
      setLocalEmail('');
      setTouched(false);
      onChange('');
    }
  }, [enabled, onChange]);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalEmail(val);
      // Only propagate valid email up (or empty string)
      if (val === '' || isValidEmail(val)) {
        onChange(val);
      } else {
        onChange(''); // Don't propagate invalid values
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const showError = touched && enabled && localEmail !== '' && !isValidEmail(localEmail);
  const isEmpty = enabled && localEmail === '';

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <h3 className="text-sm font-semibold text-white">Entrega por email</h3>
        <p className="mt-0.5 text-xs text-white/40 leading-relaxed">
          Receba o link de download direto na sua caixa de entrada quando a exportação for
          concluída. Opcional.
        </p>
      </div>

      {/* Toggle row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          id={checkboxId}
          role="checkbox"
          aria-checked={enabled}
          onClick={handleToggle}
          className={[
            'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full',
            'border-2 border-transparent transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
            enabled ? 'bg-violet-600' : 'bg-white/10',
          ].join(' ')}
          aria-label="Ativar envio por email"
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-4 w-4 transform rounded-full',
              'bg-white shadow-sm transition-transform duration-200',
              enabled ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
        <label
          htmlFor={checkboxId}
          className="text-sm text-white/70 select-none cursor-pointer"
          onClick={handleToggle}
        >
          Enviar link por email
        </label>
      </div>

      {/* Email input — only shown when enabled */}
      {enabled && (
        <div className="space-y-2">
          <label htmlFor={inputId} className="block text-xs font-medium text-white/60">
            Endereço de email
          </label>

          <input
            id={inputId}
            type="email"
            autoComplete="email"
            placeholder="operador@laboratorio.com"
            value={localEmail}
            onChange={handleEmailChange}
            onBlur={handleBlur}
            aria-describedby={`${helpId} ${showError ? errorId : ''}`}
            aria-invalid={showError}
            className={[
              'w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20',
              'bg-white/[0.05] border transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
              showError
                ? 'border-red-500/60 focus:border-red-500/60'
                : isEmpty
                  ? 'border-amber-500/40'
                  : 'border-white/10 focus:border-violet-500/40',
            ].join(' ')}
          />

          {/* Validation error */}
          {showError && (
            <p id={errorId} role="alert" className="text-xs text-red-400 flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              Informe um endereço de email válido.
            </p>
          )}

          {/* Helper text */}
          <p id={helpId} className="text-xs text-white/30 leading-relaxed">
            O link expirará em 7 dias. Enviado somente uma vez, quando o arquivo estiver pronto.
          </p>

          {/* LGPD notice */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
            <p className="text-[11px] text-white/25 leading-relaxed">
              <span className="font-medium text-white/40">Aviso LGPD (Lei 13.709/2018):</span> Ao
              inserir um email, você autoriza o envio de um email transacional para este endereço. O
              email conterá apenas o link de download — nenhum dado de paciente ou laboratório será
              enviado. O email é enviado a pedido do operador autenticado e não pode ser cancelado
              após o envio.
            </p>
          </div>
        </div>
      )}

      {/* Status summary when valid email is set */}
      {enabled && localEmail && isValidEmail(localEmail) && !showError && (
        <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-2">
          <svg
            className="h-4 w-4 text-violet-400 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
          <p className="text-xs text-violet-300/80">
            Link será enviado para <span className="font-medium text-violet-200">{localEmail}</span>{' '}
            após conclusão.
          </p>
        </div>
      )}
    </div>
  );
}
