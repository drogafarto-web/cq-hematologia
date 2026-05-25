import { useState } from 'react';

interface NotivisaModalProps {
  isSaving: boolean;
  onConfirm: (data: { notivisaTipo: 'queixa_tecnica' | 'evento_adverso'; motivo: string }) => Promise<void>;
  onClose: () => void;
}

export function NotivisaModal({ isSaving, onConfirm, onClose }: NotivisaModalProps) {
  const [tipo, setTipo] = useState<'queixa_tecnica' | 'evento_adverso'>('queixa_tecnica');
  const [motivo, setMotivo] = useState('');

  async function handleSubmit() {
    if (!motivo.trim()) return;
    await onConfirm({ notivisaTipo: tipo, motivo: motivo.trim() });
    setMotivo('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <h3 className="mb-2 text-base font-medium text-white">NOTIVISA — Tecnovigilância</h3>
        <p className="mb-4 text-sm text-zinc-400">
          Notificar a ANVISA sobre evento adverso ou queixa técnica relacionada a esta tentativa.
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-sm text-zinc-400">Tipo de notificação</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="queixa_tecnica">Queixa técnica</option>
            <option value="evento_adverso">Evento adverso</option>
          </select>
        </div>

        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Descreva o motivo da notificação (mín. 20 caracteres)"
          className="mb-4 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || motivo.trim().length < 20}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
          >
            {isSaving ? 'Notificando...' : 'Notificar ANVISA'}
          </button>
        </div>
      </div>
    </div>
  );
}
