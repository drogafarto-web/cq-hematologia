/**
 * src/features/reclamacoes/components/ReclamacaoIntakeForm.tsx
 *
 * MP-6 (v1.4-final-closure) — Patient-facing complaint intake form, dark-first,
 * WCAG AA, LGPD-compliant. Drives the `intakeReclamacao` callable from
 * `functions/src/modules/reclamacoes/intakeReclamacao.ts`.
 *
 * Design references: Apple, Linear, Stripe.
 * Compliance: LGPD Art. 9/11 (consent-on-identification), RDC 978 Art. 86.
 */

import * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import type { ReclamacaoCanal } from '../types/mp6';

export interface ReclamacaoIntakeFormProps {
  labId: string;
  canal?: ReclamacaoCanal;
  onSubmitted: (reclamacaoId: string) => void;
  onCancel?: () => void;
}

type Step = 1 | 2 | 3 | 4;
type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; id: string }
  | { kind: 'error'; message: string };

interface AttachmentDraft {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

const ACCEPTED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;

const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;
const MIN_DESCRIPTION = 30;
const MAX_DESCRIPTION = 5000;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Identificação' },
  { id: 2, label: 'Descrição' },
  { id: 3, label: 'Anexos' },
  { id: 4, label: 'Confirmação' },
];

