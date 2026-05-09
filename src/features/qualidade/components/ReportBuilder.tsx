/**
 * ReportBuilder.tsx
 *
 * 3-step wizard for audit report generation.
 * Guides user through period selection, filters, and format/generation.
 *
 * Dark-first design (bg-[#141417], world-class UI reference: Apple/Linear/Stripe).
 * WCAG AA compliant (fieldset grouping, proper labels, error messages).
 *
 * Phase 7 Wave 4: Advanced Auditoria
 * RDC 978 Art. 107 — Audit trail documentation
 * DICQ 4.4 — Audit monitoring + reporting
 *
 * Features:
 * - Step 1: Period selection (Daily, Weekly, Monthly, Custom)
 * - Step 2: Filters (Anomalies, Compliance, Operators, Modules)
 * - Step 3: Format and Generate (PDF, CSV)
 * - Form validation with inline error messages
 * - Progress indicator (visual step markers)
 * - Back/Next navigation
 */

import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAuditReportExport } from '../hooks/useAuditReportExport';
import type { ReportFilter, ReportFormat, ReportPeriod } from '../types/anomalyTypes';
import type { LabId } from '../types/shared_refs';

interface ReportBuilderProps {
  labId?: LabId;
  onComplete?: (reportId: string) => void;
}

type WizardStep = 1 | 2 | 3;

interface FormState {
  period: ReportPeriod | '';
  startDate: string;
  endDate: string;
  includeAnomalies: boolean;
  includeCompliance: boolean;
  operatorIds: string[];
  modules: string[];
  format: ReportFormat;
}

const DEFAULT_OPERATORS = ['op-001', 'op-002', 'op-003', 'op-004', 'op-005'];
const DEFAULT_MODULES = [
  'analyzer',
  'coagulacao',
  'ciq-imuno',
  'insumos',
  'controle-temperatura',
];

