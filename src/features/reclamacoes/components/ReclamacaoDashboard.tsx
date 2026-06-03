import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, QueryConstraint } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { ReclamacaoDetail } from './ReclamacaoDetail';
import type { LabId } from '../types';

interface ReclamacaoItem {
  id: string;
  titulo?: string;
  descricao: string;
  status: string;
  severidade: string;
  canalEntrada: string;
  reclamante: { nome: string };
  recebidoEm: any;
}

export const ReclamacaoDashboard: React.FC = () => {
  const labId = useActiveLabId() as LabId;
  const [reclamacoes, setReclamacoes] = useState<ReclamacaoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('Nova');
  const [selectedSeveridade, setSelectedSeveridade] = useState('todas');
  const [selectedReclamacaoId, setSelectedReclamacaoId] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) return;

    const loadReclamacoes = async () => {
      try {
        const constraints: QueryConstraint[] = [
          where('labId', '==', labId),
          where('deletadoEm', '==', null),
        ];

        if (selectedStatus !== 'todas') {
          constraints.push(where('status', '==', selectedStatus));
        }

        if (selectedSeveridade !== 'todas') {
          constraints.push(where('severidade', '==', selectedSeveridade));
        }

        const q = query(collection(db, `labs/${labId}/reclamacoes`), ...constraints);
        const snap = await getDocs(q);

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ReclamacaoItem[];

        setReclamacoes(data);
      } catch (error) {
        console.error('Error loading reclamacoes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReclamacoes();
  }, [labId, selectedStatus, selectedSeveridade]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Reclamações ({reclamacoes.length})
        </h1>
        <a
          href="/reclamacoes/nova"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Nova reclamação
        </a>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white"
          >
            <option value="Nova">Nova</option>
            <option value="Analisando">Analisando</option>
            <option value="RCA">RCA</option>
            <option value="Resolvida">Resolvida</option>
            <option value="Comunicada">Comunicada</option>
            <option value="Fechada">Fechada</option>
            <option value="todas">Todas</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Severidade
          </label>
          <select
            value={selectedSeveridade}
            onChange={(e) => setSelectedSeveridade(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1f2937] text-gray-900 dark:text-white"
          >
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
            <option value="todas">Todas</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Carregando reclamações...</div>
        ) : reclamacoes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhuma reclamação encontrada</div>
        ) : (
          reclamacoes.map((rec) => (
            <button
              key={rec.id}
              onClick={() => setSelectedReclamacaoId(rec.id)}
              className="w-full text-left p-4 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a3746] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {rec.reclamante.nome}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {rec.descricao}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      {rec.canalEntrada}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        rec.severidade === 'alta'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : rec.severidade === 'media'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}
                    >
                      {rec.severidade}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-3 py-1 text-sm rounded-full font-medium ${
                      rec.status === 'Nova'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : rec.status === 'Fechada'
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Detail view modal */}
      {selectedReclamacaoId && (
        <div className="fixed inset-0 z-40 bg-black/40 overflow-y-auto">
          <ReclamacaoDetail id={selectedReclamacaoId} />
        </div>
      )}
    </div>
  );
};
