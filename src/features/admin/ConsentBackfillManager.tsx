/**
 * ConsentBackfillManager.tsx
 * Operational UI for Wave 4 Agent 6 patient consent backfill workflow.
 *
 * Phases:
 *   1. Inventory — export patient list, review coverage
 *   2. Outreach — patient contact list upload (placeholder)
 *   3. Batch upload — multi-step wizard for CSV + callable integration
 *   4. Cutover — activation date + audit log
 *
 * Compliance: LGPD Arts. 7º, 11; RDC 978 Art. 128; DICQ 4.4
 */

import React, { useState, useCallback } from 'react';
import { useActiveLabId } from '../../store/useAuthStore';
import { useConsentBackfillPhases } from './hooks/useConsentBackfillPhases';
import type { ConsentBackfillPhase, BackfillStats } from './hooks/useConsentBackfillPhases';

// ─── Icons ───────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6 10l3 3 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 6v4M10 14h0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Phase 1: Inventory ──────────────────────────────────────────────────────

interface Phase1Props {
  stats: BackfillStats | null;
  isLoading: boolean;
  onExportCsv: () => Promise<void>;
}

function Phase1Inventory({ stats, isLoading, onExportCsv }: Phase1Props) {
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    try {
      await onExportCsv();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar inventário');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-white/2 rounded-lg border border-white/5">
        <h3 className="text-sm font-semibold text-white/90 mb-4">Estatísticas do inventário</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-white/1 rounded-lg">
            <p className="text-xs text-white/50">Pacientes ativos</p>
            <p className="text-2xl font-semibold text-white mt-1">{stats?.inventoryCount ?? '—'}</p>
          </div>
          <div className="p-3 bg-white/1 rounded-lg">
            <p className="text-xs text-white/50">Com consentimento</p>
            <p className="text-2xl font-semibold text-white mt-1">{stats?.consentedCount ?? '—'}</p>
          </div>
          <div className="p-3 bg-white/1 rounded-lg">
            <p className="text-xs text-white/50">Sem consentimento</p>
            <p className="text-2xl font-semibold text-white mt-1">
              {stats?.needsConsentCount ?? '—'}
            </p>
          </div>
          <div className="p-3 bg-white/1 rounded-lg">
            <p className="text-xs text-white/50">Cobertura</p>
            <p className="text-2xl font-semibold text-emerald-400 mt-1">
              {stats?.coveragePercent ?? '—'}%
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
      >
        {isLoading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Exportando...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path
                d="M8 3v7M5 7l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Exportar CSV
          </>
        )}
      </button>
    </div>
  );
}

// ─── Phase 3: Batch Upload Wizard ────────────────────────────────────────────

interface BatchEntry {
  patientId: string;
  consentedAt: string;
  capturedBy: string;
  signedDocPath: string;
  notes?: string;
}

interface Phase3Props {
  isLoading: boolean;
  onBatchSubmit: (
    entries: BatchEntry[],
  ) => Promise<{ ok: boolean; succeeded: number; failed: number }>;
}

