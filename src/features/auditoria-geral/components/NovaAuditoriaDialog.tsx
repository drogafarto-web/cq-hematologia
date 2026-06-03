import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { createAuditoria } from '../services/auditoriaGeralService';
import { BLOCOS } from '../data/blocos';
import type { BlocoId } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function NovaAuditoriaDialog({ open, onClose, onCreated }: Props) {
  const labId = useActiveLabId();
  const user = useUser();
  const [step, setStep] = useState<1 | 2>(1);
  const [titulo, setTitulo] = useState('');
  const [escopo, setEscopo] = useState<BlocoId[]>(BLOCOS.map((b) => b.id));
  const [criterios, setCriterios] = useState('RDC 978/2025 + DICQ 4.4');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId || !user) return;

    setIsCreating(true);
    setError(null);

    try {
      const id = await createAuditoria(labId, user.uid, {
        titulo: titulo.trim(),
        auditor: { uid: user.uid, nome: user.displayName || user.email || '' },
        dataInicio: Timestamp.now(),
      });
      setTitulo('');
      setStep(1);
      onCreated(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar auditoria';
      setError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (isCreating) return;
    setTitulo('');
    setStep(1);
    setError(null);
    onClose();
  };

  const toggleBloco = (id: BlocoId) => {
    setEscopo((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nova-auditoria-title"
    >
      <div
        className="bg-white border border-slate-200 dark:bg-[#141417] dark:border-white/[0.08] rounded-xl shadow-2xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="nova-auditoria-title"
          className="text-lg font-semibold text-slate-900 dark:text-white mb-1"
        >
          Nova Auditoria
        </h2>
        <p className="text-xs text-slate-500 dark:text-white/40 mb-5">
          {step === 1 ? 'Defina o escopo e critérios da auditoria' : 'Confirme os dados e inicie'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label
                  htmlFor="titulo"
                  className="block text-xs text-slate-500 dark:text-white/50 mb-1.5"
                >
                  Título da Auditoria
                </label>
                <input
                  id="titulo"
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Auditoria Interna DICQ — Maio 2026"
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-colors"
                  disabled={isCreating}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">
                  Critérios de Referência
                </label>
                <select
                  value={criterios}
                  onChange={(e) => setCriterios(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="RDC 978/2025 + DICQ 4.4">RDC 978/2025 + DICQ 4.4</option>
                  <option value="RDC 978/2025">RDC 978/2025 (apenas)</option>
                  <option value="DICQ 4.4 + ISO 15189">DICQ 4.4 + ISO 15189</option>
                  <option value="ISO 15189:2022">ISO 15189:2022 (apenas)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-2">
                  Escopo — Blocos a auditar ({escopo.length}/12)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {BLOCOS.map((bloco) => {
                    const selected = escopo.includes(bloco.id);
                    return (
                      <button
                        key={bloco.id}
                        type="button"
                        onClick={() => toggleBloco(bloco.id)}
                        className={`text-left px-2 py-1.5 rounded-md text-[11px] border transition-all ${
                          selected
                            ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400'
                            : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/[0.02] dark:border-white/[0.06] dark:text-white/40'
                        }`}
                      >
                        <span className="font-bold">{bloco.id}</span>{' '}
                        <span className="truncate">{bloco.nome.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setEscopo(BLOCOS.map((b) => b.id))}
                    className="text-[10px] text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Selecionar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscopo([])}
                    className="text-[10px] text-slate-500 dark:text-white/40 hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">
                  Auditor Líder
                </label>
                <p className="text-sm text-slate-700 dark:text-white/70">
                  {user?.displayName || user?.email || '—'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white transition-colors rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!titulo.trim() || escopo.length === 0}
                  className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  Próximo →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-white/50">Título</span>
                  <span className="text-slate-700 dark:text-white/80 font-medium">{titulo}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-white/50">Critérios</span>
                  <span className="text-slate-700 dark:text-white/80">{criterios}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-white/50">Escopo</span>
                  <span className="text-slate-700 dark:text-white/80">{escopo.length} blocos</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-white/50">Auditor</span>
                  <span className="text-slate-700 dark:text-white/80">
                    {user?.displayName || user?.email}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-white/50">Data</span>
                  <span className="text-slate-700 dark:text-white/80">
                    {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Independência:</strong> Confirmo que o auditor não possui conflito de
                  interesse com as áreas auditadas conforme RDC 978/2025 Art. 107 §2.
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isCreating}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white transition-colors rounded-lg"
                >
                  ← Voltar
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !titulo.trim() || escopo.length === 0}
                  className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {isCreating ? 'Criando...' : 'Iniciar Auditoria'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
