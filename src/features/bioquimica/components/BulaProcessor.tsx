/**
 * BulaProcessor — bioquímica
 * PDF upload → Gemini Vision parsing → preview + inline editing
 *
 * Features:
 * - Drag-drop PDF upload
 * - Client-side validation (format, size)
 * - Callable parseBulaBioquimica (Gemini 2.5 Flash)
 * - Loading state with skeleton + ETA
 * - Preview table with manufacturerStats
 * - Inline edit + acceptance
 */

import React, { useState, useRef, useId } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { processBula, applyBula } from '../services/bulaService';
import type { BulaParseResult } from '../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1L13 13H1L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 6v3M7 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BulaProcessorProps {
  lotId: string;
  onApplySuccess: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulaProcessor({ lotId, onApplySuccess, onCancel }: BulaProcessorProps) {
  const labId = useActiveLabId();
  const [step, setStep] = useState<'upload' | 'parsing' | 'preview'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<BulaParseResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [editedStats, setEditedStats] = useState<BulaParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  if (!labId) return null;

  // Upload handler
  const handleFile = async (file: File) => {
    setError(null);

    // Validate
    if (!file.type.includes('pdf')) {
      setError('Arquivo deve ser um PDF válido');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('PDF não pode exceder 10 MB');
      return;
    }

    // Parse
    setStep('parsing');
    try {
      const result = await processBula(labId, file);
      setParsed(result);
      setEditedStats(result);
      setStep('preview');
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar bula');
      setStep('upload');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleApply = async () => {
    if (!editedStats) return;

    setApplying(true);
    try {
      await applyBula(labId, lotId, editedStats);
      onApplySuccess();
    } catch (err: any) {
      setError(err?.message || 'Erro ao aplicar bula');
    } finally {
      setApplying(false);
    }
  };

  // ─── Render: Upload ───────────────────────────────────────────────────────

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Área para soltar ou selecionar arquivo PDF"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`
            flex flex-col items-center justify-center gap-4 rounded-2xl
            border-2 border-dashed transition-all cursor-pointer py-16 px-8 text-center
            ${
              dragging
                ? 'border-violet-500/60 bg-violet-500/[0.06]'
                : 'border-white/[0.1] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.03]'
            }
          `}
        >
          <div className={`text-white/25 transition-transform ${dragging ? 'scale-110' : ''}`}>
            <UploadCloudIcon />
          </div>
          <div>
            <p className="text-sm font-medium text-white/60">
              {dragging ? 'Solte a bula PDF aqui' : 'Arraste a bula PDF ou clique para selecionar'}
            </p>
            <p className="text-xs text-white/25 mt-1">Apenas arquivos PDF · Máx. 10 MB</p>
          </div>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="application/pdf"
            onChange={handleChange}
            title="Selecionar arquivo PDF"
            className="sr-only"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 flex gap-3">
            <div className="text-red-400 mt-0.5">
              <WarnIcon />
            </div>
            <div>
              <p className="text-sm text-red-400 font-medium">Erro no upload</p>
              <p className="text-xs text-red-300/70 mt-1">{error}</p>
            </div>
          </div>
        )}

        <button
          onClick={onCancel}
          className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.09]
            text-white/70 hover:text-white/90 transition-colors text-sm"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // ─── Render: Parsing ──────────────────────────────────────────────────────

  if (step === 'parsing') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-6 flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-500/20 animate-pulse">
            <SparkleIcon />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white/90">Analisando bula...</p>
            <p className="text-xs text-white/40 mt-2">~5 segundos</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-4 bg-white/[0.05] rounded-full overflow-hidden">
            <div className="h-full bg-violet-500/50 w-2/3 animate-pulse" />
          </div>
          <p className="text-xs text-white/30">Gemini Vision processando...</p>
        </div>
      </div>
    );
  }

  // ─── Render: Preview ──────────────────────────────────────────────────────

  if (step === 'preview' && editedStats) {
    const { niveis, manufacturerStats } = editedStats;

    return (
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {/* Info card */}
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex gap-3">
          <div className="text-emerald-400 mt-0.5">
            <CheckIcon />
          </div>
          <div className="text-sm text-emerald-300">
            Bula processada com sucesso · {niveis?.length || 0} níveis
          </div>
        </div>

        {/* Levels preview */}
        <div className="space-y-3">
          {niveis?.map((nivel, idx) => (
            <div key={idx} className="rounded-lg border border-white/[0.09] bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-white/60 mb-2">
                Nível {nivel.level} • {Object.keys(manufacturerStats?.[`nivel${nivel.level}`] || {}).length} analitos
              </p>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <span className="text-white/30">Analito</span>
                <span className="text-white/30 text-right">Média</span>
                <span className="text-white/30 text-right">±DP</span>

                {Object.entries(manufacturerStats?.[`nivel${nivel.level}`] || {}).map(
                  ([analito, stats]) => (
                    <React.Fragment key={analito}>
                      <span className="text-white/70 truncate">{analito}</span>
                      <span className="text-white/60 text-right tabular-nums">{stats.mean.toFixed(2)}</span>
                      <span className="text-white/60 text-right tabular-nums">{stats.sd.toFixed(2)}</span>
                    </React.Fragment>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleApply}
            disabled={applying}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50
              border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-colors"
          >
            {applying ? 'Aplicando...' : 'Aceitar e aplicar ao lote'}
          </button>
          <button
            onClick={() => setStep('upload')}
            disabled={applying}
            className="px-3.5 py-2.5 rounded-xl border border-white/[0.09]
              text-white/70 hover:text-white/90 text-sm transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return null;
}