function Phase3BatchUpload({ isLoading, onBatchSubmit }: Phase3Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [scope, setScope] = useState<string[]>(['ia-strip']);
  const [validationReport, setValidationReport] = useState<{
    valid: number;
    invalid: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [result, setResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Apenas arquivos CSV são aceitos');
        return;
      }
      setCsvFile(file);
      setError(null);
    }
  };

  const parseCsv = (text: string): BatchEntry[] => {
    const lines = text.trim().split('\n');
    const entries: BatchEntry[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim());
      if (cells.length < 4) {
        errors.push({ row: i + 1, error: 'Colunas insuficientes' });
        continue;
      }

      const [patientId, consentedAt, capturedBy, signedDocPath, notes] = cells;

      if (!patientId) {
        errors.push({ row: i + 1, error: 'patientId obrigatório' });
        continue;
      }

      if (!consentedAt || !/^\d{4}-\d{2}-\d{2}/.test(consentedAt)) {
        errors.push({ row: i + 1, error: 'consentedAt inválido (formato: YYYY-MM-DD)' });
        continue;
      }

      if (!capturedBy) {
        errors.push({ row: i + 1, error: 'capturedBy obrigatório' });
        continue;
      }

      if (!signedDocPath || !signedDocPath.includes('/')) {
        errors.push({ row: i + 1, error: 'signedDocPath inválido' });
        continue;
      }

      entries.push({
        patientId,
        consentedAt,
        capturedBy,
        signedDocPath,
        notes: notes || undefined,
      });
    }

    return entries;
  };

  const validateAndProceed = async () => {
    setError(null);

    if (!csvFile) {
      setError('Selecione um arquivo CSV');
      return;
    }

    const text = await csvFile.text();
    const entries = parseCsv(text);

    if (entries.length === 0) {
      setError('Nenhuma linha válida encontrada no CSV');
      return;
    }

    setValidationReport({
      valid: entries.length,
      invalid: text.split('\n').length - 1 - entries.length,
      errors: [],
    });

    setStep(4);
  };

  const submitBatch = async () => {
    if (!csvFile) return;

    setError(null);
    try {
      const text = await csvFile.text();
      const entries = parseCsv(text);

      const response = await onBatchSubmit(entries);
      setResult({ succeeded: response.succeeded, failed: response.failed });
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar batch');
    }
  };

  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-white/2 rounded-lg border border-white/5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Data de início</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Data de fim</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>

        <div className="p-4 bg-white/2 rounded-lg border border-white/5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Escopo do consentimento
            </label>
            <div className="space-y-2">
              {['ia-strip', 'ia-laudo', 'analytics'].map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scope.includes(s)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setScope([...scope, s]);
                      } else {
                        setScope(scope.filter((x) => x !== s));
                      }
                    }}
                    className="w-4 h-4 rounded border-white/30 accent-violet-500"
                  />
                  <span className="text-sm text-white/80 capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep(2)}
          disabled={!dateRange.start || !dateRange.end || scope.length === 0}
          className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
        >
          Próximo
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-white/2 rounded-lg border border-white/5 border-dashed text-center cursor-pointer hover:bg-white/3 transition-colors">
          <label className="cursor-pointer">
            <div className="text-white/70 text-sm font-medium">
              {csvFile ? (
                <>✓ {csvFile.name}</>
              ) : (
                <>
                  Clique ou arraste o arquivo CSV aqui
                  <p className="text-xs text-white/50 mt-2">
                    Colunas: patientId, consentedAt, capturedBy, signedDocPath, [notes]
                  </p>
                </>
              )}
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload CSV de consentimentos"
            />
          </label>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep(1)}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={validateAndProceed}
            disabled={!csvFile || isLoading}
            className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
          >
            {isLoading ? 'Validando...' : 'Validar'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-white/2 rounded-lg border border-white/5">
          <h3 className="text-sm font-semibold text-white/90 mb-3">Resumo</h3>
          <div className="space-y-2 text-sm text-white/70">
            <p>
              <span className="text-white/50">Período:</span> {dateRange.start} a {dateRange.end}
            </p>
            <p>
              <span className="text-white/50">Escopo:</span> {scope.join(', ')}
            </p>
            <p>
              <span className="text-white/50">Arquivo:</span> {csvFile?.name}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep(2)}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={() => setStep(3)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
          >
            {isLoading ? 'Processando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3">Relatório de validação</h3>
          <div className="space-y-2 text-sm">
            <p className="text-emerald-200">✓ {validationReport?.valid} linhas válidas</p>
            {validationReport?.invalid ? (
              <p className="text-yellow-200">⚠ {validationReport.invalid} linhas inválidas</p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setStep(2);
              setCsvFile(null);
            }}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submitBatch}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
          >
            {isLoading ? 'Enviando...' : 'Enviar batch'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3">Batch concluído</h3>
          <div className="space-y-2 text-sm">
            <p className="text-emerald-200">✓ {result?.succeeded} consentimentos registrados</p>
            {result?.failed ? (
              <p className="text-yellow-200">⚠ {result.failed} erros — veja o relatório</p>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => {
            setStep(1);
            setCsvFile(null);
            setResult(null);
            setValidationReport(null);
          }}
          className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-medium transition-colors"
        >
          Novo batch
        </button>
      </div>
    );
  }

  return null;
}

