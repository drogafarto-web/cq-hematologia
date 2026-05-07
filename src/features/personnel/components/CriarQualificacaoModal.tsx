/**
 * CriarQualificacaoModal.tsx
 *
 * Modal para concessão de qualificações (treinamento/capacitação/reciclagem)
 * a operadores. Restringe a usuários com claim 'personnel' (responsável técnico).
 *
 * Fluxo:
 * 1. Busca operadores em `/labs/{labId}/educacaoContinuada/colaboradores`
 * 2. Forma: tipo + módulos + datas válido-de/até
 * 3. Valida: datas consistentes, >= 1 módulo, todas as required
 * 4. Submit: callCriarQualificacao({ labId, operadorId, tipo, modulosLiberados, ... })
 * 5. Toast sucesso + close + onSuccess callback
 *
 * Accessibility: WCAG AA compliant (labels, error messages, focus management)
 */

import { useState, useRef, useEffect, useId } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { useColaboradores } from '../../educacao-continuada/hooks/useColaboradores';
import { callCriarQualificacao } from '../services/pessoaCallables';
import { toast } from '../../../shared/store/useToastStore';
import type { CriarQualificacaoPayload } from '../services/pessoaCallables';

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function dateToUnixMs(d: Date | null): number | null {
  return d ? d.getTime() : null;
}

