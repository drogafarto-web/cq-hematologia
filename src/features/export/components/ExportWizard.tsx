/**
 * ExportWizard — 4-step modal for initiating async export jobs.
 *
 * Step 1: Format selection (XLSX CIQ / XLSX NC / PDF / CSV)
 * Step 2: Date range (native <input type="date">)
 * Step 3: Email delivery (optional — enter email to receive download link)
 * Step 4: Review + confirm (initiates Cloud Callable → Pub/Sub)
 *
 * State: managed by useExportWizardStore (Zustand)
 * Job initiation: useExportInitiate (Cloud Callable wrapper)
 * Decouples UI from async XLSX generation — job status tracked separately in ExportQueueView.
 *
 * Phase 3.3: Step 3 (email) is optional — operator can skip it.
 * When email is provided, backgroundWorker will send the signed URL
 * after job completion (non-fatal failure mode).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useExportWizardStore } from '../hooks/useExportWizardState';
import { useExportInitiate } from '../hooks/useExportInitiate';
import { ExportStep1 } from './ExportStep1';
import { ExportStep2 } from './ExportStep2';
import { ExportStep3 } from './ExportStep3';
import { EmailDeliveryStep } from './EmailDeliveryStep';
import type { ExportFormat } from '../types';

const STEP_LABELS = ['Formato', 'Período', 'Email', 'Confirmar'] as const;
const TOTAL_STEPS = 4;

interface ExportWizardProps {
  labId: string;
  operatorId: string;
  /** Called after successful job submission, with the new jobId */
  onSubmitted?: (jobId: string) => void;
}

export function ExportWizard({ labId, operatorId, onSubmitted }: ExportWizardProps) {
  const {
    isOpen,
    step,
    format,
    startDate,
    endDate,
    submittedJobId,
    close,
    nextStep,
    prevStep,
    setFormat,
    setStartDate,
    setEndDate,
    setSubmittedJobId,
  } = useExportWizardStore();

  const { submit, loading, error, clearError } = useExportInitiate();

  // Email delivery state — optional, local to wizard lifecycle
  const [emailRecipient, setEmailRecipient] = useState('');

  // Focus trap: keep focus inside modal while open
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keyboard: Escape closes, trap Tab inside
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!focusable.length) return;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const canAdvanceStep1 = format !== null;
  const canAdvanceStep2 = Boolean(startDate) && Boolean(endDate) && startDate <= endDate;
  // Step 3 (email) is always advanceable — email is optional
  const canAdvanceStep3 = true;

  const handleNext = useCallback(() => {
    clearError();
    nextStep();
  }, [clearError, nextStep]);

  const handleConfirm = useCallback(async () => {
    if (!format || !startDate || !endDate) return;

    try {
      const response = await submit({
        labId,
        format: format as ExportFormat,
        startDate,
        endDate,
        operatorId,
        ...(emailRecipient ? { emailRecipient } : {}),
      });

      setSubmittedJobId(response.jobId);
      onSubmitted?.(response.jobId);
    } catch {
      // Error already set in useExportInitiate
    }
  }, [
    format,
    startDate,
    endDate,
    labId,
    operatorId,
    emailRecipient,
    submit,
    setSubmittedJobId,
    onSubmitted,
  ]);

  // Success state — job was submitted
  if (isOpen && submittedJobId) {
    return (
      <ModalOverlay onClose={close}>
        <ModalCard ref={dialogRef} title="Exportação iniciada!">
          <SuccessView jobId={submittedJobId} onClose={close} />
        </ModalCard>
      </ModalOverlay>
    );
  }

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={close}>
      <ModalCard
        ref={dialogRef}
        title={`Exportar dados — ${STEP_LABELS[step - 1]}`}
        subtitle={`Passo ${step} de ${TOTAL_STEPS}`}
      >
        {/* Step indicator */}
        <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />

        {/* Step content */}
        <div className="mt-5">
          {step === 1 && (
            <ExportStep1
              selectedFormat={format}
              onSelect={(f) => {
                setFormat(f);
                clearError();
              }}
            />
          )}
          {step === 2 && (
            <ExportStep2
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          )}
          {step === 3 && (
            <EmailDeliveryStep emailRecipient={emailRecipient} onChange={setEmailRecipient} />
          )}
          {step === 4 && (
            <ExportStep3
              format={format}
              startDate={startDate}
              endDate={endDate}
              onConfirm={handleConfirm}
              isLoading={loading}
              error={error}
            />
          )}
        </div>

        {/* Navigation footer (for steps 1, 2, 3) */}
        {step < TOTAL_STEPS && (
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={step === 1 ? close : prevStep}
              className="rounded-lg px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={
                (step === 1 && !canAdvanceStep1) ||
                (step === 2 && !canAdvanceStep2) ||
                (step === 3 && !canAdvanceStep3)
              }
              className={[
                'rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                (step === 1 && !canAdvanceStep1) ||
                (step === 2 && !canAdvanceStep2) ||
                (step === 3 && !canAdvanceStep3)
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700',
              ].join(' ')}
            >
              {step === 3 ? (emailRecipient ? 'Próximo' : 'Pular') : 'Próximo'}
            </button>
          </div>
        )}

        {/* Back button for step 4 */}
        {step === TOTAL_STEPS && !loading && (
          <div className="mt-4 flex justify-start">
            <button
              type="button"
              onClick={prevStep}
              className="rounded-lg px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              ← Voltar
            </button>
          </div>
        )}
      </ModalCard>
    </ModalOverlay>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

