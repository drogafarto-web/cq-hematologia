/**
 * IAFeedbackLoop — Operator feedback UI for strip OCR corrections
 *
 * Features:
 * - Editable table of parsed analytes
 * - Flag highlighting (low-confidence, unit-mismatch, etc.)
 * - Consent checkbox (required to submit)
 * - Submit to handleMLTeamFeedback callable
 * - Audit log on correction
 *
 * LGPD: Consent gate. No patient identifiers. Feedback = corrected ground truth.
 */

import React, { useState, useCallback } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useUser } from '../../../store/useAuthStore';
import type { ValidatedAnalyte } from '../services/iaStripValidation';

interface Props {
  labId: string;
  validatedAnalytes: ValidatedAnalyte[];
  parsedResultId: string;
  onFeedbackSubmitted?: () => void;
}

interface EditableAnalyte extends ValidatedAnalyte {
  isEditing: boolean;
}

const FLAG_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  'low-confidence': { bg: 'bg-amber-500/10', text: 'text-amber-300', icon: '⚠️' },
  'unit-mismatch': { bg: 'bg-rose-500/10', text: 'text-rose-300', icon: '⚡' },
  'unknown-analyte': { bg: 'bg-violet-500/10', text: 'text-violet-300', icon: '❓' },
  'value-out-of-plausible-range': { bg: 'bg-rose-500/10', text: 'text-rose-300', icon: '📊' },
};

export default function IAFeedbackLoop({
  labId,
  validatedAnalytes,
  parsedResultId,
  onFeedbackSubmitted,
}: Props) {
  const user = useUser();
  const [analytes, setAnalytes] = useState<EditableAnalyte[]>(
    validatedAnalytes.map((a) => ({ ...a, isEditing: false })),
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Update analyte field
  const handleAnalyteChange = useCallback(
    (index: number, field: 'name' | 'value' | 'unit', value: string | number) => {
      const newAnalytes = [...analytes];
      newAnalytes[index] = {
        ...newAnalytes[index],
        [field]: value,
      };
      setAnalytes(newAnalytes);
    },
    [analytes],
  );

  // Submit feedback
  const handleSubmit = useCallback(async () => {
    if (!consentChecked) {
      setError('Consentimento obrigatório para enviar feedback');
      return;
    }

    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const functions = getFunctions();
      const handleMLTeamFeedback = httpsCallable(functions, 'handleMLTeamFeedback');

      const correctedAnalytes = analytes.map((a) => ({
        name: a.name,
        value: a.value,
        unit: a.unit,
        confidence: a.confidence,
      }));

      await handleMLTeamFeedback({
        labId,
        parsedResultId,
        correctedAnalytes,
        operatorId: user.uid,
        consentGiven: consentChecked,
      });

      setSuccess(true);
      setTimeout(() => {
        onFeedbackSubmitted?.();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Falha ao enviar feedback');
    } finally {
      setIsSubmitting(false);
    }
  }, [consentChecked, user, labId, parsedResultId, analytes, onFeedbackSubmitted]);

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          ✓ Obrigado — feedback enviado com sucesso
        </div>
      )}

      {/* Editable table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-left text-white/70 font-medium">Analito</th>
              <th className="px-4 py-3 text-right text-white/70 font-medium">Valor</th>
              <th className="px-4 py-3 text-left text-white/70 font-medium">Unidade</th>
              <th className="px-4 py-3 text-center text-white/70 font-medium text-xs">Confiança</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {analytes.map((analyte, i) => {
              const hasFlagsClass = analyte.flags.length > 0 ? `ring-1 ring-amber-400/40` : '';

              return (
                <tr key={i} className={`hover:bg-white/[0.02] transition-colors ${hasFlagsClass}`}>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={analyte.name}
                      onChange={(e) => handleAnalyteChange(i, 'name', e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 text-xs disabled:opacity-50"
                      placeholder="Nome do analito"
                    />
                    {analyte.flags.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {analyte.flags.map((flag) => {
                          const colors = FLAG_COLORS[flag] || FLAG_COLORS['unknown-analyte'];
                          return (
                            <div
                              key={flag}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
                            >
                              <span>{colors.icon}</span>
                              <span className="capitalize">{flag.replace(/-/g, ' ')}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.001"
                      value={analyte.value}
                      onChange={(e) => handleAnalyteChange(i, 'value', parseFloat(e.target.value))}
                      disabled={isSubmitting}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-right text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 text-xs font-mono tabular-nums disabled:opacity-50"
                      placeholder="0.0"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={analyte.unit}
                      onChange={(e) => handleAnalyteChange(i, 'unit', e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 text-xs disabled:opacity-50"
                      placeholder="mIU/L"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-1 rounded bg-white/5 text-white/70 text-xs font-mono">
                      {(analyte.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Consent checkbox */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            disabled={isSubmitting}
            className="w-4 h-4 mt-1 rounded bg-white/10 border-white/20 text-violet-600 cursor-pointer disabled:opacity-50"
          />
          <span className="text-white/70 text-sm">
            Concordo em compartilhar este resultado corrigido para retreino do modelo de IA
          </span>
        </label>
        <p className="text-xs text-white/40 pl-7">
          Seus dados corrigidos ajudam a melhorar a precisão da análise automática. Nenhuma
          informação de paciente é incluída — apenas os valores analíticos.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setAnalytes(validatedAnalytes.map((a) => ({ ...a, isEditing: false })));
          }}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Resetar
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !consentChecked}
          aria-busy={isSubmitting}
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Feedback'}
        </button>
      </div>
    </div>
  );
}
