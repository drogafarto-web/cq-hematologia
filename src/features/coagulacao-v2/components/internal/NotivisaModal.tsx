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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card-elevated)] p-6 shadow-xl">
        <h3 className="mb-2 text-base font-medium text-[var(--cl-text-strong)]">NOTIVISA — Tecnovigilância</h3>
        <p className="mb-4 text-sm text-[var(--cl-text-muted)]">
          Notificar a ANVISA sobre evento adverso ou queixa técnica relacionada a esta tentativa.
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Tipo de notificação</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none"
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
            disabled={isSaving || motivo.trim().length < 20}
            className="rounded bg-[var(--cl-accent)] px-4 py-2 text-sm font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)] disabled:opacity-50"
          >
            {isSaving ? 'Notificando...' : 'Notificar ANVISA'}
          </button>
        </div>
      </div>
    </div>
  );
}
