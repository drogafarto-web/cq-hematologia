import React, { useState } from 'react';
import { getNextStates, getStatusLabel, type ReclamacaoStatus } from '../utils/stateMachine';

interface StatusTransitionModalProps {
  isOpen: boolean;
  currentStatus: ReclamacaoStatus;
  reclamacaoId: string;
  onConfirm: (novoStatus: ReclamacaoStatus, descricao: string) => Promise<void>;
  onClose: () => void;
}

export const StatusTransitionModal: React.FC<StatusTransitionModalProps> = ({
  isOpen,
  currentStatus,
  reclamacaoId,
  onConfirm,
  onClose,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ReclamacaoStatus | ''>('');
  const [statusToConfirm, setStatusToConfirm] = useState<ReclamacaoStatus | null>(null);
  const [descricao, setDescricao] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validNextStates = getNextStates(currentStatus);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedStatus) {
      setError('Selecione um novo status');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // Cast selectedStatus to ReclamacaoStatus since we know it's not empty
      await onConfirm(selectedStatus as ReclamacaoStatus, descricao);
      setSelectedStatus('');
      setDescricao('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Alterar Status da Reclamação
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Status atual: <strong>{getStatusLabel(currentStatus)}</strong>
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Status selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Novo status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ReclamacaoStatus | '')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um status</option>
              {validNextStates.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o motivo da transição..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !selectedStatus}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};
