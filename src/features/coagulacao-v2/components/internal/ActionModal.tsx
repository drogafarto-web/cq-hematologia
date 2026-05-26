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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card-elevated)] p-6 shadow-xl">
        <h3 className="mb-2 text-base font-medium text-[var(--cl-text-strong)]">{title}</h3>
        <p className="mb-4 text-sm text-[var(--cl-text-muted)]">{description}</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Descreva o motivo (mín. 10 caracteres)"
          className="mb-4 w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none"
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded border border-[var(--cl-border)] px-4 py-2 text-sm text-[var(--cl-text-muted)] hover:bg-[var(--cl-card)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || motivo.trim().length < 10}
            className={`rounded px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              actionColor === 'red'
                ? 'bg-[var(--cl-danger)] text-white hover:opacity-90'
                : 'bg-[var(--cl-accent)] text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)]'
            }`}
          >
            {isSaving ? 'Confirmando...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
