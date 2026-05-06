/**
 * ExportStep1 — Format selection step
 * Shows format cards: XLSX CIQ (violet) + XLSX NC (emerald). PDF deferred to Phase 3.3.
 */

import { type ExportFormat } from '../types';

interface FormatCard {
  format: ExportFormat;
  title: string;
  description: string;
  accent: 'violet' | 'emerald';
  badge: string;
}

const FORMATS: FormatCard[] = [
  {
    format: 'xlsx-ciq',
    title: 'XLSX — Corridas CIQ',
    description:
      'Corridas de controle interno de qualidade com formatação condicional por status (conforme/não conforme/pendente). Compatível com Excel 365 e Google Sheets.',
    accent: 'violet',
    badge: 'Recomendado',
  },
  {
    format: 'xlsx-nc',
    title: 'XLSX — Não-Conformidades',
    description:
      'Registro completo de NCs abertas e fechadas no período — título, módulo, severidade, status, operador e datas de abertura e fechamento.',
    accent: 'violet',
    badge: 'Qualidade',
  },
  {
    format: 'pdf-compliance',
    title: 'PDF — Relatório de Conformidade',
    description:
      'Relatório PDF comprimido com resumo de conformidade do período — adequado para auditorias RDC 978 §5.3 e envio a órgãos regulatórios.',
    accent: 'emerald',
    badge: 'Regulatório',
  },
  {
    format: 'csv-audit',
    title: 'CSV — Trilha de Auditoria',
    description:
      'Log de auditoria em formato CSV (RFC 4180, UTF-8 BOM) com todas as operações registradas no período. Compatível com Excel, LibreOffice e sistemas de análise.',
    accent: 'emerald',
    badge: 'Compliance',
  },
];

interface ExportStep1Props {
  selectedFormat: ExportFormat | null;
  onSelect: (format: ExportFormat) => void;
}

export function ExportStep1({ selectedFormat, onSelect }: ExportStep1Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-white/50 leading-relaxed">
        Selecione o formato do arquivo a ser gerado. O arquivo ficará disponível
        para download por 7 dias após a conclusão.
      </p>

      <div className="grid grid-cols-1 gap-3 mt-1">
        {FORMATS.map(({ format, title, description, accent, badge }) => {
          const isSelected = selectedFormat === format;

          const accentRing =
            accent === 'violet'
              ? 'ring-violet-500/60 bg-violet-500/10'
              : 'ring-emerald-500/60 bg-emerald-500/10';
          const idleRing = 'ring-white/10 bg-white/5 hover:bg-white/[0.07]';
          const badgeClass =
            accent === 'violet'
              ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30'
              : 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30';
          const iconBg =
            accent === 'violet' ? 'bg-violet-500/20' : 'bg-emerald-500/20';
          const iconColor =
            accent === 'violet' ? 'text-violet-400' : 'text-emerald-400';

          return (
            <button
              key={format}
              type="button"
              onClick={() => onSelect(format)}
              className={[
                'group relative flex items-start gap-4 rounded-xl p-4 text-left ring-1 transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                isSelected ? accentRing : idleRing,
              ].join(' ')}
              aria-pressed={isSelected}
            >
              {/* Format icon */}
              <div
                className={[
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  iconBg,
                ].join(' ')}
              >
                {/* XLSX spreadsheet icon */}
                <svg
                  className={['h-5 w-5', iconColor].join(' ')}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  />
                </svg>
              </div>

              {/* Label + desc */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white leading-snug">
                    {title}
                  </span>
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide',
                      badgeClass,
                    ].join(' ')}
                  >
                    {badge}
                  </span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">{description}</p>
              </div>

              {/* Selection indicator */}
              <div
                className={[
                  'mt-1 h-4 w-4 shrink-0 rounded-full ring-1 transition-all duration-150',
                  isSelected
                    ? accent === 'violet'
                      ? 'bg-violet-500 ring-violet-500'
                      : 'bg-emerald-500 ring-emerald-500'
                    : 'bg-transparent ring-white/20',
                ].join(' ')}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <p className="mt-1 text-xs text-white/25 text-center">
        Arquivo disponível para download por 7 dias após geração.
      </p>
    </div>
  );
}
