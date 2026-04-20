import React, { useState, useRef, useCallback, useId } from 'react';
import { extractDataFromBulaPdf } from './services/bulaGeminiService';
import { convertPdfToImage } from './utils/pdfConverter';
import {
  convertBulaPDFtoCSV,
  downloadCsvFile,
  buildCsvFilename,
  MAX_BULA_PDF_SIZE_BYTES,
  DEFAULT_EXPORT_FORM,
  type BulaExportFormData,
} from './services/bulaExportService';
import { ANALYTE_MAP } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import type { BulaLevelData, PendingBulaData } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect
        x="4"
        y="2"
        width="18"
        height="24"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.4"
      />
      <path
        d="M18 2v7h8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.4"
      />
      <rect
        x="8"
        y="18"
        width="16"
        height="12"
        rx="2"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.3"
      />
      <path
        d="M11.5 22.5h2c.8 0 1.5.6 1.5 1.5s-.7 1.5-1.5 1.5H11.5V22h0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.6"
      />
      <path
        d="M17 22.5h1.5c1.1 0 2 .9 2 2s-.9 2-2 2H17v-4z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.6"
      />
      <path
        d="M22 22.5h2.5M22 24.5h2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
    </svg>
  );
}

function UploadCloudIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M9 18.5A5 5 0 019 8.5a5.5 5.5 0 0110.7-1.5A4.5 4.5 0 0124 11.5a4.5 4.5 0 01-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M14 14v9M11 17l3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1L13 13H1L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 6v3M7 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 7l3 3 6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 2v7M4.5 6.5L7 9l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled: boolean;
}