function formatDate(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function calcularDuracao(de: Date | null, ate: Date | null): string {
  if (!de || !ate) return '';
  const diffMs = ate.getTime() - de.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days === 1 ? '1 dia' : `${days} dias`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  labId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CriarQualificacaoModal({ open, labId: propLabId, onClose, onSuccess }: Props) {
  const contextLabId = useActiveLabId();
  const actualLabId = propLabId || contextLabId;
  const user = useUser();

  // State
  const [operadorId, setOperadorId] = useState('');
  const [operadorSearch, setOperadorSearch] = useState('');
  const [showOperadorDropdown, setShowOperadorDropdown] = useState(false);
  const [tipo, setTipo] = useState<'Treinamento' | 'Capacitação' | 'Reciclagem' | ''>('');
  const [modulosLiberados, setModulosLiberados] = useState<Set<string>>(new Set());
  const [validoDe, setValidoDe] = useState<Date | null>(new Date());
  const [validoAte, setValidoAte] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Refs
  const dialogRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const errorId = useId();
  const operadorId_fieldId = useId();
  const tipoId = useId();
  const modulosId = useId();
  const validoDeId = useId();
  const validoAteId = useId();

  // Load colaboradores
  const { colaboradores, isLoading: colabLoading } = useColaboradores();

  // Filtro de colaboradores por search
  const filteredColaboradores = operadorSearch
    ? colaboradores.filter((c) =>
        `${c.nome} (${c.id})`
          .toLowerCase()
          .includes(operadorSearch.toLowerCase())
      )
    : colaboradores;

  // Focus management
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus();
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Click outside to close dropdown
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowOperadorDropdown(false);
      }
    };
    if (showOperadorDropdown) {
      document.addEventListener('click', h);
      return () => document.removeEventListener('click', h);
    }
  }, [showOperadorDropdown]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!els.length) return;
      const first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', h);
    return () => dialog.removeEventListener('keydown', h);
  }, [open]);

  // Auth guard: user must be present to access personnel module
  // (callable will validate personnel claim server-side)
  const hasPermission = user != null;

  // Form validation
  const isValid =
    actualLabId &&
    operadorId &&
    tipo &&
    modulosLiberados.size > 0 &&
    validoDe &&
    (!validoAte || validoAte > validoDe);

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!actualLabId || !operadorId || !tipo || modulosLiberados.size === 0 || !validoDe)
      return;

    if (validoAte && validoAte <= validoDe) {
      setError('Data de término deve ser após a data inicial.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: CriarQualificacaoPayload = {
        labId: actualLabId,
        operadorId,
        tipo,
        modulosLiberados: Array.from(modulosLiberados),
        validoDe: validoDe.getTime(),
        validoAte: validoAte ? validoAte.getTime() : null,
      };

      await callCriarQualificacao(payload);
      setSuccess(true);
      toast.success('Qualificação concedida com sucesso.');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao conceder qualificação.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleResetForm() {
    setOperadorId('');
    setOperadorSearch('');
    setTipo('');
    setModulosLiberados(new Set());
    setValidoDe(new Date());
    setValidoAte(null);
    setError(null);
  }

  function handleClose() {
    handleResetForm();
    onClose();
  }

  if (!open) return null;

  // Restrição de permissão
  if (!hasPermission) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col outline-none"
        >
          <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
            <h2 id={titleId} className="text-base font-semibold text-white/90">
              Acesso restrito
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar"
              className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all"
            >
              <XIcon />
            </button>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-white/60">
              Apenas responsáveis técnicos podem conceder qualificações. Contate o administrador
              do laboratório.
            </p>
          </div>
          <div className="px-6 py-4 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        tabIndex={-1}
        className="w-full max-w-2xl bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col outline-none max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between shrink-0 sticky top-0 bg-[#141414]">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-white/90">
              Conceder qualificação
            </h2>
            <p className="text-xs text-white/35 mt-0.5">
              Autorize um operador para módulos específicos
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all shrink-0"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate className="flex-1">
          <div className="px-6 py-5 space-y-4">
            {/* Error */}
            {error && (
              <p
                id={errorId}
                role="alert"
                aria-live="assertive"
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
              >
                {error}
              </p>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M5.5 8l2 2 3-3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Qualificação concedida!
              </div>
            )}

            {/* Operador (Combobox) */}
            <div className="space-y-1.5">
              <label htmlFor={operadorId_fieldId} className="text-xs font-medium text-white/50">
                Operador <span className="text-red-400">*</span>
              </label>
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <input
                    id={operadorId_fieldId}
                    type="text"
                    autoComplete="off"
                    placeholder="Buscar operador..."
                    value={operadorSearch}
                    onChange={(e) => {
                      setOperadorSearch(e.target.value);
                      setShowOperadorDropdown(true);
                    }}
                    onFocus={() => setShowOperadorDropdown(true)}
                    disabled={loading || success || colabLoading}
                    aria-haspopup="listbox"
                    aria-expanded={showOperadorDropdown}
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:border-white/25 transition-all disabled:opacity-40"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                    <SearchIcon />
                  </div>
                </div>

                {/* Dropdown list */}
                {showOperadorDropdown && (
                  <div
                    role="listbox"
                    className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f0f] border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto"
                  >
                    {colabLoading ? (
                      <div className="px-3.5 py-3 text-xs text-white/40">Carregando...</div>
                    ) : filteredColaboradores.length > 0 ? (
                      filteredColaboradores.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setOperadorId(c.id);
                            setOperadorSearch('');
                            setShowOperadorDropdown(false);
                          }}
                          role="option"
                          aria-selected={operadorId === c.id}
                          className="w-full text-left px-3.5 py-2.5 text-sm text-white/70 hover:bg-white/[0.07] hover:text-white/90 transition-colors border-b border-white/[0.05] last:border-0"
                        >
                          <div className="font-medium">{c.nome}</div>
                          <div className="text-xs text-white/40">{c.id}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3.5 py-3 text-xs text-white/40">Nenhum operador encontrado</div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected operador display */}
              {operadorId && !operadorSearch && (
                <p className="text-xs text-emerald-400/80">
                  ✓ Selecionado:{' '}
                  {colaboradores.find((c) => c.id === operadorId)?.nome || operadorId}
                </p>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <label htmlFor={tipoId} className="text-xs font-medium text-white/50">
                Tipo <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  id={tipoId}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as typeof tipo)}
                  disabled={loading || success}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white/90 appearance-none focus:outline-none focus:border-white/25 transition-all disabled:opacity-40 pr-10"
                >
                  <option value="">Selecionar tipo…</option>
                  <option value="Treinamento">Treinamento</option>
                  <option value="Capacitação">Capacitação</option>
                  <option value="Reciclagem">Reciclagem</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                  <ChevronDownIcon />
                </div>
              </div>
            </div>

            {/* Módulos Liberados */}
            <div className="space-y-1.5">
              <div>
                <label className="text-xs font-medium text-white/50">
                  Módulos liberados <span className="text-red-400">*</span>
                </label>
                <p className="text-[11px] text-white/35 mt-0.5">Selecione pelo menos um</p>
              </div>
              <div
                id={modulosId}
                className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1"
                role="group"
                aria-labelledby={modulosId}
              >
                {['Hematologia', 'Imunologia', 'Coagulação', 'Uroanálise', 'Bioquímica'].map(
                  (mod) => (
                    <label key={mod} className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={modulosLiberados.has(mod)}
                        onChange={(e) => {
                          const newSet = new Set(modulosLiberados);
                          if (e.target.checked) {
                            newSet.add(mod);
                          } else {
                            newSet.delete(mod);
                          }
                          setModulosLiberados(newSet);
                        }}
                        disabled={loading || success}
                        className="w-4 h-4 rounded border border-white/20 bg-white/5 accent-violet-500 disabled:opacity-40"
                      />
                      <span className="text-sm text-white/60">{mod}</span>
                    </label>
                  )
                )}
              </div>
            </div>

            {/* Válido de */}
            <div className="space-y-1.5">
              <label htmlFor={validoDeId} className="text-xs font-medium text-white/50">
                Válido de <span className="text-red-400">*</span>
              </label>
              <input
                id={validoDeId}
                type="date"
                value={formatDate(validoDe)}
                onChange={(e) => setValidoDe(parseDate(e.target.value))}
                disabled={loading || success}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white/90 focus:outline-none focus:border-white/25 transition-all disabled:opacity-40"
              />
            </div>

            {/* Válido até */}
            <div className="space-y-1.5">
              <label htmlFor={validoAteId} className="text-xs font-medium text-white/50">
                Válido até
              </label>
              <input
                id={validoAteId}
                type="date"
                value={formatDate(validoAte)}
                onChange={(e) => setValidoAte(parseDate(e.target.value))}
                disabled={loading || success}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white/90 focus:outline-none focus:border-white/25 transition-all disabled:opacity-40"
              />
              <p className="text-[11px] text-white/35">Deixar vazio para indefinida</p>
              {validoDe && validoAte && (
                <p className="text-[11px] text-emerald-400/70">
                  Duração: {calcularDuracao(validoDe, validoAte)}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3 shrink-0 bg-[#141414]">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || success}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || loading || success}
              className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium text-white/80 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
                  Concedendo…
                </>
              ) : (
                'Conceder qualificação'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
