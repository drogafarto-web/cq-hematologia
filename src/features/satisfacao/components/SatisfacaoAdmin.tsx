import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { NPSScoreCard } from './NPSScoreCard';
import type { LabId } from '../../../types';

interface CampanhaData {
  id: string;
  titulo: string;
  status: 'planejada' | 'ativa' | 'concluida';
  dataInicio: any;
  dataFim: any;
}

export const SatisfacaoAdmin: React.FC = () => {
  const labId = useActiveLabId() as LabId;
  const [campanhas, setCampanhas] = useState<CampanhaData[]>([]);
  const [selectedTab, setSelectedTab] = useState<'nps' | 'campanhas'>('nps');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!labId) return;

    const loadCampanhas = async () => {
      try {
        const q = query(
          collection(db, `labs/${labId}/satisfacao-campanhas`),
          where('deletadoEm', '==', null)
        );
        const snap = await getDocs(q);
        setCampanhas(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as CampanhaData[]
        );
      } catch (error) {
        console.error('Error loading campanhas:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCampanhas();
  }, [labId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Satisfação do Cliente</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSelectedTab('nps')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'nps'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          NPS Score
        </button>
        <button
          onClick={() => setSelectedTab('campanhas')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'campanhas'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Campanhas ({campanhas.length})
        </button>
      </div>

      {/* Content */}
      <div>
        {selectedTab === 'nps' && (
          <div className="space-y-6">
            <NPSScoreCard labId={labId} title="NPS Geral" />
            <NPSScoreCard
              labId={labId}
              origem="pos-reclamacao"
              title="NPS Pós-Resolução de Reclamação"
            />
            <NPSScoreCard
              labId={labId}
              origem="trimestral"
              title="NPS Trimestral"
            />
          </div>
        )}

        {selectedTab === 'campanhas' && (
          <div>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Carregando campanhas...</div>
            ) : campanhas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhuma campanha encontrada</div>
            ) : (
              <div className="grid gap-4">
                {campanhas.map((campanha) => (
                  <div
                    key={campanha.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1f2937]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {campanha.titulo}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          campanha.status === 'ativa'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : campanha.status === 'planejada'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {campanha.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(campanha.dataInicio).toLocaleDateString()} -{' '}
                      {new Date(campanha.dataFim).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
