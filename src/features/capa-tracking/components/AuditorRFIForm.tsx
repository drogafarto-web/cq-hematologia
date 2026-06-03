/**
 * AuditorRFIForm.tsx — SA-30
 *
 * Auditor Request For Information form with due date picker.
 * Dark-first modal interface with validation.
 */

import { useState, useCallback } from 'react';
import { useAuditorRFI } from '../hooks/useAuditorRFI';

interface AuditorRFIFormProps {
  capaId: string;
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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR');
}

export function AuditorRFIForm({ capaId, onSuccess, onClose }: AuditorRFIFormProps) {
  const { submitRFI } = useAuditorRFI();
  const [state, setState] = useState<FormState>('idle');
  const [question, setQuestion] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<{ question?: string; dueDate?: string }>({});

  // Default due date: +7 days
  const getDefaultDueDate = useCallback(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }, []);

  const validateForm = useCallback(() => {
    const newErrors: typeof errors = {};

    if (!question.trim() || question.trim().length < 10) {
      newErrors.question = 'Pergunta deve ter pelo menos 10 caracteres.';
    }
    if (question.trim().length > 2000) {
      newErrors.question = 'Pergunta não pode exceder 2000 caracteres.';
    }

    if (!dueDate) {
      newErrors.dueDate = 'Data limite é obrigatória.';
    } else {
      const selectedTs = new Date(dueDate).getTime();
      if (selectedTs <= Date.now()) {
        newErrors.dueDate = 'Data limite deve ser no futuro.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [question, dueDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setState('loading');

    try {
      const dueDateTs = new Date(dueDate).getTime();
      await submitRFI(capaId, question.trim(), dueDateTs);
      setState('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setErrors({
        dueDate: err instanceof Error ? err.message : 'Erro ao enviar RFI.',
      });
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-white/10 rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex flex-col items-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <CheckIcon />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">RFI enviada</h2>
            <p className="text-sm text-slate-400 text-center">
              A solicitação de informação foi registrada no sistema.
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-white/10 rounded-xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <h2 className="text-lg font-semibold text-white mb-1">Solicitar informação (RFI)</h2>
        <p className="text-xs text-slate-400 mb-6">
          Faça uma pergunta que o responsável deve responder até a data limite.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question */}
          <div>
            <label htmlFor="question" className="block text-xs font-medium text-slate-300 mb-2">
              Pergunta <span className="text-red-400">*</span>
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Qual foi a ação imediata tomada após a detecção do desvio?"
              className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none resize-none transition-colors ${
                errors.question
                  ? 'border-red-500/50 focus:border-red-500/50'
                  : 'border-white/10 focus:border-violet-500/50'
              }`}
              rows={4}
              disabled={state === 'loading'}
              maxLength={2000}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-slate-500">{question.length}/2000 caracteres</p>
              {errors.question && <p className="text-[10px] text-red-400">{errors.question}</p>}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="dueDate" className="block text-xs font-medium text-slate-300 mb-2">
              Data limite <span className="text-red-400">*</span>
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate || getDefaultDueDate()}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-white focus:outline-none transition-colors ${
                errors.dueDate
                  ? 'border-red-500/50 focus:border-red-500/50'
                  : 'border-white/10 focus:border-violet-500/50'
              }`}
              disabled={state === 'loading'}
            />
            <div className="mt-1">
              {dueDate && (
                <p className="text-[10px] text-slate-500">
                  {formatDate(new Date(dueDate).getTime())}
                </p>
              )}
              {errors.dueDate && <p className="text-[10px] text-red-400">{errors.dueDate}</p>}
            </div>
          </div>

          {/* Loading State */}
          {state === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
              <span>Enviando RFI...</span>
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
              disabled={!question.trim() || !dueDate || state === 'loading'}
              className="flex-1 h-9 px-3 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              {state === 'loading' ? 'Enviando...' : 'Enviar RFI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