function DropZone({ onFile, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Área para soltar ou selecionar arquivo PDF"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`
        relative flex flex-col items-center justify-center gap-4
        rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none
        py-16 px-8 text-center
        ${
          dragging
            ? 'border-violet-500/60 bg-violet-500/[0.06]'
            : 'border-white/[0.1] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.03]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className={`text-white/25 transition-transform ${dragging ? 'scale-110' : ''}`}>
        <UploadCloudIcon />
      </div>
      <div>
        <p className="text-sm font-medium text-white/60">
          {dragging ? 'Solte o PDF aqui' : 'Arraste a bula PDF ou clique para selecionar'}
        </p>
        <p className="text-xs text-white/25 mt-1">Apenas arquivos PDF · Máx. 10 MB</p>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        disabled={disabled}
        title="Selecionar arquivo PDF"
        className="sr-only"
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIMARY_EQUIPMENT_KEYWORDS = ['yumizen', 'horiba', 'abx'];

function isFallbackSource(source: string | undefined): boolean {
  if (!source) return false;
  const lower = source.toLowerCase();
  return !PRIMARY_EQUIPMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

const LEVEL_TAB_COLORS: Record<number, { tab: string; badge: string }> = {
  1: {
    tab: 'border-blue-500/50  text-blue-400  bg-blue-500/[0.08]',
    badge: 'text-blue-400 bg-blue-500/15 border-blue-500/25',
  },
  2: {
    tab: 'border-amber-500/50 text-amber-400 bg-amber-500/[0.08]',
    badge: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
  },
  3: {
    tab: 'border-rose-500/50  text-rose-400  bg-rose-500/[0.08]',
    badge: 'text-rose-400 bg-rose-500/15 border-rose-500/25',
  },
};

const LEVEL_INACTIVE_COLORS: Record<number, string> = {
  1: 'text-blue-400/50  hover:text-blue-400  hover:bg-blue-500/[0.04]',
  2: 'text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/[0.04]',
  3: 'text-rose-400/50  hover:text-rose-400  hover:bg-rose-500/[0.04]',
};

// ─── Level table ──────────────────────────────────────────────────────────────

function LevelTable({ lvl }: { lvl: BulaLevelData }) {
  const analytes = Object.entries(lvl.manufacturerStats);

  if (analytes.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-white/30">Nenhum analito extraído para este nível.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto] bg-white/[0.03] border-b border-white/[0.07] px-4 py-2.5 gap-3">
        <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
          Analito
        </span>
        <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider text-right">
          Média
        </span>
        <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider text-right">
          ±DP
        </span>
        <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider text-right">
          Fonte
        </span>
      </div>
      <div className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
        {analytes.map(([id, stats]) => {
          const meta = ANALYTE_MAP[id];
          const dp = meta?.decimals ?? 2;
          const source = lvl.equipmentSources?.[id];
          const isFallback = isFallbackSource(source);

          return (
            <div
              key={id}
              className={`
                grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 gap-3
                transition-colors hover:bg-white/[0.02]
                ${isFallback ? 'bg-amber-500/[0.04]' : ''}
              `}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`text-sm font-medium ${isFallback ? 'text-amber-300' : 'text-white/80'}`}
                >
                  {meta?.name ?? id}
                </span>
                {meta && <span className="text-xs text-white/25">{meta.unit}</span>}
              </div>
              <span className="text-sm font-mono text-white/70 text-right">
                {stats.mean.toFixed(dp)}
              </span>
              <span className="text-sm font-mono text-white/45 text-right">
                {stats.sd.toFixed(dp)}
              </span>
              <div className="text-right">
                {isFallback ? (
                  <span
                    title={`Fallback: ${source}`}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/25 text-amber-400 whitespace-nowrap"
                  >
                    <WarnIcon />
                    Pentra
                  </span>
                ) : (
                  <span className="text-[10px] text-white/20">H550</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result panel ─────────────────────────────────────────────────────────────

interface ResultPanelProps {
  data: PendingBulaData;
  fileName: string;
  formData: BulaExportFormData;
  onFormChange: (patch: Partial<BulaExportFormData>) => void;
  onReset: () => void;
  onDownload: () => void;
  onConfirm: () => void;
}

function ResultPanel({
  data,
  fileName,
  formData,
  onFormChange,
  onReset,
  onDownload,
  onConfirm,
}: ResultPanelProps) {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>((data.levels[0]?.level ?? 1) as 1 | 2 | 3);

  const fmtDate = data.expiryDate
    ? data.expiryDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  const totalAnalytes = data.levels.reduce(
    (sum, lvl) => sum + Object.keys(lvl.manufacturerStats).length,
    0,
  );

  const activeLevel = data.levels.find((l) => l.level === activeTab);

  const hasFallbacks = data.levels.some((lvl) =>
    Object.values(lvl.equipmentSources ?? {}).some(isFallbackSource),
  );

  return (
    <div className="space-y-5">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-violet-400">
        <div className="w-5 h-5 rounded-md bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
          <SparkleIcon />
        </div>
        <span className="font-medium">Extração concluída</span>
        <span className="text-white/25 truncate">— {fileName}</span>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {data.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5"
            >
              <span className="shrink-0 mt-0.5">
                <WarnIcon />
              </span>
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Metadata card */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] divide-y divide-white/[0.05]">
        {[
          {
            label: 'Controle',
            value: data.controlName ?? (
              <span className="text-white/25 italic">não identificado</span>
            ),
          },
          {
            label: 'Vencimento',
            value: fmtDate ?? <span className="text-white/25 italic">não identificado</span>,
          },
          {
            label: 'Níveis extraídos',
            value: (
              <div className="flex gap-1.5 justify-end">
                {data.levels.map((l) => (
                  <span
                    key={l.level}
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded-md border ${LEVEL_TAB_COLORS[l.level].badge}`}
                  >
                    N{l.level}
                  </span>
                ))}
              </div>
            ),
          },
          {
            label: 'Analitos (total)',
            value: `${totalAnalytes} analito${totalAnalytes !== 1 ? 's' : ''}`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
            <span className="text-xs text-white/35 shrink-0">{label}</span>
            <span className="text-sm text-white/80 text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Fallback legend */}
      {hasFallbacks && (
        <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/[0.06] border border-amber-500/[0.15] rounded-xl px-3.5 py-2.5">
          <span className="shrink-0 mt-0.5">
            <WarnIcon />
          </span>
          <span>
            Alguns analitos foram extraídos do equipamento de fallback (Pentra) por ausência de
            dados do Yumizen H550. Revise antes de confirmar.
          </span>
        </div>
      )}

      {/* Level tabs */}
      {data.levels.length > 1 && (
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          {data.levels.map((l) => {
            const isActive = l.level === activeTab;
            return (
              <button
                key={l.level}
                type="button"
                onClick={() => setActiveTab(l.level)}
                className={`
                  flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${
                    isActive
                      ? LEVEL_TAB_COLORS[l.level].tab
                      : `border-transparent ${LEVEL_INACTIVE_COLORS[l.level]}`
                  }
                `}
              >
                Nível {l.level}
                {l.lotNumber && (
                  <span className="ml-1 font-normal text-[10px] opacity-60">#{l.lotNumber}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active level table */}
      {activeLevel && <LevelTable lvl={activeLevel} />}

      {/* Export form */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] divide-y divide-white/[0.05]">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          <label htmlFor="bula-equipment" className="text-xs text-white/35 shrink-0">
            Equipamento
          </label>
          <input
            id="bula-equipment"
            type="text"
            value={formData.equipmentName}
            onChange={(e) => onFormChange({ equipmentName: e.target.value })}
            placeholder="Ex: Yumizen H550"
            className="flex-1 min-w-0 bg-transparent text-sm text-white/80 text-right placeholder:text-white/20 outline-none"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          <label htmlFor="bula-serial" className="text-xs text-white/35 shrink-0">
            Serial
          </label>
          <input
            id="bula-serial"
            type="text"
            value={formData.serialNumber}
            onChange={(e) => onFormChange({ serialNumber: e.target.value })}
            placeholder="Opcional"
            className="flex-1 min-w-0 bg-transparent text-sm text-white/80 text-right placeholder:text-white/20 outline-none"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          <label htmlFor="bula-start-date" className="text-xs text-white/35 shrink-0">
            Data início
            <span className="text-violet-400 ml-0.5">*</span>
          </label>
          <input
            id="bula-start-date"
            type="date"
            value={formData.startDate}
            onChange={(e) => onFormChange({ startDate: e.target.value })}
            className="bg-transparent text-sm text-white/80 text-right outline-none [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onReset}
          className="py-2.5 px-4 rounded-xl border border-white/[0.08] text-sm text-white/35 hover:text-white/65 hover:bg-white/[0.04] transition-all whitespace-nowrap"
        >
          Outro PDF
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={!formData.startDate || totalAnalytes === 0}
          title={!formData.startDate ? 'Informe a data de início para baixar o CSV' : 'Baixar CSV'}
          className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <DownloadIcon />
          CSV
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={totalAnalytes === 0}
          className="flex-1 py-2.5 rounded-xl bg-violet-600/80 hover:bg-violet-600 border border-violet-500/30 text-sm font-medium text-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <CheckIcon />
          {data.levels.length > 1 ? `Criar ${data.levels.length} lotes` : 'Criar lote'}
        </button>
      </div>
    </div>
  );
}

// ─── Extraction state ─────────────────────────────────────────────────────────

type Phase = 'idle' | 'converting' | 'extracting' | 'done' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function BulaProcessor() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const setPendingBulaData = useAppStore((s) => s.setPendingBulaData);

  const [phase, setPhase] = useState<Phase>('idle');
  const [convProgress, setConvProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<PendingBulaData | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<BulaExportFormData>(DEFAULT_EXPORT_FORM);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Apenas arquivos PDF são suportados.');
      setPhase('error');
      return;
    }
    if (file.size > MAX_BULA_PDF_SIZE_BYTES) {
      setError(`Arquivo excede o limite de 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      setPhase('error');
      return;
    }

    setPhase('converting');
    setError(null);
    setFileName(file.name);

    try {
      // 1. Converter PDF para Imagem no Frontend (Opção A)
      const { base64, mimeType } = await convertPdfToImage(file, 4, (p) => {
        setConvProgress({ current: p.current, total: p.total });
      });

      // 2. Enviar imagem resultante para extração
      setPhase('extracting');
      const data = await extractDataFromBulaPdf(base64, mimeType);

      setResult(data);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado no processamento.');
      setPhase('error');
    }
  }, []);

  function handleReset() {
    setPhase('idle');
    setResult(null);
    setError(null);
    setFileName('');
    setFormData(DEFAULT_EXPORT_FORM);
  }

  function handleDownloadCsv() {
    if (!result) return;
    const csv = convertBulaPDFtoCSV(result, formData);
    downloadCsvFile(csv, buildCsvFilename(result.controlName, formData.startDate));
  }

  function handleConfirm() {
    if (!result) return;
    setPendingBulaData(result);
    setCurrentView('analyzer');
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-white/[0.06] shrink-0">
        <button
          type="button"
          onClick={() => setCurrentView('analyzer')}
          aria-label="Voltar ao analisador"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/35 hover:text-white/70 hover:bg-white/[0.07] transition-all"
        >
          <ArrowLeftIcon />
        </button>

        <div className="w-px h-4 bg-white/[0.08]" aria-hidden />

        <div className="flex items-center gap-2">
          <div className="text-white/30">
            <PdfIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80 leading-none">Importar bula PDF</p>
            <p className="text-[11px] text-white/30 mt-0.5">
              Extração automática de metas via IA — todos os níveis
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <div className="py-4 space-y-6">
          {phase === 'idle' && <DropZone onFile={handleFile} disabled={false} />}

          {phase === 'converting' && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-2xl bg-blue-500/10 border border-blue-500/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/70">Otimizando documento…</p>
                <div className="flex flex-col gap-1 mt-2">
                  <p className="text-xs text-white/30 truncate max-w-xs">{fileName}</p>
                  {convProgress.total > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${(convProgress.current / convProgress.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/20 font-mono">
                        Item {convProgress.current}/{convProgress.total}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {phase === 'extracting' && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-2xl bg-violet-500/10 border border-violet-500/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/70">Extraindo dados com IA…</p>
                <p className="text-xs text-white/30 mt-1 max-w-xs">
                  A imagem otimizada está sendo processada para identificar lotes e valores.
                </p>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
                <span className="shrink-0 mt-0.5">
                  <WarnIcon />
                </span>
                <div>
                  <p className="font-medium">Falha na extração</p>
                  <p className="text-red-400/70 text-xs mt-1">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 rounded-xl border border-white/[0.1] text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {phase === 'done' && result && (
            <ResultPanel
              data={result}
              fileName={fileName}
              formData={formData}
              onFormChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
              onReset={handleReset}
              onDownload={handleDownloadCsv}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </main>
    </div>
  );
}