export function ReportBuilder({ labId: propLabId, onComplete }: ReportBuilderProps) {
  const contextLabId = useActiveLabId();
  const labId = (propLabId || contextLabId) as LabId;

  const { generating, error, generate, reset } = useAuditReportExport();
  const [step, setStep] = useState<WizardStep>(1);
  const [formState, setFormState] = useState<FormState>({
    period: '',
    startDate: '',
    endDate: '',
    includeAnomalies: true,
    includeCompliance: true,
    operatorIds: [],
    modules: [],
    format: 'pdf',
  });

  // Validation helpers
  const isStep1Valid = (): boolean => {
    if (!formState.period) return false;
    if (formState.period === 'custom') {
      return formState.startDate !== '' && formState.endDate !== '';
    }
    return true;
  };

  const isStep2Valid = (): boolean => {
    return formState.includeAnomalies || formState.includeCompliance;
  };

  const getDateRange = (): [Date, Date] => {
    const today = new Date();
    let start: Date;

    switch (formState.period) {
      case 'daily':
        start = new Date(today);
        start.setDate(today.getDate() - 1);
        return [start, today];

      case 'weekly':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        return [start, today];

      case 'monthly':
        start = new Date(today);
        start.setMonth(today.getMonth() - 1);
        return [start, today];

      case 'custom':
        return [new Date(formState.startDate), new Date(formState.endDate)];

      default:
        return [today, today];
    }
  };

  const handlePeriodChange = (period: ReportPeriod) => {
    setFormState((prev) => ({
      ...prev,
      period,
      startDate: '',
      endDate: '',
    }));
  };

  const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleCheckboxChange = (key: string, value: boolean) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleOperatorChange = (opId: string) => {
    setFormState((prev) => ({
      ...prev,
      operatorIds: prev.operatorIds.includes(opId)
        ? prev.operatorIds.filter((id) => id !== opId)
        : [...prev.operatorIds, opId],
    }));
  };

  const handleModuleChange = (module: string) => {
    setFormState((prev) => ({
      ...prev,
      modules: prev.modules.includes(module)
        ? prev.modules.filter((m) => m !== module)
        : [...prev.modules, module],
    }));
  };

  const handleFormatChange = (format: ReportFormat) => {
    setFormState((prev) => ({ ...prev, format }));
  };

  const handleNext = () => {
    if (step === 1 && !isStep1Valid()) return;
    if (step === 2 && !isStep2Valid()) return;
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  const handleGenerate = async () => {
    const [startDate, endDate] = getDateRange();
    const filter: ReportFilter = {
      labId,
      period: formState.period as ReportPeriod,
      startDate,
      endDate,
      modules: formState.modules.length > 0 ? formState.modules : undefined,
      operatorIds: formState.operatorIds.length > 0 ? formState.operatorIds : undefined,
      includeAnomalies: formState.includeAnomalies,
      includeCompliance: formState.includeCompliance,
    };

    try {
      await generate(filter, formState.format);
      // Reset form after successful generation
      reset();
      setStep(1);
      setFormState({
        period: '',
        startDate: '',
        endDate: '',
        includeAnomalies: true,
        includeCompliance: true,
        operatorIds: [],
        modules: [],
        format: 'pdf',
      });
    } catch (err) {
      console.error('[ReportBuilder] Generation error:', err);
    }
  };

  const periodPreview = (): string => {
    if (!formState.period) return '';
    const [start, end] = getDateRange();
    const startStr = start.toLocaleDateString('pt-BR');
    const endStr = end.toLocaleDateString('pt-BR');
    return `${startStr} a ${endStr}`;
  };

  return (
    <div className="space-y-6 bg-[#141417] p-6 rounded-lg max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Gerar Relatório de Auditoria</h2>
        <p className="text-sm text-white/60 mt-1">
          Configure o período, filtros e formato do seu relatório
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                step >= s
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-1 rounded-full transition-colors ${
                  step > s ? 'bg-violet-600' : 'bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Period Selection */}
      {step === 1 && (
        <fieldset className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="text-sm font-semibold text-white mb-4">
            Passo 1: Selecione o Período
          </legend>

          <div className="space-y-3">
            {/* Daily */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded transition-colors">
              <input
                type="radio"
                name="period"
                value="daily"
                checked={formState.period === 'daily'}
                onChange={() => handlePeriodChange('daily')}
                className="w-4 h-4 accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">Últimas 24 horas</p>
                <p className="text-xs text-white/50">Período diário</p>
              </div>
            </label>

            {/* Weekly */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded transition-colors">
              <input
                type="radio"
                name="period"
                value="weekly"
                checked={formState.period === 'weekly'}
                onChange={() => handlePeriodChange('weekly')}
                className="w-4 h-4 accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">Últimos 7 dias</p>
                <p className="text-xs text-white/50">Período semanal</p>
              </div>
            </label>

            {/* Monthly */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded transition-colors">
              <input
                type="radio"
                name="period"
                value="monthly"
                checked={formState.period === 'monthly'}
                onChange={() => handlePeriodChange('monthly')}
                className="w-4 h-4 accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">Últimos 30 dias</p>
                <p className="text-xs text-white/50">Período mensal</p>
              </div>
            </label>

            {/* Custom */}
            <label className="flex items-start gap-3 cursor-pointer hover:bg-white/5 p-3 rounded transition-colors">
              <input
                type="radio"
                name="period"
                value="custom"
                checked={formState.period === 'custom'}
                onChange={() => handlePeriodChange('custom')}
                className="w-4 h-4 accent-violet-500 mt-1"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Período personalizado</p>
                <p className="text-xs text-white/50 mb-2">Selecione um intervalo específico</p>
                {formState.period === 'custom' && (
                  <div className="space-y-2 ml-6">
                    <div>
                      <label htmlFor="start-date" className="text-xs text-white/70 block mb-1">
                        Data inicial
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        value={formState.startDate}
                        onChange={(e) => handleDateChange('startDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="end-date" className="text-xs text-white/70 block mb-1">
                        Data final
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        value={formState.endDate}
                        onChange={(e) => handleDateChange('endDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Period Preview */}
          {formState.period && periodPreview() && (
            <div className="rounded bg-white/5 border border-white/10 p-3 mt-4">
              <p className="text-xs text-white/70">
                O relatório incluirá entradas de <strong>{periodPreview()}</strong>
              </p>
            </div>
          )}

          {/* Validation Error */}
          {step === 1 && !isStep1Valid() && (
            <div className="rounded bg-red-600/20 border border-red-600/30 p-3 mt-4">
              <p className="text-xs text-red-400">Selecione um período válido</p>
            </div>
          )}
        </fieldset>
      )}

      {/* Step 2: Filters */}
      {step === 2 && (
        <fieldset className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="text-sm font-semibold text-white mb-4">
            Passo 2: Configure os Filtros
          </legend>

          {/* Checkboxes for report content */}
          <div className="space-y-2 mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.includeAnomalies}
                onChange={(e) => handleCheckboxChange('includeAnomalies', e.target.checked)}
                className="w-4 h-4 accent-violet-500 rounded"
              />
              <span className="text-sm text-white/80">Incluir anomalias detectadas</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.includeCompliance}
                onChange={(e) => handleCheckboxChange('includeCompliance', e.target.checked)}
                className="w-4 h-4 accent-violet-500 rounded"
              />
              <span className="text-sm text-white/80">Incluir métricas de conformidade</span>
            </label>
          </div>

          {/* Operators */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/70">Operadores (opcional)</p>
            <div className="space-y-2 pl-4">
              {DEFAULT_OPERATORS.map((opId) => (
                <label key={opId} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.operatorIds.includes(opId)}
                    onChange={() => handleOperatorChange(opId)}
                    className="w-4 h-4 accent-violet-500 rounded"
                  />
                  <span className="text-sm text-white/70">{opId}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Modules */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/70">Módulos (opcional)</p>
            <div className="space-y-2 pl-4">
              {DEFAULT_MODULES.map((module) => (
                <label key={module} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.modules.includes(module)}
                    onChange={() => handleModuleChange(module)}
                    className="w-4 h-4 accent-violet-500 rounded"
                  />
                  <span className="text-sm text-white/70">{module}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Validation Error */}
          {step === 2 && !isStep2Valid() && (
            <div className="rounded bg-red-600/20 border border-red-600/30 p-3 mt-4">
              <p className="text-xs text-red-400">
                Selecione ao menos uma opção de conteúdo
              </p>
            </div>
          )}
        </fieldset>
      )}

      {/* Step 3: Format and Generate */}
      {step === 3 && (
        <fieldset className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="text-sm font-semibold text-white mb-4">
            Passo 3: Formato e Geração
          </legend>

          <div className="space-y-3">
            {/* PDF */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded transition-colors">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={formState.format === 'pdf'}
                onChange={() => handleFormatChange('pdf')}
                className="w-4 h-4 accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">PDF</p>
                <p className="text-xs text-white/50">Formato otimizado para impressão</p>
              </div>
            </label>

            {/* CSV */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded transition-colors">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={formState.format === 'csv'}
                onChange={() => handleFormatChange('csv')}
                className="w-4 h-4 accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">CSV</p>
                <p className="text-xs text-white/50">Formato para análise em planilhas</p>
              </div>
            </label>
          </div>

          {/* Summary */}
          <div className="rounded bg-white/3 border border-white/10 p-4 space-y-2 mt-6">
            <p className="text-sm font-medium text-white">Resumo do Relatório</p>
            <ul className="text-xs text-white/70 space-y-1">
              <li>• Período: {periodPreview()}</li>
              <li>
                • Conteúdo: {[
                  formState.includeAnomalies && 'Anomalias',
                  formState.includeCompliance && 'Conformidade',
                ]
                  .filter(Boolean)
                  .join(', ')}
              </li>
              {formState.operatorIds.length > 0 && (
                <li>• Operadores: {formState.operatorIds.join(', ')}</li>
              )}
              {formState.modules.length > 0 && (
                <li>• Módulos: {formState.modules.join(', ')}</li>
              )}
              <li>• Formato: {formState.format.toUpperCase()}</li>
            </ul>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="rounded bg-red-600/20 border border-red-600/30 p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </fieldset>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center gap-4 pt-4">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Voltar para o passo anterior"
        >
          Voltar
        </button>

        {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={
              (step === 1 && !isStep1Valid()) ||
              (step === 2 && !isStep2Valid())
            }
            className="px-6 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label={`Avançar para o passo ${step + 1}`}
          >
            Próximo
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Gerar e baixar relatório"
          >
            {generating ? 'Gerando...' : 'Gerar e Baixar'}
          </button>
        )}
      </div>

      {/* Step Counter */}
      <div className="text-xs text-white/50 text-center">
        Passo {step} de 3
      </div>
    </div>
  );
}
