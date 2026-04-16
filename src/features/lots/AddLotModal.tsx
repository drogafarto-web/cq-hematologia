import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ANALYTES } from '../../constants';
import { parseControlLotCSV, statsToManufacturerStats } from './services/csvParserService';
import type { ParsedCSVResult } from './services/csvParserService';
import type { AddLotInput } from './hooks/useLots';
import { useAppStore } from '../../store/useAppStore';
import type { BulaLevelData } from '../../types';

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

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ id, label, required, children, hint }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5">
        {label}{required && <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-white/25 mt-1 ml-0.5">{hint}</p>}
    </div>
  );
}

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 dark:focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

// ─── Level badge colours ──────────────────────────────────────────────────────

const LEVEL_COLORS: Record<number, string> = {
  1: 'text-blue-400  bg-blue-500/15  border-blue-500/30',
  2: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  3: 'text-rose-400  bg-rose-500/15  border-rose-500/30',
};

const FALLBACK_KEYWORDS = ['pentra', 'mindray'];
function hasFallbackSources(lvl: BulaLevelData): boolean {
  return Object.values(lvl.equipmentSources ?? {}).some((src) =>
    FALLBACK_KEYWORDS.some((kw) => src.toLowerCase().includes(kw)),
  );
}

// ─── Batch summary card ───────────────────────────────────────────────────────

interface LevelSummaryCardProps {
  lvl: BulaLevelData;
}