export function ReclamacaoIntakeForm({
  labId,
  canal = 'patient-portal',
  onSubmitted,
  onCancel,
}: ReclamacaoIntakeFormProps): React.JSX.Element {
  const [step, setStep] = useState<Step>(1);
  const [anonymous, setAnonymous] = useState(true);
  const [patientName, setPatientName] = useState('');
  const [patientContact, setPatientContact] = useState('');
  const [consent, setConsent] = useState(false);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const [reducedMotion, setReducedMotion] = useState(false);

  const descId = useId();
  const counterId = useId();
  const consentId = useId();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const totalBytes = useMemo(
    () => attachments.reduce((acc, a) => acc + a.fileSize, 0),
    [attachments],
  );

  const stepValid = useMemo<boolean>(() => {
    if (step === 1) {
      if (anonymous) return true;
      return patientName.trim().length >= 2 && patientContact.trim().length >= 4 && consent;
    }
    if (step === 2) {
      return description.trim().length >= MIN_DESCRIPTION && description.length <= MAX_DESCRIPTION;
    }
    if (step === 3) {
      return totalBytes <= MAX_TOTAL_BYTES && attachments.length <= MAX_FILES;
    }
    return true;
  }, [
    step,
    anonymous,
    patientName,
    patientContact,
    consent,
    description,
    attachments.length,
    totalBytes,
  ]);

  const onAddFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const next: AttachmentDraft[] = [...attachments];
      for (const f of Array.from(files)) {
        if (next.length >= MAX_FILES) break;
        if (!ACCEPTED_MIMES.includes(f.type as (typeof ACCEPTED_MIMES)[number])) {
          continue;
        }
        next.push({
          id: cryptoRandomId(),
          fileName: f.name,
          fileSize: f.size,
          mimeType: f.type,
        });
      }
      setAttachments(next);
    },
    [attachments],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const goNext = () => {
    if (step < 4) setStep((s) => (s + 1) as Step);
  };
  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const onSubmit = useCallback(async () => {
    setSubmitState({ kind: 'submitting' });
    try {
      const consentToken = !anonymous && consent ? cryptoRandomId() : undefined;
      const payload = {
        labId,
        canal,
        description: description.trim(),
        patientName: anonymous ? undefined : patientName.trim(),
        patientContact: anonymous ? undefined : patientContact.trim(),
        consentToken,
      };
      const fn = httpsCallable<typeof payload, { reclamacaoId: string }>(
        functions,
        'intakeReclamacao',
      );
      const res = await fn(payload);
      const id = res.data?.reclamacaoId;
      if (!id) throw new Error('Resposta inválida do servidor');
      setSubmitState({ kind: 'success', id });
      onSubmitted(id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar a reclamação. Tente novamente.';
      setSubmitState({ kind: 'error', message });
    }
  }, [labId, canal, description, anonymous, patientName, patientContact, consent, onSubmitted]);

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white px-4 py-12">
      <form
        className="max-w-2xl mx-auto bg-[#141417] border border-white/10 rounded-2xl p-8 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 4) onSubmit();
          else if (stepValid) goNext();
        }}
        aria-labelledby={`${descId}-title`}
      >
        <header className="space-y-2">
          <h1 id={`${descId}-title`} className="text-2xl font-medium tracking-tight text-white">
            Registrar reclamação
          </h1>
          <p className="text-sm text-white/70 leading-relaxed">
            Sua percepção move melhorias reais. Trataremos seu relato com confidencialidade e
            rastreabilidade auditável.
          </p>
        </header>

        <StepNav step={step} reducedMotion={reducedMotion} />

        {step === 1 && (
          <section role="region" aria-labelledby={`${descId}-step-1`} className="space-y-5">
            <h2 id={`${descId}-step-1`} className="sr-only">
              Identificação
            </h2>

            <label className="flex items-start gap-3 bg-white/5 hover:bg-white/[0.07] rounded-lg p-4 cursor-pointer border border-transparent hover:border-white/10 transition-colors duration-150">
              <input
                type="checkbox"
                className="mt-1 accent-violet-500"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              <span className="text-sm text-white/85">
                <strong className="font-medium">Quero permanecer anônimo(a)</strong>
                <span className="block text-white/60 text-xs mt-1 leading-relaxed">
                  Recomendamos identificação para que possamos retornar com a resolução, mas você
                  pode prosseguir anonimamente.
                </span>
              </span>
            </label>

            {!anonymous && (
              <div className="space-y-4">
                <FieldLabel label="Nome">
                  <input
                    type="text"
                    autoComplete="name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full bg-[#0e0e10] border border-white/10 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors duration-150"
                  />
                </FieldLabel>
                <FieldLabel label="E-mail ou telefone para contato">
                  <input
                    type="text"
                    autoComplete="email"
                    value={patientContact}
                    onChange={(e) => setPatientContact(e.target.value)}
                    className="w-full bg-[#0e0e10] border border-white/10 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors duration-150"
                  />
                </FieldLabel>

                <label
                  htmlFor={consentId}
                  className="flex items-start gap-3 text-sm text-white/85 cursor-pointer"
                >
                  <input
                    id={consentId}
                    type="checkbox"
                    className="mt-1 accent-violet-500"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    aria-describedby={`${descId}-lgpd-note`}
                  />
                  <span>
                    Concordo com a{' '}
                    <a
                      href="/lgpd/politica-privacidade"
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet-300 underline-offset-2 hover:underline"
                    >
                      Política de Privacidade
                    </a>{' '}
                    para que o laboratório possa entrar em contato sobre esta reclamação.
                    Consentimento registrado conforme LGPD Art. 9/11.
                  </span>
                </label>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section role="region" aria-labelledby={`${descId}-step-2`} className="space-y-3">
            <h2 id={`${descId}-step-2`} className="text-base font-medium text-white">
              Descreva o ocorrido
            </h2>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION}
              aria-describedby={counterId}
              placeholder="Descreva o ocorrido com clareza — quanto mais contexto, melhor poderemos investigar."
              className="w-full bg-[#0e0e10] border border-white/10 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 leading-relaxed outline-none transition-colors duration-150 resize-none"
            />
            <p id={counterId} className="text-xs text-white/50 tabular-nums flex justify-between">
              <span>
                {description.length < MIN_DESCRIPTION
                  ? `${MIN_DESCRIPTION - description.length} caracteres restantes (mínimo)`
                  : 'OK'}
              </span>
              <span>
                {description.length} / {MAX_DESCRIPTION}
              </span>
            </p>
          </section>
        )}

        {step === 3 && (
          <section role="region" aria-labelledby={`${descId}-step-3`} className="space-y-4">
            <h2 id={`${descId}-step-3`} className="text-base font-medium text-white">
              Anexos (opcional)
            </h2>
            <label
              htmlFor={`${descId}-file`}
              className="block border border-dashed border-white/15 hover:border-violet-500/40 rounded-xl px-6 py-8 text-center cursor-pointer transition-colors duration-150 bg-white/[0.02] hover:bg-violet-500/[0.04]"
            >
              <UploadIcon />
              <p className="mt-3 text-sm text-white/80">
                Arraste arquivos ou clique para selecionar
              </p>
              <p className="mt-1 text-xs text-white/50">
                PDF, PNG, JPEG, WEBP — até 10 MB no total, 5 arquivos
              </p>
              <input
                id={`${descId}-file`}
                type="file"
                multiple
                accept={ACCEPTED_MIMES.join(',')}
                className="sr-only"
                onChange={(e) => onAddFiles(e.target.files)}
              />
            </label>

            {attachments.length > 0 && (
              <ul className="space-y-2">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/90 truncate">{a.fileName}</p>
                      <p className="text-xs text-white/50 tabular-nums">
                        {formatBytes(a.fileSize)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="ml-3 text-xs text-white/50 hover:text-rose-300 transition-colors duration-150"
                      aria-label={`Remover ${a.fileName}`}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {totalBytes > MAX_TOTAL_BYTES && (
              <p
                role="alert"
                className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2"
              >
                Tamanho total ultrapassa 10 MB. Remova arquivos para continuar.
              </p>
            )}
          </section>
        )}

        {step === 4 && (
          <section role="region" aria-labelledby={`${descId}-step-4`} className="space-y-5">
            <h2 id={`${descId}-step-4`} className="text-base font-medium text-white">
              Conferir e enviar
            </h2>
            <SummaryRow
              label="Identificação"
              value={anonymous ? 'Anônima' : `${patientName} · ${patientContact}`}
            />
            <SummaryRow label="Descrição" value={`${description.length} caracteres`} />
            <SummaryRow
              label="Anexos"
              value={
                attachments.length === 0
                  ? 'Nenhum'
                  : `${attachments.length} arquivo(s) · ${formatBytes(totalBytes)}`
              }
            />
            <p className="text-xs text-white/50 leading-relaxed">
              Ao enviar, gravamos uma assinatura criptográfica do seu relato para garantir
              integridade e rastreabilidade conforme RDC 978/2025.
            </p>

            {submitState.kind === 'error' && (
              <p
                role="alert"
                className="text-sm text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-lg px-4 py-3"
              >
                {submitState.message}
              </p>
            )}

            {submitState.kind === 'success' && (
              <p
                role="status"
                className="text-sm text-emerald-200 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-4 py-3"
              >
                Reclamação registrada. Protocolo: {submitState.id.slice(0, 8)}.
              </p>
            )}
          </section>
        )}

        <footer className="flex items-center justify-between border-t border-white/5 pt-6">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="text-sm text-white/60 hover:text-white transition-colors duration-150"
              >
                Voltar
              </button>
            )}
            {onCancel && step === 1 && (
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-white/60 hover:text-white transition-colors duration-150"
              >
                Cancelar
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/lgpd/politica-privacidade"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/40 hover:text-violet-300 transition-colors duration-150"
            >
              Política de Privacidade
            </a>
            <button
              type="submit"
              disabled={
                !stepValid || submitState.kind === 'submitting' || submitState.kind === 'success'
              }
              className="bg-violet-500 hover:bg-violet-600 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors duration-150"
            >
              {submitState.kind === 'submitting'
                ? 'Enviando…'
                : step === 4
                  ? 'Enviar reclamação'
                  : 'Continuar'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function StepNav({
  step,
  reducedMotion,
}: {
  step: Step;
  reducedMotion: boolean;
}): React.JSX.Element {
  return (
    <nav role="navigation" aria-label="Etapas do formulário" className="flex items-center gap-2">
      {STEPS.map((s, idx) => {
        const active = s.id === step;
        const done = s.id < step;
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <span
              className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs tabular-nums font-medium border',
                active
                  ? 'bg-violet-500/30 border-violet-500/60 text-white'
                  : done
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-white/40',
                reducedMotion ? '' : 'transition-colors duration-200',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              {done ? '✓' : s.id}
            </span>
            <span
              className={['text-xs hidden sm:inline', active ? 'text-white' : 'text-white/50'].join(
                ' ',
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-white/5" aria-hidden />}
          </div>
        );
      })}
    </nav>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-white/60">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-3">
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-sm text-white/85 text-right">{value}</span>
    </div>
  );
}

function UploadIcon(): React.JSX.Element {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto text-white/40"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
