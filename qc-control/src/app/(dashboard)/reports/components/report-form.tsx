'use client';

import { Button } from '@/components/ui/button';

type ReportType = 'MONTHLY_QC_SUMMARY' | 'LOT_PERFORMANCE' | 'CORRECTIVE_ACTIONS' | 'EQUIPMENT';

interface ReportFormProps {
  selectedType: ReportType;
  onSelectType: (t: ReportType) => void;
  periodStart: string;
  periodEnd: string;
  periodPreset: string | null;
  onApplyPreset: (p: string) => void;
  onPeriodStartChange: (v: string) => void;
  onPeriodEndChange: (v: string) => void;
  scope: Record<string, string>;
  onScopeChange: (s: Record<string, string>) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'MONTHLY_QC_SUMMARY',
    label: 'Monthly QC Summary',
    description: 'Aggregated QC runs by lot with pass rate and violations',
  },
  {
    value: 'LOT_PERFORMANCE',
    label: 'Lot Performance',
    description: 'Mean, SD, CV%, and Sigma for each lot',
  },
  {
    value: 'CORRECTIVE_ACTIONS',
    label: 'Corrective Actions',
    description: 'All CA with aging analysis',
  },
  {
    value: 'EQUIPMENT',
    label: 'Equipment',
    description: 'Calibration and maintenance logs',
  },
];

const PERIOD_PRESETS = [
  { value: 'LAST_MONTH', label: 'Last Month' },
  { value: 'LAST_QUARTER', label: 'Last Quarter' },
  { value: 'LAST_YEAR', label: 'Last Year' },
  { value: 'CUSTOM', label: 'Custom' },
];

export function ReportForm({
  selectedType,
  onSelectType,
  periodStart,
  periodEnd,
  periodPreset,
  onApplyPreset,
  onPeriodStartChange,
  onPeriodEndChange,
  scope,
  onScopeChange,
  isGenerating,
  onGenerate,
}: ReportFormProps) {
  const showCustom = periodPreset === 'CUSTOM';
  const showAnalyzer = selectedType === 'EQUIPMENT';
  const showAnalyte = selectedType === 'MONTHLY_QC_SUMMARY' || selectedType === 'LOT_PERFORMANCE';

  return (
    <div className="border border-border rounded bg-white p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-outline">Report Type</h2>
        <div className="grid grid-cols-2 gap-3">
          {REPORT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-3 border border-border rounded cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-variant"
            >
              <input
                type="radio"
                name="reportType"
                value={opt.value}
                checked={selectedType === opt.value}
                onChange={() => onSelectType(opt.value)}
                className="mt-1 accent-primary"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-on-surface">{opt.label}</span>
                <span className="text-xs text-on-surface-variant">{opt.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-outline">Period</h2>
        <div className="flex items-center gap-2">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onApplyPreset(preset.value)}
              className={`h-10 px-4 rounded text-sm font-semibold transition-colors ${
                periodPreset === preset.value
                  ? 'bg-primary text-white'
                  : 'border border-border-variant text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {showCustom && (
          <div className="flex items-center gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                From
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => onPeriodStartChange(e.target.value)}
                className="h-10 px-3 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                To
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => onPeriodEndChange(e.target.value)}
                className="h-10 px-3 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {(showAnalyzer || showAnalyte) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-outline">Scope</h2>
          <div className="flex gap-4">
            {showAnalyzer && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Analyzer
                </label>
                <select
                  value={scope.analyzerId || ''}
                  onChange={(e) => onScopeChange({ ...scope, analyzerId: e.target.value })}
                  className="h-10 min-w-[200px] px-3 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All analyzers</option>
                </select>
              </div>
            )}
            {showAnalyte && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Analyte
                </label>
                <select
                  value={scope.analyte || ''}
                  onChange={(e) => onScopeChange({ ...scope, analyte: e.target.value })}
                  className="h-10 min-w-[200px] px-3 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All analytes</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="primary" size="md" loading={isGenerating} onClick={onGenerate}>
          {isGenerating ? 'Generating...' : 'Generate PDF'}
        </Button>
        <Button variant="outline" size="md" disabled={isGenerating}>
          Download Excel
        </Button>
      </div>
    </div>
  );
}