function LevelSummaryCard({ lvl }: LevelSummaryCardProps) {
  const analyteCount = Object.keys(lvl.manufacturerStats).length;
  const fallback     = hasFallbackSources(lvl);

  return (
    <div className={`rounded-xl border px-3.5 py-3 flex items-center gap-3 ${LEVEL_COLORS[lvl.level].replace('text-', 'border-').split(' ')[2]} bg-slate-50 dark:bg-white/[0.02]`}>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 ${LEVEL_COLORS[lvl.level]}`}>
        N{lvl.level}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-600 dark:text-white/60 truncate">
          {lvl.lotNumber ? `Lote ${lvl.lotNumber}` : 'Lote não identificado'}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-white/30 mt-0.5">
          {analyteCount} analito{analyteCount !== 1 ? 's' : ''}
        </p>
      </div>
      {fallback && (
        <span
          title="Contém analitos de equipamento de fallback (Pentra)"
          className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md shrink-0"
        >
          <WarnIcon />
          Fallback
        </span>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddLotModalProps {
  onAdd:   (input: AddLotInput) => Promise<string>;
  onClose: () => void;
}

// ─── Batch creation form ──────────────────────────────────────────────────────
// Rendered when pendingBulaData has multiple levels.

interface BatchFormProps {
  controlName:   string;
  levels:        BulaLevelData[];
  onAdd:         (input: AddLotInput) => Promise<string>;
  onClose:       () => void;
  clearBulaData: () => void;
}

function BatchCreationForm({ controlName, levels, onAdd, onClose, clearBulaData }: BatchFormProps) {
  const [equipmentName, setEquipmentName] = useState('Yumizen H550');
  const [serialNumber,  setSerialNumber]  = useState('');
  const [startDate,     setStartDate]     = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [expiryDate,    setExpiryDate]    = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [created,       setCreated]       = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!expiryDate) { setError('Data de vencimento é obrigatória.'); return; }
    if (!controlName.trim()) { setError('Nome do controle não identificado na bula.'); return; }

    setSubmitting(true);
    try {
      // Build one AddLotInput per level and fire them all in parallel
      const inputs: AddLotInput[] = levels.map((lvl) => ({
        lotNumber:         lvl.lotNumber ?? `${controlName}-N${lvl.level}`,
        controlName:       controlName.trim(),
        level:             lvl.level,
        equipmentName:     equipmentName.trim() || 'Yumizen H550',
        serialNumber:      serialNumber.trim(),
        startDate:         new Date(startDate),
        expiryDate:        new Date(expiryDate),
        requiredAnalytes:  Object.keys(lvl.manufacturerStats),
        manufacturerStats: lvl.manufacturerStats,
      }));

      let done = 0;
      await Promise.all(
        inputs.map(async (input) => {
          await onAdd(input);
          done++;
          setCreated(done);
        }),
      );

      clearBulaData();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lotes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
      {/* Bula badge */}
      <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/[0.06] border border-violet-200 dark:border-violet-500/20 rounded-xl px-3.5 py-2.5 transition-colors duration-300">
        <SparkleIcon />
        <span className="font-medium">Criação em lote — bula PDF</span>
        <span className="text-slate-400 dark:text-white/30 truncate ml-1">{controlName}</span>
      </div>

      {/* Level summary */}
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-white/45 mb-2 ml-0.5">Níveis a criar ({levels.length})</p>
        <div className="flex flex-col gap-2">
          {levels.map((lvl) => <LevelSummaryCard key={lvl.level} lvl={lvl} />)}
        </div>
      </div>

      {/* Shared metadata */}
      <div className="grid grid-cols-2 gap-3">
        <Field id="batch-equipment" label="Equipamento">
          <input
            id="batch-equipment"
            type="text"
            value={equipmentName}
            onChange={(e) => setEquipmentName(e.target.value)}
            placeholder="Yumizen H550"
            className={INPUT_CLS}
          />
        </Field>
        <Field id="batch-serial" label="Número de série">
          <input
            id="batch-serial"
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Opcional"
            className={INPUT_CLS}
          />
        </Field>
        <Field id="batch-start" label="Início do Uso" required>
          <input
            id="batch-start"
            type="date"
            title="Início do Uso"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={INPUT_CLS}
          />
        </Field>
        <Field id="batch-expiry" label="Vencimento" required>
          <input
            id="batch-expiry"
            type="date"
            title="Vencimento"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className={INPUT_CLS}
          />
        </Field>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400/90 bg-red-500/[0.07] border border-red-500/[0.15] rounded-lg px-3 py-2.5">
          {error}
        </p>
      )}

      {/* Progress indicator during batch save */}
      {submitting && (
        <p className="text-xs text-violet-400/80 text-center">
          Salvando lote {created + 1} de {levels.length}…
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] text-sm text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 hover:border-slate-300 dark:hover:border-white/[0.2] transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
        >
          {submitting
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Criando…</>
            : <><CheckIcon /> Criar {levels.length} lotes</>}
        </button>
      </div>
    </form>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddLotModal({ onAdd, onClose }: AddLotModalProps) {
  // Bula data from store
  const pendingBulaData    = useAppStore((s) => s.pendingBulaData);
  const setPendingBulaData = useAppStore((s) => s.setPendingBulaData);

  // ── Batch mode (multi-level bula) ─────────────────────────────────────────

  const isBatchMode = (pendingBulaData?.levels.length ?? 0) > 1;

  // ── Single-lot state ──────────────────────────────────────────────────────

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

  // Analyte selection
  const [selectedAnalytes, setSelectedAnalytes] = useState<Set<string>>(
    () => new Set(ANALYTES.map((a) => a.id)),
  );

  // Track whether bula data was applied
  const [bulaApplied, setBulaApplied] = useState(false);

  useEffect(() => {
    if (!pendingBulaData || isBatchMode) return;

    // Single-level bula: pre-fill form from levels[0]
    const firstLevel = pendingBulaData.levels[0];
    if (!firstLevel) return;

    if (pendingBulaData.controlName) setControlName(pendingBulaData.controlName);
    if (firstLevel.lotNumber)        setLotNumber(firstLevel.lotNumber);
    if (firstLevel.level)            setLevel(firstLevel.level);
    if (pendingBulaData.expiryDate) {
      setExpiryDate(pendingBulaData.expiryDate.toISOString().slice(0, 10));
    }
    const analyteIds = Object.keys(firstLevel.manufacturerStats);
    if (analyteIds.length > 0) setSelectedAnalytes(new Set(analyteIds));
    setBulaApplied(true);
  // run only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      if (parsed.lotNumber)   setLotNumber(parsed.lotNumber);
      if (parsed.controlName) setControlName(parsed.controlName);
      if (parsed.level)       setLevel(parsed.level);
      if (parsed.expiryDate) {
        setExpiryDate(parsed.expiryDate.toISOString().slice(0, 10));
      }
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

  function toggleAnalyte(id: string) {
    setSelectedAnalytes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Single-lot submit ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!lotNumber.trim())   { setError('Número do lote é obrigatório.');   return; }
    if (!controlName.trim()) { setError('Nome do controle é obrigatório.'); return; }
    if (!expiryDate)         { setError('Data de vencimento é obrigatória.'); return; }
    if (selectedAnalytes.size === 0) { setError('Selecione ao menos um analito.'); return; }

    // Priority: CSV → bula → empty
    let mfr: ReturnType<typeof statsToManufacturerStats> = {};
    if (csvResult) {
      mfr = statsToManufacturerStats(
        csvResult.stats.filter((s) => selectedAnalytes.has(s.analyteId)),
      );
    } else if (pendingBulaData?.levels[0]) {
      const firstLevel = pendingBulaData.levels[0];
      for (const id of selectedAnalytes) {
        if (firstLevel.manufacturerStats[id]) {
          mfr[id] = firstLevel.manufacturerStats[id];
        }
      }
    }

    const input: AddLotInput = {
      lotNumber:         lotNumber.trim(),
      controlName:       controlName.trim(),
      level,
      equipmentName:     equipmentName.trim() || 'Yumizen H550',
      serialNumber:      serialNumber.trim(),
      startDate:         new Date(startDate),
      expiryDate:        new Date(expiryDate),
      requiredAnalytes:  Array.from(selectedAnalytes),
      manufacturerStats: mfr,
    };

    setSubmitting(true);
    try {
      await onAdd(input);
      setPendingBulaData(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lote.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isBatchTitle = isBatchMode
    ? `Criar ${pendingBulaData!.levels.length} lotes — bula PDF`
    : 'Novo Lote de Controle';

  const isBatchSubtitle = isBatchMode
    ? `${pendingBulaData!.levels.length} níveis extraídos simultaneamente`
    : bulaApplied
    ? 'Campos pré-preenchidos a partir da bula PDF'
    : 'Preencha os dados ou importe via CSV';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm transition-colors duration-500">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.09] shadow-2xl transition-colors duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/[0.07]">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white/90">{isBatchTitle}</h2>
            <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5">{isBatchSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-all"
          >
            ✕
          </button>
        </div>

        {/* Batch mode — streamlined form */}
        {isBatchMode ? (
          <BatchCreationForm
            controlName={pendingBulaData!.controlName ?? ''}
            levels={pendingBulaData!.levels}
            onAdd={onAdd}
            onClose={onClose}
            clearBulaData={() => setPendingBulaData(null)}
          />
        ) : (

          /* ── Single-lot form ────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* CSV import */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-white/45 mb-2 ml-0.5">Importar CSV (opcional)</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
                className={`
                  relative flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-dashed
                  cursor-pointer transition-all
                  ${isDragging
                    ? 'border-violet-500/60 bg-violet-500/10 dark:bg-violet-500/[0.07]'
                    : csvResult
                    ? 'border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/[0.04]'
                    : 'border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.22] hover:bg-slate-100 dark:hover:bg-white/[0.04]'}
                `}
              >
                <input
                  ref={fileRef}
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  aria-label="Upload de arquivo CSV"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {csvResult ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <CheckIcon />
                    </div>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {csvResult.stats.length} analitos importados
                    </p>
                    <p className="text-xs text-slate-400 dark:text-white/30">Clique para substituir</p>
                  </>
                ) : (
                  <>
                    <div className="text-slate-300 dark:text-white/25"><UploadIcon /></div>
                    <p className="text-sm text-slate-500 dark:text-white/50">
                      Arraste o CSV Difftrol ou <span className="text-violet-600 dark:text-violet-400">clique para selecionar</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-white/25">Preenche automaticamente os campos abaixo</p>
                  </>
                )}
              </div>

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
                <Field id="lot-number" label="Número do Lote" required>
                  <input
                    id="lot-number"
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Ex: 12345678"
                    className={INPUT_CLS}
                  />
                </Field>
              </div>

              <div className="col-span-2">
                <Field id="control-name" label="Nome do Controle" required>
                  <input
                    id="control-name"
                    type="text"
                    value={controlName}
                    onChange={(e) => setControlName(e.target.value)}
                    placeholder="Ex: Difftrol Level 1"
                    className={INPUT_CLS}
                  />
                </Field>
              </div>

              <Field id="control-level" label="Nível" required>
                <select
                  id="control-level"
                  title="Nível do controle"
                  value={level}
                  onChange={(e) => setLevel(parseInt(e.target.value, 10) as 1 | 2 | 3)}
                  className={INPUT_CLS}
                >
                  <option value={1}>Nível 1 (Normal)</option>
                  <option value={2}>Nível 2 (Elevado)</option>
                  <option value={3}>Nível 3 (Alto)</option>
                </select>
              </Field>

              <Field id="equipment-name" label="Equipamento">
                <input
                  id="equipment-name"
                  type="text"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  placeholder="Yumizen H550"
                  className={INPUT_CLS}
                />
              </Field>

              <Field id="start-date" label="Início do Uso" required>
                <input
                  id="start-date"
                  type="date"
                  title="Início do Uso"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>

              <Field id="expiry-date" label="Vencimento" required>
                <input
                  id="expiry-date"
                  type="date"
                  title="Vencimento"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            {/* Analyte selection */}
            <div>
              <div className="flex items-center justify-between mb-2 transition-colors duration-300">
                <p className="text-xs font-medium text-slate-500 dark:text-white/45 ml-0.5">
                  Analitos ({selectedAnalytes.size}/{ANALYTES.length})
                </p>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => setSelectedAnalytes(new Set(ANALYTES.map((a) => a.id)))} className="text-slate-400 dark:text-white/35 hover:text-slate-600 dark:hover:text-white/65 transition-colors">Todos</button>
                  <button type="button" onClick={() => setSelectedAnalytes(new Set())} className="text-slate-400 dark:text-white/35 hover:text-slate-600 dark:hover:text-white/65 transition-colors">Nenhum</button>
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
                            ? 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 border border-violet-500/30 dark:border-violet-500/40 shadow-sm dark:shadow-none'
                            : 'bg-slate-100 dark:bg-white/[0.1] text-slate-800 dark:text-white/80 border border-slate-300 dark:border-white/[0.18]'
                          : 'bg-transparent text-slate-400 dark:text-white/25 border border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.18] hover:text-slate-600 dark:hover:text-white/45'
                        }
                      `}
                    >
                      {a.id}
                    </button>
                  );
                })}
              </div>
              {csvResult && (
                <p className="text-xs text-slate-400 dark:text-white/25 mt-2 ml-0.5">
                  Roxo = analito com stats do CSV · Cinza = sem stats do fabricante
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
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] text-sm text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 hover:border-slate-300 dark:hover:border-white/[0.2] transition-all"
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
        )}
      </div>
    </div>
  );
}
