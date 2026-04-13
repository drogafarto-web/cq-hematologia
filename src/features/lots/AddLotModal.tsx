import React, { useState, useRef, useCallback } from 'react';
import { ANALYTES } from '../../constants';
import { parseControlLotCSV, statsToManufacturerStats } from './services/csvParserService';
import type { ParsedCSVResult } from './services/csvParserService';
import type { AddLotInput } from './hooks/useLots';

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 13V4M10 4L7 7M10 4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, required, children, hint }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
        {label}{required && <span className="text-red-400/70 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-white/25 mt-1 ml-0.5">{hint}</p>}
    </div>
  );
}

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-white/[0.06] border border-white/[0.09]
  text-white/90 placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddLotModalProps {
  onAdd:   (input: AddLotInput) => Promise<string>;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddLotModal({ onAdd, onClose }: AddLotModalProps) {
  // Form state
  const [lotNumber,     setLotNumber]     = useState('');
  const [controlName,   setControlName]   = useState('');
  const [level,         setLevel]         = useState<1 | 2 | 3>(1);
  const [equipmentName, setEquipmentName] = useState('Yumizen H550');
  const [serialNumber,  setSerialNumber]  = useState('');
  const [startDate,     setStartDate]     = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [expiryDate,    setExpiryDate]    = useState('');

  // CSV state
  const [csvResult,  setCsvResult]  = useState<ParsedCSVResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Analyte selection (pre-populated from CSV, operator can edit)
  const [selectedAnalytes, setSelectedAnalytes] = useState<Set<string>>(
    () => new Set(ANALYTES.map((a) => a.id)),
  );

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── CSV handling ────────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Arquivo inválido. Use um arquivo .csv');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseControlLotCSV(text, level);
      setCsvResult(parsed);

      // Auto-populate form fields from CSV metadata
      if (parsed.lotNumber)   setLotNumber(parsed.lotNumber);
      if (parsed.controlName) setControlName(parsed.controlName);
      if (parsed.level)       setLevel(parsed.level);
      if (parsed.expiryDate) {
        setExpiryDate(parsed.expiryDate.toISOString().slice(0, 10));
      }

      // Pre-select analytes found in CSV
      if (parsed.stats.length > 0) {
        setSelectedAnalytes(new Set(parsed.stats.map((s) => s.analyteId)));
      }
    };
    reader.readAsText(file, 'utf-8');
  }, [level]);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  // ── Analyte toggle ──────────────────────────────────────────────────────────

  function toggleAnalyte(id: string) {
    setSelectedAnalytes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!lotNumber.trim())   { setError('Número do lote é obrigatório.');   return; }
    if (!controlName.trim()) { setError('Nome do controle é obrigatório.'); return; }
    if (!expiryDate)         { setError('Data de vencimento é obrigatória.'); return; }
    if (selectedAnalytes.size === 0) { setError('Selecione ao menos um analito.'); return; }

    const mfr = csvResult
      ? statsToManufacturerStats(
          csvResult.stats.filter((s) => selectedAnalytes.has(s.analyteId)),
        )
      : {};

    const input: AddLotInput = {
      lotNumber:        lotNumber.trim(),
      controlName:      controlName.trim(),
      level,
      equipmentName:    equipmentName.trim() || 'Yumizen H550',
      serialNumber:     serialNumber.trim(),
      startDate:        new Date(startDate),
      expiryDate:       new Date(expiryDate),
      requiredAnalytes: Array.from(selectedAnalytes),
      manufacturerStats: mfr,
    };

    setSubmitting(true);
    try {
      await onAdd(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lote.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#141414] border border-white/[0.09] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-semibold text-white/90">Novo Lote de Controle</h2>
            <p className="text-xs text-white/35 mt-0.5">Preencha os dados ou importe via CSV</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* CSV import */}
          <div>
            <p className="text-xs font-medium text-white/45 mb-2 ml-0.5">Importar CSV (opcional)</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileRef.current?.click()}
              className={`
                relative flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-dashed
                cursor-pointer transition-all
                ${isDragging
                  ? 'border-violet-500/60 bg-violet-500/[0.07]'
                  : csvResult
                  ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                  : 'border-white/[0.12] bg-white/[0.02] hover:border-white/[0.22] hover:bg-white/[0.04]'}
              `}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileChange}
              />
              {csvResult ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <CheckIcon />
                  </div>
                  <p className="text-sm text-emerald-400 font-medium">
                    {csvResult.stats.length} analitos importados
                  </p>
                  <p className="text-xs text-white/30">Clique para substituir</p>
                </>
              ) : (
                <>
                  <div className="text-white/25"><UploadIcon /></div>
                  <p className="text-sm text-white/50">
                    Arraste o CSV Difftrol ou <span className="text-violet-400">clique para selecionar</span>
                  </p>
                  <p className="text-xs text-white/25">Preenche automaticamente os campos abaixo</p>
                </>
              )}
            </div>

            {/* CSV warnings */}
            {csvResult?.warnings && csvResult.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {csvResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.07] border border-amber-500/[0.15]">
                    <span className="text-amber-400 mt-0.5 shrink-0"><WarnIcon /></span>
                    <p className="text-xs text-amber-300/80">{w}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lot details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Número do Lote" required>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="Ex: 12345678"
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            <div className="col-span-2">
              <Field label="Nome do Controle" required>
                <input
                  type="text"
                  value={controlName}
                  onChange={(e) => setControlName(e.target.value)}
                  placeholder="Ex: Difftrol Level 1"
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            <Field label="Nível" required>
              <select
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value, 10) as 1 | 2 | 3)}
                className={INPUT_CLS}
              >
                <option value={1}>Nível 1 (Normal)</option>
                <option value={2}>Nível 2 (Elevado)</option>
                <option value={3}>Nível 3 (Alto)</option>
              </select>
            </Field>

            <Field label="Equipamento">
              <input
                type="text"
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
                placeholder="Yumizen H550"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Início do Uso" required>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Vencimento" required>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
          </div>

          {/* Analyte selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-white/45 ml-0.5">
                Analitos ({selectedAnalytes.size}/{ANALYTES.length})
              </p>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => setSelectedAnalytes(new Set(ANALYTES.map((a) => a.id)))} className="text-white/35 hover:text-white/65 transition-colors">Todos</button>
                <button type="button" onClick={() => setSelectedAnalytes(new Set())} className="text-white/35 hover:text-white/65 transition-colors">Nenhum</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ANALYTES.map((a) => {
                const selected = selectedAnalytes.has(a.id);
                const hasStats = csvResult?.stats.some((s) => s.analyteId === a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAnalyte(a.id)}
                    className={`
                      px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                      ${selected
                        ? hasStats
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                          : 'bg-white/[0.1] text-white/80 border border-white/[0.18]'
                        : 'bg-transparent text-white/25 border border-white/[0.07] hover:border-white/[0.18] hover:text-white/45'
                      }
                    `}
                  >
                    {a.id}
                  </button>
                );
              })}
            </div>
            {csvResult && (
              <p className="text-xs text-white/25 mt-2 ml-0.5">
                Roxo = analito com stats do CSV · Branco = sem stats do fabricante
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400/90 bg-red-500/[0.07] border border-red-500/[0.15] rounded-lg px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-sm text-white/50 hover:text-white/80 hover:border-white/[0.2] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
            >
              {submitting ? 'Salvando…' : 'Adicionar Lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
