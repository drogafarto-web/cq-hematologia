import React, { useState } from 'react';

export interface Acao {
  id: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  status: 'pendente' | 'concluida' | 'atrasada';
}

interface AcoesCorretivasProps {
  acoes: Acao[];
  onAddAcao: (acao: Omit<Acao, 'id'>) => Promise<void>;
  onUpdateAcao: (id: string, acao: Partial<Acao>) => Promise<void>;
  onDeleteAcao: (id: string) => Promise<void>;
}

export const AcoesCorretivas: React.FC<AcoesCorretivasProps> = ({
  acoes,
  onAddAcao,
  onUpdateAcao,
  onDeleteAcao,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    descricao: '',
    responsavel: '',
    prazo: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddAcao = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descricao.trim() || !formData.prazo) {
      setError('Descrição e prazo são obrigatórios');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onAddAcao({
        ...formData,
        status: 'pendente',
      });
      setFormData({ descricao: '', responsavel: '', prazo: '' });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar ação');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (
    id: string,
    newStatus: 'pendente' | 'concluida' | 'atrasada',
  ) => {
    try {
      await onUpdateAcao(id, { status: newStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  };

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'concluida':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'atrasada':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ações Corretivas</h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + Adicionar
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <form
          onSubmit={handleAddAcao}
          className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva a ação corretiva..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Responsável
              </label>
              <input
                type="text"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome completo"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prazo
              </label>
              <input
                type="date"
                value={formData.prazo}
                onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-2">
        {acoes.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">
            Nenhuma ação corretiva adicionada
          </p>
        ) : (
          acoes.map((acao) => (
            <div
              key={acao.id}
              className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {acao.descricao}
                  </p>
                  {acao.responsavel && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Responsável: {acao.responsavel}
                    </p>
                  )}
                </div>
                <select
                  value={acao.status}
                  onChange={(e) =>
                    handleStatusChange(
                      acao.id,
                      e.target.value as 'pendente' | 'concluida' | 'atrasada',
                    )
                  }
                  className={`px-2 py-1 text-xs rounded-full font-medium ${statusBadgeColor(
                    acao.status,
                  )}`}
                >
                  <option value="pendente">Pendente</option>
                  <option value="concluida">Concluída</option>
                  <option value="atrasada">Atrasada</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Prazo: {new Date(acao.prazo).toLocaleDateString('pt-BR')}
                </p>
                <button
                  type="button"
                  onClick={() => onDeleteAcao(acao.id)}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
