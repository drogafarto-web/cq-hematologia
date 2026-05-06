import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import type { LabId } from '../../../types';

interface NPSRespostaProps {
  npsToken: string;
  labId: LabId;
}

export const NPSResposta: React.FC<NPSRespostaProps> = ({ npsToken, labId }) => {
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [consentLgpd, setConsentLgpd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nota === null) {
      setError('Selecione uma nota');
      return;
    }

    if (!consentLgpd) {
      setError('Aceite o consentimento LGPD');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const submitNPS = httpsCallable(functions, 'submitNPSResposta');
      await submitNPS({
        npsToken,
        nota,
        comentario,
        consentimentoLgpd: {
          aceito: true,
          ipAddress: 'client-side',
          userAgent: navigator.userAgent,
        },
      });

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar resposta');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-[#1f2937] rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Obrigado pela sua avaliação!
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Sua resposta foi registrada com sucesso.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto bg-white dark:bg-[#1f2937] rounded-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Sua opinião é importante
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Como foi sua experiência com nosso laboratório?
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Score selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Qual é seu nível de satisfação?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setNota(score)}
                className={`p-3 rounded-lg font-bold transition-all ${
                  nota === score
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span>Muito insatisfeito</span>
            <span>Muito satisfeito</span>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Comentário (opcional)
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={1000}
            placeholder="Compartilhe sua experiência..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {comentario.length}/1000
          </p>
        </div>

        {/* LGPD consent */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="consent"
            checked={consentLgpd}
            onChange={(e) => setConsentLgpd(e.target.checked)}
            className="mt-1 rounded"
          />
          <label htmlFor="consent" className="text-sm text-gray-600 dark:text-gray-400">
            Autorizo o processamento de meus dados conforme a{' '}
            <a href="/politica-privacidade" className="text-blue-600 hover:underline">
              política de privacidade
            </a>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || nota === null || !consentLgpd}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar avaliação'}
        </button>
      </form>
    </div>
  );
};