interface ModalOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
}

function ModalOverlay({ children, onClose }: ModalOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Content */}
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </div>
  );
}

interface ModalCardProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  ref?: React.RefObject<HTMLDivElement | null>;
}

function ModalCard({ children, title, subtitle, ref }: ModalCardProps) {
  return (
    <div
      ref={ref}
      className={[
        'w-full rounded-2xl border border-white/[0.08]',
        'bg-[#141417] shadow-[0_24px_80px_rgba(0,0,0,0.6)]',
        'p-6',
      ].join(' ')}
    >
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-base font-semibold text-white leading-snug">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-white/35">{subtitle}</p>}
      </div>

      {children}
    </div>
  );
}

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: readonly string[];
}

function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <div
      className="flex items-center gap-0 mt-4"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemax={totalSteps}
    >
      {Array.from({ length: totalSteps }).map((_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={stepNum} className="flex items-center flex-1 last:flex-none">
            {/* Pill */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200',
                  isCompleted
                    ? 'bg-violet-500 text-white'
                    : isCurrent
                      ? 'bg-violet-600/30 text-violet-400 ring-1 ring-violet-500/50'
                      : 'bg-white/[0.06] text-white/25',
                ].join(' ')}
                aria-label={`Passo ${stepNum}: ${labels[i]}`}
              >
                {isCompleted ? (
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={[
                  'text-[10px] font-medium',
                  isCurrent ? 'text-white/60' : 'text-white/20',
                ].join(' ')}
              >
                {labels[i]}
              </span>
            </div>

            {/* Connector line */}
            {stepNum < totalSteps && (
              <div
                className={[
                  'h-px flex-1 mx-2 transition-all duration-300',
                  isCompleted ? 'bg-violet-500/60' : 'bg-white/[0.08]',
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SuccessViewProps {
  jobId: string;
  onClose: () => void;
}

function SuccessView({ jobId, onClose }: SuccessViewProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      {/* Success icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40">
        <svg
          className="h-7 w-7 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Exportação em fila</h3>
        <p className="mt-1.5 text-xs text-white/45 leading-relaxed max-w-xs">
          O arquivo está sendo gerado em segundo plano. Você poderá baixá-lo assim que o
          processamento for concluído.
        </p>
      </div>

      {/* Job ID */}
      <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 ring-1 ring-white/[0.08]">
        <span className="text-xs text-white/30">Job ID:</span>
        <code className="text-xs font-mono text-white/60 tabular-nums">{jobId}</code>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-1 w-full rounded-xl bg-white/[0.07] px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        Ver na lista de exportações
      </button>
    </div>
  );
}
