import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { createCargo, updateCargo } from '../services/cargoService';
import type { CargoInput } from '../types';

interface CargoFormProps {
  onSuccess?: (cargoId: string) => void;
  onError?: (error: Error) => void;
  initialData?: CargoInput;
  isEdit?: boolean;
  cargoId?: string;
}

export const CargoForm: React.FC<CargoFormProps> = ({
  onSuccess,
  onError,
  initialData,
  isEdit = false,
  cargoId,
}) => {
  const labId = useActiveLabId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState(initialData?.titulo || '');
  const [descricao, setDescricao] = useState(initialData?.descricao || '');
  const [responsabilidades, setResponsabilidades] = useState<string[]>(
    initialData?.responsabilidades ? [...initialData.responsabilidades] : ['']
  );
  const [autoridades, setAutoridades] = useState<string[]>(
    initialData?.autoridades ? [...initialData.autoridades] : ['']
  );
  const [certificacoes, setCertificacoes] = useState<string[]>(
    initialData?.certificacoes ? [...initialData.certificacoes] : ['']
  );
  const [reportaA, setReportaA] = useState(initialData?.reportaA || '');

  if (!labId) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
        Lab não selecionado. Selecione um lab antes de continuar.
      </div>
    );
  }

  const addResponsabilidade = () => {
    setResponsabilidades([...responsabilidades, '']);
  };

  const removeResponsabilidade = (index: number) => {
    setResponsabilidades(responsabilidades.filter((_, i) => i !== index));
  };

  const updateResponsabilidade = (index: number, value: string) => {
    const updated = [...responsabilidades];
    updated[index] = value;
    setResponsabilidades(updated);
  };

  const addAutoridade = () => {
    setAutoridades([...autoridades, '']);
  };

  const removeAutoridade = (index: number) => {
    setAutoridades(autoridades.filter((_, i) => i !== index));
  };

  const updateAutoridade = (index: number, value: string) => {
    const updated = [...autoridades];
    updated[index] = value;
    setAutoridades(updated);
  };

  const addCertificacao = () => {
    setCertificacoes([...certificacoes, '']);
  };

  const removeCertificacao = (index: number) => {
    setCertificacoes(certificacoes.filter((_, i) => i !== index));
  };

  const updateCertificacao = (index: number, value: string) => {
    const updated = [...certificacoes];
    updated[index] = value;
    setCertificacoes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError('Título é obrigatório');
      return;
    }

    if (!descricao.trim()) {
      setError('Descrição é obrigatória');
      return;
    }

    const filteredResponsabilidades = responsabilidades.filter(r => r.trim());
    const filteredAutoridades = autoridades.filter(a => a.trim());
    const filteredCertificacoes = certificacoes.filter(c => c.trim());

    if (filteredResponsabilidades.length === 0) {
      setError('Adicione pelo menos uma responsabilidade');
      return;
    }

    if (filteredAutoridades.length === 0) {
      setError('Adicione pelo menos uma autoridade');
      return;
    }

    try {
      setLoading(true);

      const input: CargoInput = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        responsabilidades: filteredResponsabilidades,
        autoridades: filteredAutoridades,
        ...(filteredCertificacoes.length > 0 && { certificacoes: filteredCertificacoes }),
        ...(reportaA && { reportaA }),
      };

      let id: string;
      if (isEdit && cargoId) {
        await updateCargo(labId, cargoId, input);
        id = cargoId;
      } else {
        id = await createCargo(labId, input);
      }

      onSuccess?.(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar cargo';
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Título */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Título *
        </label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Técnico de Laboratório"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Descrição Completa *
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição detalhada do cargo..."
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Responsabilidades */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Responsabilidades * (mínimo 1)
        </label>
        <div className="space-y-2">
          {responsabilidades.map((resp, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={resp}
                onChange={(e) => updateResponsabilidade(idx, e.target.value)}
                placeholder={`Responsabilidade ${idx + 1}`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {responsabilidades.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeResponsabilidade(idx)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addResponsabilidade}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            + Adicionar responsabilidade
          </button>
        </div>
      </div>

      {/* Autoridades */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Autoridades * (mínimo 1)
        </label>
        <div className="space-y-2">
          {autoridades.map((aut, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={aut}
                onChange={(e) => updateAutoridade(idx, e.target.value)}
                placeholder={`Autoridade ${idx + 1}`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {autoridades.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAutoridade(idx)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAutoridade}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            + Adicionar autoridade
          </button>
        </div>
      </div>

      {/* Certificações */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Certificações Necessárias (opcional)
        </label>
        <div className="space-y-2">
          {certificacoes.map((cert, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={cert}
                onChange={(e) => updateCertificacao(idx, e.target.value)}
                placeholder="Ex: ABCLIN, ISO 15189"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {certificacoes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCertificacao(idx)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addCertificacao}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            + Adicionar certificação
          </button>
        </div>
      </div>

      {/* Reporta A */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Reporta A (opcional)
        </label>
        <input
          type="text"
          value={reportaA}
          onChange={(e) => setReportaA(e.target.value)}
          placeholder="ID do cargo ao qual reporta"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        <button
          type="reset"
          disabled={loading}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
        >
          Limpar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
        >
          {loading ? 'Salvando...' : isEdit ? 'Atualizar Cargo' : 'Criar Cargo'}
        </button>
      </div>
    </form>
  );
};
