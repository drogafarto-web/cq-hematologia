import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { createAuditoria } from '../services/auditoriaGeralService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function NovaAuditoriaDialog({ open, onClose, onCreated }: Props) {
  const labId = useActiveLabId();
  const user = useUser();
  const [titulo, setTitulo] = useState('');
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
      onCreated(id);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar auditoria');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (isCreating) return;
    setTitulo('');
    setError(null);
    onClose();
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
        className="bg-[#141417] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nova-auditoria-title" className="text-lg font-semibold mb-5">
          Nova Auditoria
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="titulo" className="block text-xs text-white/50 mb-1.5">
              Titulo
            </label>
            <input
              id="titulo"
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Auditoria DICQ 2026"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-colors"
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Auditor</label>
            <p className="text-sm text-white/70">
              {user?.displayName || user?.email || '—'}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating || !titulo.trim()}
              className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {isCreating ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}