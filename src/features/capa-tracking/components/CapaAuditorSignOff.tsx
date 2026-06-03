/**
 * CapaAuditorSignOff.tsx — SA-31
 *
 * Auditor sign-off form for batch closing multiple CAPAs.
 * Final confirmation with warning and irreversible action alert.
 */

import { useState } from 'react';
import { useUser } from '../../../store/useAuthStore';

interface CapaAuditorSignOffProps {
  capaIds: string[];
  onSuccess: () => void;
  onClose: () => void;
}

type FormState = 'idle' | 'loading' | 'success' | 'error';

function CheckIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2l10 19H2L12 2z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function CapaAuditorSignOff({ capaIds, onSuccess, onClose }: CapaAuditorSignOffProps) {
  const user = useUser();
  const [state, setState] = useState<FormState>('idle');
  const [auditorName, setAuditorName] = useState(user?.displayName || '');
  const [auditorFirm, setAuditorFirm] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ name?: string; firm?: string; message?: string }>({});

  if (!capaIds.length) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-white/10 rounded-xl shadow-xl max-w-md w-full p-6">
          <p className="text-sm text-slate-400">Nenhuma CAPA selecionada para fechamento.</p>
          <button
            onClick={onClose}
            className="mt-6 w-full h-9 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-white/10 rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex flex-col items-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <CheckIcon />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Sign-off registrado</h2>
            <p className="text-sm text-slate-400 text-center">
              {capaIds.length} CAPA(s) foram fechadas com sucesso.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full h-9 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!auditorName.trim()) {
      newErrors.name = 'Nome do auditor é obrigatório.';
    }
    if (!auditorFirm.trim()) {
      newErrors.firm = 'Firma/Assinante é obrigatório.';
    }
    if (!message.trim()) {
      newErrors.message = 'Mensagem de confirmação é obrigatória.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setState('loading');

    try {
      // Placeholder for actual callable invocation
      // In real implementation:
      // const result = await submitAuditorSignOffCallable({
      //   labId,
      //   capaIds,
      //   auditorEmail: user?.email,
      //   auditorName: auditorName.trim(),
      //   auditorFirm: auditorFirm.trim(),
      //   message: message.trim(),
      // });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      setState('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setErrors({
        message: err instanceof Error ? err.message : 'Erro ao registrar sign-off.',
      });
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-white/10 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <h2 className="text-lg font-semibold text-white mb-1">Confirmar fechamento</h2>
        <p className="text-xs text-slate-400 mb-6">
          Assinatura do auditor para fechamento final das CAPAs.
        </p>

        {/* Warning */}
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2">
          <WarningIcon />
          <div className="flex-1">
            <p className="text-xs font-medium text-red-300 mb-1">Ação irreversível</p>
            <p className="text-[10px] text-red-400">
              Ao confirmar, {capaIds.length} CAPA(s) serão marcadas como fechadas permanentemente.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Summary */}
          <div className="p-3 bg-white/3 border border-white/10 rounded-lg text-xs">
            <p className="text-slate-400 mb-1">CAPAs para fechamento:</p>
            <p className="text-white font-semibold">{capaIds.length} CAPA(s)</p>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Email (automático)
            </label>
            <div className="px-3 py-2 bg-white/2 border border-white/10 rounded-lg text-sm text-slate-400 font-mono">
              {user?.email || '—'}
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-slate-300 mb-2">
              Nome do auditor <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              placeholder="Ex: Dr. João Silva"
              className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                errors.name ? 'border-red-500/50' : 'border-white/10 focus:border-violet-500/50'
              }`}
              disabled={state === 'loading'}
            />
            {errors.name && <p className="text-[10px] text-red-400 mt-1">{errors.name}</p>}
          </div>

          {/* Firm */}
          <div>
            <label htmlFor="firm" className="block text-xs font-medium text-slate-300 mb-2">
              Firma/Assinante <span className="text-red-400">*</span>
            </label>
            <input
              id="firm"
              type="text"
              value={auditorFirm}
              onChange={(e) => setAuditorFirm(e.target.value)}
              placeholder="Ex: Consultoria Sigma"
              className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                errors.firm ? 'border-red-500/50' : 'border-white/10 focus:border-violet-500/50'
              }`}
              disabled={state === 'loading'}
            />
            {errors.firm && <p className="text-[10px] text-red-400 mt-1">{errors.firm}</p>}
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-xs font-medium text-slate-300 mb-2">
              Mensagem de confirmação <span className="text-red-400">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Revisão completada. Todas as evidências foram verificadas e aprovadas."
              className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none resize-none transition-colors ${
                errors.message ? 'border-red-500/50' : 'border-white/10 focus:border-violet-500/50'
              }`}
              rows={3}
              disabled={state === 'loading'}
            />
            {errors.message && <p className="text-[10px] text-red-400 mt-1">{errors.message}</p>}
          </div>

          {/* Loading */}
          {state === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
              <span>Registrando sign-off...</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={state === 'loading'}
              className="flex-1 h-9 px-3 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                !auditorName.trim() || !auditorFirm.trim() || !message.trim() || state === 'loading'
              }
              className="flex-1 h-9 px-3 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              {state === 'loading' ? 'Confirmando...' : 'Confirmar Sign-Off'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
