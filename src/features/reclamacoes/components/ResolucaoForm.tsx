import React, { useState } from 'react';

interface ResolucaoFormProps {
  reclamacaoId: string;
  onSubmit: (resolucao: {
    descricao: string;
    eficacia: 'eficaz' | 'parcial' | 'ineficaz';
  }) => Promise<void>;
}

export const ResolucaoForm: React.FC<ResolucaoFormProps> = ({ reclamacaoId, onSubmit }) => {
  const [descricao, setDescricao] = useState('');
  const [eficacia, setEficacia] = useState<'eficaz' | 'parcial' | 'ineficaz'>('eficaz');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!descricao.trim()) {
      setError('Descrição da resolução é obrigatória');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({ descricao, eficacia });
      setDescricao('');
      setEficacia('eficaz');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar resolução');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Descrição da Resolução
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva como a reclamação foi resolvida..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Eficácia da Resolução
        </label>
        <select
          value={eficacia}
          onChange={(e) => setEficacia(e.target.value as 'eficaz' | 'parcial' | 'ineficaz')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="eficaz">Eficaz - Problema totalmente resolvido</option>
          <option value="parcial">Parcial - Resolvido em parte</option>
          <option value="ineficaz">Ineficaz - Não resolveu o problema</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {isSubmitting ? 'Salvando...' : 'Confirmar Resolução'}
      </button>
    </form>
  );
};