// ─── Phase Stepper ───────────────────────────────────────────────────────────

interface PhaseStepperProps {
  current: ConsentBackfillPhase;
  onPhaseSelect: (phase: ConsentBackfillPhase) => void;
}

function PhaseStepper({ current, onPhaseSelect }: PhaseStepperProps) {
  const phases: Array<{ id: ConsentBackfillPhase; label: string }> = [
    { id: 1, label: 'Inventário' },
    { id: 2, label: 'Contato' },
    { id: 3, label: 'Batch upload' },
    { id: 4, label: 'Ativação' },
  ];

  return (
    <div className="flex items-center justify-between mb-8">
      {phases.map((phase, idx) => (
        <div key={phase.id} className="flex items-center">
          <button
            onClick={() => onPhaseSelect(phase.id)}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
              phase.id === current
                ? 'bg-violet-600 text-white'
                : phase.id < current
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-white/50'
            }`}
          >
            {phase.id < current ? <CheckCircleIcon /> : phase.id === current ? phase.id : phase.id}
          </button>
          <p
            className={`text-xs ml-2 font-medium ${
              phase.id <= current ? 'text-white/90' : 'text-white/40'
            }`}
          >
            {phase.label}
          </p>
          {idx < phases.length - 1 && (
            <div
              className={`h-0.5 w-12 ml-4 transition-colors ${
                phase.id < current ? 'bg-emerald-600' : 'bg-white/10'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ConsentBackfillManager() {
  const labId = useActiveLabId();
  const { currentPhase, stats, isLoading, exportPatientList, submitBatch, setCurrentPhase } =
    useConsentBackfillPhases(labId);

  if (!labId) {
    return (
      <div className="p-6 bg-white/2 rounded-lg border border-white/5 text-white/70 text-sm">
        Selecione um laboratório para continuar
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Backfill de consentimento LGPD</h1>
        <p className="text-white/60 text-sm">
          Capture consentimento de pacientes para processamento de IA em imunologia
        </p>
      </div>

      {/* Stepper */}
      <PhaseStepper current={currentPhase} onPhaseSelect={setCurrentPhase} />

      {/* Content card */}
      <div className="p-6 bg-white/2 rounded-lg border border-white/5">
        {currentPhase === 1 && (
          <Phase1Inventory stats={stats} isLoading={isLoading} onExportCsv={exportPatientList} />
        )}

        {currentPhase === 2 && (
          <div className="space-y-4">
            <p className="text-white/60 text-sm">
              Preparar lista de contato de pacientes para outreach. Esta etapa é manual — use a
              lista do inventário acima como base.
            </p>
            <div className="p-4 bg-white/1 rounded-lg border border-white/10 text-white/60 text-sm">
              <p className="font-medium text-white/80 mb-2">Próximos passos:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Prepare um arquivo CSV com patientId, email, phone</li>
                <li>Carregue na plataforma (funcionalidade a ser implementada)</li>
                <li>Revise os template de email e SMS fornecidos</li>
                <li>Aprove o disparo de outreach</li>
              </ol>
            </div>
          </div>
        )}

        {currentPhase === 3 && (
          <Phase3BatchUpload isLoading={isLoading} onBatchSubmit={submitBatch} />
        )}

        {currentPhase === 4 && (
          <div className="space-y-4">
            <div className="p-4 bg-white/2 rounded-lg border border-white/5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Data de ativação
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            {stats && stats.coveragePercent >= 95 ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm">
                ✓ Cobertura de {stats.coveragePercent}% atende ao critério (≥95%)
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-300 text-sm">
                ⚠ Cobertura de {stats?.coveragePercent ?? 0}% — mínimo esperado é 95%
              </div>
            )}

            <button
              disabled={!stats || stats.coveragePercent < 95}
              className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
            >
              Ativar consentGate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
