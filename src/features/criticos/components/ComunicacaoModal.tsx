/**
 * ComunicacaoModal
 *
 * Modal that captures operator acknowledgment of a critical-value escalation.
 * Renders patient + exam + value, the SLA countdown, the contact channel
 * timeline, and a notes field. On confirm, fires `acknowledgeEscalacao`.
 *
 * RDC 978/2025 Art. 5.7.1 — critical communication mandatory <60 min.
 *
 * Accessibility: dialog role, focus trap on the confirm button, Escape closes.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Field,
  IconAlert,
  IconCheck,
  IconClock,
  IconClose,
  inputClass,
} from './_ui';
import { computeSlaState, formatSlaCountdown } from '../utils/slaFormat';
import type { CriticosEscalacao } from '../types';

interface ComunicacaoModalProps {
  escalacao: CriticosEscalacao;
  onClose: () => void;
  onAcknowledge: (payload: { escalacaoId: string; notas?: string }) => Promise<void>;
}

export function ComunicacaoModal({
  escalacao,
  onClose,
  onAcknowledge,
}: ComunicacaoModalProps) {
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // SLA tick — 1Hz countdown.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Focus management + escape to close.
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slaState = computeSlaState(escalacao, now);
  const isPending = escalacao.status === 'enviado';

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onAcknowledge({
        escalacaoId: escalacao.id,
        notas: notas.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reconhecer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ack-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#141417] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]">
        <header className="flex items-start justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={
                  slaState.kind === 'expired'
                    ? 'text-red-300'
                    : slaState.kind === 'warning'
                    ? 'text-amber-300'
                    : 'text-violet-300'
                }
              >
                <IconAlert className="h-4 w-4" />
              </span>
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                Valor crítico · {escalacao.severidade === 'alta' ? 'Alto' : 'Baixo'}
              </p>
            </div>
            <h3
              id="ack-title"
              className="mt-1 text-[17px] font-semibold tracking-tight text-white"
            >
              Reconhecimento de comunicação
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/50 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 motion-reduce:transition-none"
            aria-label="Fechar"
          >
            <IconClose />
          </button>
        </header>

        <div className="space-y-4 px-6 py-6">
          {/* Patient + exam summary */}
          <Card className="p-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-white/40">
                  Paciente
                </dt>
                <dd className="mt-1 font-medium text-white">
                  {escalacao.pacienteNome}
                </dd>
                <dd className="text-xs text-white/50">
                  {escalacao.pacienteIdade} a · {escalacao.pacienteSexo}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-white/40">
                  Médico
                </dt>
                <dd className="mt-1 font-medium text-white">
                  {escalacao.medicoNome}
                </dd>
                <dd className="font-mono text-xs text-white/50">
                  {escalacao.medicoTelefone}
                </dd>
              </div>
              <div className="col-span-2 border-t border-white/[0.06] pt-3">
                <dt className="text-[11px] uppercase tracking-wide text-white/40">
                  Resultado
                </dt>
                <dd className="mt-1 flex items-baseline gap-3">
                  <span className="font-mono text-sm text-white/70">
                    {escalacao.analitoId}
                  </span>
                  <span className="font-semibold tabular-nums text-2xl text-white">
                    {escalacao.valorObtido}
                  </span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                      (escalacao.severidade === 'alta'
                        ? 'bg-red-500/15 text-red-200'
                        : 'bg-blue-500/15 text-blue-200')
                    }
                  >
                    {escalacao.severidade === 'alta' ? 'crítico alto' : 'crítico baixo'}
                  </span>
                </dd>
                {escalacao.motivo && (
                  <dd className="mt-1 text-xs text-white/50">
                    {escalacao.motivo}
                  </dd>
                )}
              </div>
            </dl>
          </Card>

          {/* SLA */}
          <div
            className={
              'flex items-center justify-between rounded-lg border px-4 py-3 ' +
              (slaState.kind === 'expired'
                ? 'border-red-500/30 bg-red-500/[0.06]'
                : slaState.kind === 'warning'
                ? 'border-amber-500/30 bg-amber-500/[0.06]'
                : 'border-emerald-500/25 bg-emerald-500/[0.05]')
            }
          >
            <div className="flex items-center gap-2 text-sm">
              <IconClock className="h-4 w-4" />
              <span className="text-white/80">SLA</span>
            </div>
            <div className="text-right">
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {formatSlaCountdown(slaState.elapsedMs, escalacao.sla_minutos_target)}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                {slaState.kind === 'expired'
                  ? 'Vencido'
                  : slaState.kind === 'warning'
                  ? '> 50% do prazo'
                  : 'Em prazo'}
              </div>
            </div>
          </div>

          {/* Channel timeline */}
          {escalacao.escalacoes.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-white/50">
                Canais de comunicação
              </p>
              <ul className="space-y-1.5">
                {escalacao.escalacoes.map((a) => (
                  <li
                    key={a.canalId}
                    className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-white/70">
                      #{a.tentativa_numero} · {a.canal}
                    </span>
                    <span
                      className={
                        a.status === 'entregue'
                          ? 'text-emerald-300'
                          : a.status === 'falha'
                          ? 'text-red-300'
                          : 'text-white/60'
                      }
                    >
                      {labelForStatus(a.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Field
            label="Notas do reconhecimento (opcional)"
            htmlFor="ack-notas"
            hint="Registre a ação clínica ou contato realizado."
          >
            <textarea
              id="ack-notas"
              aria-label="Notas do reconhecimento"
              className={inputClass + ' min-h-[72px] resize-y'}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={500}
              disabled={!isPending}
            />
          </Field>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-200"
            >
              {error}
            </div>
          )}

          {!isPending && (
            <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-200">
              Esta escalação já foi reconhecida.
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Fechar
          </Button>
          {isPending && (
            <Button
              ref={confirmRef}
              variant="primary"
              onClick={() => void handleConfirm()}
              disabled={submitting}
              aria-label="Confirmar reconhecimento"
            >
              <IconCheck />
              {submitting ? 'Reconhecendo…' : 'Reconhecer'}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

function labelForStatus(status: string): string {
  switch (status) {
    case 'entregue':
      return 'Entregue';
    case 'falha':
      return 'Falhou';
    case 'enviado':
      return 'Enviado';
    case 'descartado':
      return 'Descartado';
    default:
      return status;
  }
}
