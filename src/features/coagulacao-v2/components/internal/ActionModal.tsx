import { useState } from 'react';

interface ActionModalProps {
  title: string;
  description: string;
  actionLabel: string;
  actionColor?: 'amber' | 'red';
  isSaving: boolean;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}

export function ActionModal({
  title,
  description,
  actionLabel,
  actionColor = 'amber',
  isSaving,
  onConfirm,
  onClose,
}: ActionModalProps) {
  const [motivo, setMotivo] = useState('');

  async function handleSubmit() {
    if (!motivo.trim()) return;
    await onConfirm(motivo.trim());
    setMotivo('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <h3 className="mb-2 text-base font-medium text-white">{title}</h3>
        <p className="mb-4 text-sm text-zinc-400">{description}</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Descreva o motivo (mín. 10 caracteres)"
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
            disabled={isSaving || motivo.trim().length < 10}
            className={`rounded px-4 py-2 text-sm font-medium text-black disabled:opacity-50 ${
              actionColor === 'red'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {isSaving ? 'Confirmando...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
