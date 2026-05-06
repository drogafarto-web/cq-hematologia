import React, { useState, useMemo } from 'react';
import { createHash } from 'crypto';
import { useUser } from '@/store/useAuthStore';
import { Run, Analito } from '../types';

interface RunOverrideModalProps {
  run: Run;
  analitos: Analito[];
  onOverride: (reason: string, hash: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RunOverrideModal: React.FC<RunOverrideModalProps> = ({
  run,
  analitos,
  onOverride,
  onCancel,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const user = useUser();

  const hash = useMemo(() => {
    if (!reason || !user?.uid) return '';
    const payload = {
      runId: run.id,
      reason,
      operatorId: user.uid,
      ts: Date.now(),
    };
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(canonical).digest('hex');
  }, [reason, user?.uid, run.id]);

  const isValid = reason.length >= 20 && reason.length <= 500 && hash.length === 64;

  const handleSubmit = async () => {
    if (!isValid || !hash) return;
    setSubmitting(true);
    try {
      await onOverride(reason, hash);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950 border border-slate-700 rounded-lg max-w-xl w-full">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-amber-200">Override Auditado</h2>
          <p className="text-xs text-slate-500 mt-1">
            Esta ação será registrada e auditada
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
            <p className="text-xs text-amber-200">
              ⚠️ Você está aprovando uma corrida com violações Westgard. Esta ação deve ser
              justificada e será registrada na trilha de auditoria.
            </p>
          </div>

          {/* Blocker snapshot */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Violações congeladas:</p>
            <div className="bg-slate-900/40 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 max-h-24 overflow-y-auto">
              <pre className="font-mono text-[11px]">
                {JSON.stringify(run.violations || {}, null, 2)}
              </pre>
            </div>
          </div>

          {/* Reason textarea */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-2">
              Motivo do override (obrigatório — 20-500 caracteres)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Erro de calibração identificado e corrigido, novo teste confirmou resultado"
              maxLength={500}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 resize-none h-24"
            />
            <p className="text-xs text-slate-500 mt-1">
              {reason.length} / 500 caracteres
            </p>
          </div>

          {/* Hash signature */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Assinatura (SHA-256)</p>
            <div className="bg-slate-900/40 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 break-all font-mono">
              {hash || '—'}
            </div>
            {hash && (
              <p className="text-xs text-green-400/80 mt-1">✓ Assinatura válida (64 chars)</p>
            )}
          </div>

          {/* Confirmation */}
          <div className="p-3 bg-slate-900/40 border border-slate-700 rounded">
            <p className="text-xs font-medium text-slate-300 mb-2">Confirmação:</p>
            <p className="text-xs text-slate-400">
              Eu, <span className="font-semibold text-slate-300">{user?.displayName || user?.email || 'Operador'}</span>, autorizo
              este override desta corrida com motivo documentado acima.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={submitting || isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting || isLoading}
            className="px-4 py-2 text-sm font-medium text-amber-200 bg-amber-900/40 border border-amber-700/50 rounded-lg hover:bg-amber-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Salvando...' : 'Confirmar Override'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunOverrideModal;
