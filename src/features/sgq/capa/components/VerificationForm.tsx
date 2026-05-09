/**
 * VerificationForm — RT submits verification result after action completion
 *
 * Fields: resultado (efetiva/nao-efetiva/parcialmente-efetiva), notas, horasInvestidas
 * Data: auto-filled with current date
 * Submit: calls verifyCAPA callable
 * On efetiva: auto-closes CAPA and transitions to "fechada"
 * Dark-first design, WCAG AA
 */

import React, { useState } from 'react';
import { useUser } from '../../../../store/useAuthStore';
import { verifyCAPA } from '../services/capaService';
import type { CreateVerificacaoInput, VerificacaoResultado } from '../types';

interface VerificationFormProps {
  labId: string;
  capaId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

const RESULTADO_OPTIONS: { value: VerificacaoResultado; label: string; description: string }[] = [
  {
    value: 'efetiva',
    label: '✓ Efetiva',
    description: 'Ação foi 100% efetiva — problema resolvido',
  },
  {
    value: 'parcialmente-efetiva',
    label: '◐ Parcialmente Efetiva',
    description: 'Ação resolveu parte do problema',
  },
  {
    value: 'nao-efetiva',
    label: '✕ Não Efetiva',
    description: 'Ação não resolveu o problema — novo plano necessário',
  },
];

export default function VerificationForm({
  labId,
  capaId,
  onSuccess,
  onCancel,
  isLoading: externalLoading,
}: VerificationFormProps) {
  const user = useUser();

  const [resultado, setResultado] = useState<VerificacaoResultado>('efetiva');
  const [notas, setNotas] = useState('');
  const [horasInvestidas, setHorasInvestidas] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Validation
  const isValid = notas.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user?.uid) {
      setError('Usuário não autenticado');
      return;
    }

    if (!isValid) {
      setError('Notas devem ter pelo menos 10 caracteres');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const dataVerificacao = new Date();
      const timestamp = {
        seconds: Math.floor(dataVerificacao.getTime() / 1000),
        nanoseconds: 0,
      };

      const input: CreateVerificacaoInput = {
        verificadoPor: user.uid,
        dataVerificacao: timestamp as any,
        resultado,
        notas: notas.trim(),
        horasInvestidas: horasInvestidas > 0 ? horasInvestidas : undefined,
      };

      await verifyCAPA(labId, capaId, input);
      setResultado('efetiva');
      setNotas('');
      setHorasInvestidas(0);

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar verificação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = externalLoading || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 bg-[#141417] text-white rounded-lg border border-white/10"
      role="form"
      aria-label="Formulário de verificação de CAPA"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-lg font-semibold text-white">Verificação de Efetividade</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-white/60 hover:text-white/90 focus:ring-2 focus:ring-violet-500 rounded p-1 disabled:opacity-50"
            aria-label="Fechar formulário"
            disabled={isDisabled}
          >
            ✕
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-4 py-3 bg-red-900/20 border border-red-700/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Info Box */}
      <div className="px-3 py-2 bg-blue-900/20 border border-blue-700/50 rounded text-blue-200 text-xs">
        Data de verificação: <strong>{new Date(today).toLocaleDateString('pt-BR')}</strong>
      </div>

      {/* Resultado Radio Group */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-white/90">
          Resultado da Ação <span className="text-red-400">*</span>
        </legend>

        {RESULTADO_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-3 p-3 rounded border border-white/10 hover:bg-white/[0.02] cursor-pointer transition-colors has-[:checked]:border-violet-600 has-[:checked]:bg-violet-600/10"
          >
            <input
              type="radio"
              name="resultado"
              value={option.value}
              checked={resultado === option.value}
              onChange={(e) => setResultado(e.target.value as VerificacaoResultado)}
              disabled={isDisabled}
              className="mt-1 accent-violet-600 focus:ring-2 focus:ring-violet-500"
              aria-label={option.label}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">{option.label}</p>
              <p className="text-xs text-white/60">{option.description}</p>
            </div>
          </label>
        ))}
      </fieldset>

      {/* Notas Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="notas" className="text-sm font-medium text-white/90">
          Notas da Verificação <span className="text-red-400">*</span>
        </label>
        <textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Descreva como foi realizada a verificação, resultados observados, evidências..."
          rows={4}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none disabled:opacity-50"
          aria-label="Notas da verificação"
          aria-describedby="notas-hint"
          disabled={isDisabled}
        />
        <p id="notas-hint" className="text-xs text-white/50">
          Mínimo 10 caracteres. Descreva como você verificou a efetividade da ação.
        </p>
      </div>

      {/* Horas Investidas Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="horasInvestidas" className="text-sm font-medium text-white/90">
          Horas Investidas <span className="text-white/60">(opcional)</span>
        </label>
        <input
          id="horasInvestidas"
          type="number"
          min="0"
          step="0.5"
          value={horasInvestidas}
          onChange={(e) => setHorasInvestidas(parseFloat(e.target.value) || 0)}
          placeholder="Ex: 2.5"
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          aria-label="Horas investidas na verificação"
          aria-describedby="horas-hint"
          disabled={isDisabled}
        />
        <p id="horas-hint" className="text-xs text-white/50">
          Para rastreamento de esforço (DICQ 4.14.2)
        </p>
      </div>

      {/* Auto-close info for efetiva */}
      {resultado === 'efetiva' && (
        <div className="px-3 py-2 bg-emerald-900/20 border border-emerald-700/50 rounded text-emerald-200 text-xs">
          ✓ Ao submeter, esta CAPA será automaticamente <strong>fechada</strong>.
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded focus:ring-2 focus:ring-violet-500 transition-colors"
            disabled={isDisabled}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded focus:ring-2 focus:ring-violet-400 transition-colors font-medium"
          disabled={!isValid || isDisabled}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Submetendo...' : 'Registrar Verificação'}
        </button>
      </div>
    </form>
  );
}
