/**
 * BatchFormatSelector — Multi-format checkbox UI for batch export.
 *
 * Allows selecting 1 to 5 export formats from the 4 available options.
 * Shows a summary of how many files will be generated.
 *
 * Design: dark card per option, violet-500 accent checkboxes,
 * validation prevents proceeding without at least 1 selection.
 */

import { useCallback, useId } from 'react';

export type BatchExportFormat = 'xlsx-ciq' | 'xlsx-nc' | 'pdf-compliance' | 'csv-audit';

interface FormatOption {
  id: BatchExportFormat;
  label: string;
  description: string;
  extension: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'xlsx-ciq',
    label: 'XLSX — Corridas CIQ',
    description:
      'Exporta todas as corridas de controle interno de qualidade com formatação condicional (vermelho=inválido, âmbar=pendente, verde=válido).',
    extension: '.xlsx',
  },
  {
    id: 'xlsx-nc',
    label: 'XLSX — Registro de NCs',
    description:
      'Planilha com todas as não-conformidades: título, módulo, severidade, status e datas de abertura e fechamento.',
    extension: '.xlsx',
  },
  {
    id: 'pdf-compliance',
    label: 'PDF — Relatório de Conformidade',
    description:
      'Relatório em PDF comprimido com histórico de conformidade do laboratório. Gerado conforme RDC 978/2025.',
    extension: '.pdf',
  },
  {
    id: 'csv-audit',
    label: 'CSV — Log de Auditoria',
    description:
      'Log forense completo em formato CSV (RFC 4180, UTF-8 BOM). Inclui operador, ação, hashes e timestamps em ISO 8601.',
    extension: '.csv',
  },
];

interface BatchFormatSelectorProps {
  /** Currently selected formats */
  selectedFormats: Set<BatchExportFormat>;
  /** Called when a format is toggled */
  onToggle: (format: BatchExportFormat) => void;
}

export function BatchFormatSelector({ selectedFormats, onToggle }: BatchFormatSelectorProps) {
  const groupId = useId();
  const count = selectedFormats.size;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-white">Selecionar formatos</h3>
        <p className="mt-0.5 text-xs text-white/40 leading-relaxed">
          Escolha entre 1 e 5 formatos. Um arquivo será gerado para cada seleção.
        </p>
      </div>

      {/* Format cards */}
      <fieldset aria-label="Formatos de exportação">
        <legend className="sr-only">Selecione os formatos para exportação em lote</legend>
        <div className="space-y-2" role="group" aria-labelledby={`${groupId}-label`}>
          <span id={`${groupId}-label`} className="sr-only">
            Formatos de exportação disponíveis
          </span>
          {FORMAT_OPTIONS.map((option) => {
            const isChecked = selectedFormats.has(option.id);
            const inputId = `${groupId}-${option.id}`;

            return (
              <FormatCard
                key={option.id}
                option={option}
                isChecked={isChecked}
                inputId={inputId}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      </fieldset>

      {/* Summary bar */}
      <div
        className={[
          'rounded-lg border px-3 py-2 transition-colors duration-200',
          count === 0 ? 'border-red-500/30 bg-red-500/10' : 'border-violet-500/20 bg-violet-500/10',
        ].join(' ')}
      >
        {count === 0 ? (
          <p className="text-xs text-red-400" role="alert">
            Selecione pelo menos 1 formato para continuar.
          </p>
        ) : (
          <p className="text-xs text-violet-300/80">
            <span className="font-semibold text-violet-200">{count}</span>{' '}
            {count === 1 ? 'arquivo será gerado.' : 'arquivos serão gerados.'} Processamento em
            paralelo via fila de exportação.
          </p>
        )}
      </div>
    </div>
  );
}

// ── FormatCard sub-component ─────────────────────────────────────────────────

interface FormatCardProps {
  option: FormatOption;
  isChecked: boolean;
  inputId: string;
  onToggle: (format: BatchExportFormat) => void;
}

function FormatCard({ option, isChecked, inputId, onToggle }: FormatCardProps) {
  const handleChange = useCallback(() => {
    onToggle(option.id);
  }, [option.id, onToggle]);

  return (
    <label
      htmlFor={inputId}
      className={[
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3',
        'transition-all duration-150',
        isChecked
          ? 'border-violet-500/40 bg-violet-500/10'
          : 'border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]',
      ].join(' ')}
    >
      {/* Checkbox */}
      <div className="mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          id={inputId}
          checked={isChecked}
          onChange={handleChange}
          className={[
            'h-4 w-4 rounded border cursor-pointer',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
            'accent-violet-500',
            isChecked ? 'border-violet-500 bg-violet-500' : 'border-white/20 bg-white/[0.05]',
          ].join(' ')}
          aria-describedby={`${inputId}-desc`}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={[
              'text-sm font-medium transition-colors duration-150',
              isChecked ? 'text-white' : 'text-white/70',
            ].join(' ')}
          >
            {option.label}
          </span>
          <span
            className={[
              'rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide transition-colors duration-150',
              isChecked ? 'bg-violet-500/20 text-violet-300' : 'bg-white/[0.06] text-white/30',
            ].join(' ')}
          >
            {option.extension}
          </span>
        </div>
        <p id={`${inputId}-desc`} className="mt-1 text-[11px] leading-relaxed text-white/30">
          {option.description}
        </p>
      </div>
    </label>
  );
}
