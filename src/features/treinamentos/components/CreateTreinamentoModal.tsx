import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { TIPO_LABEL } from '../types/Treinamento';
import type { TipoTreinamento } from '../types/Treinamento';

interface CreateTreinamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateTreinamentoModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTreinamentoModalProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const uid = user?.uid;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    popId: '',
    popNome: '',
    popVersaoNumero: '1.0',
    tipo: 'inicial' as TipoTreinamento,
    titulo: '',
    dataAgendada: '',
    duracao_minutos: 120,
    participantes: '',
  });

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'duracao_minutos' ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId || !uid) return;

    setLoading(true);
    setError('');

    try {
      const callable = httpsCallable(functions, 'criarTreinamento');
      await callable({
        labId,
        popId: formData.popId,
        popNome: formData.popNome,
        popVersaoNumero: formData.popVersaoNumero,
        tipo: formData.tipo,
        titulo: formData.titulo,
        dataAgendada: new Date(formData.dataAgendada).toISOString(),
        instrutorId: uid,
        duracao_minutos: formData.duracao_minutos,
        participantes: formData.participantes.split(',').map((id) => id.trim()),
      });

      setFormData({
        popId: '',
        popNome: '',
        popVersaoNumero: '1.0',
        tipo: 'inicial',
        titulo: '',
        dataAgendada: '',
        duracao_minutos: 120,
        participantes: '',
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar treinamento');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-white mb-4">Agendar Treinamento</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300">POP</label>
            <input
              type="text"
              name="popId"
              placeholder="ID da POP"
              value={formData.popId}
              onChange={handleInputChange}
              required
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
            <input
              type="text"
              name="popNome"
              placeholder="Nome da POP"
              value={formData.popNome}
              onChange={handleInputChange}
              required
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Tipo</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              >
                {Object.entries(TIPO_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300">Duração (min)</label>
              <input
                type="number"
                name="duracao_minutos"
                value={formData.duracao_minutos}
                onChange={handleInputChange}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300">Título</label>
            <input
              type="text"
              name="titulo"
              placeholder="Título do treinamento"
              value={formData.titulo}
              onChange={handleInputChange}
              required
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300">Data Agendada</label>
            <input
              type="datetime-local"
              name="dataAgendada"
              value={formData.dataAgendada}
              onChange={handleInputChange}
              required
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300">
              Participantes (UIDs separados por virgula)
            </label>
            <textarea
              name="participantes"
              placeholder="uid1, uid2, uid3"
              value={formData.participantes}
              onChange={handleInputChange}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded transition disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
