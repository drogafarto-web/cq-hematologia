import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId } from '../types';

interface Comunicacao {
  id: string;
  para: string;
  assunto: string;
  status: 'enviado' | 'erro' | 'entregue';
  criadoEm: any;
  messageId?: string;
}

interface ComunicacaoTimelineProps {
  labId: LabId;
  reclamacaoId: string;
}

export const ComunicacaoTimeline: React.FC<ComunicacaoTimelineProps> = ({
  labId,
  reclamacaoId,
}) => {
  const [comunicacoes, setComunicacoes] = useState<Comunicacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!labId || !reclamacaoId) return;

    const loadComunicacoes = async () => {
      try {
        const q = query(
          collection(db, `labs/${labId}/comunicacoes-cliente`),
          where('reclamacaoId', '==', reclamacaoId),
        );
        const snap = await getDocs(q);

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Comunicacao[];

        // Sort by date descending
        setComunicacoes(
          data.sort((a, b) => {
            const dateA = a.criadoEm?.toDate?.() || new Date(a.criadoEm);
            const dateB = b.criadoEm?.toDate?.() || new Date(b.criadoEm);
            return dateB.getTime() - dateA.getTime();
          }),
        );
      } catch (error) {
        console.error('Error loading comunicacoes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComunicacoes();
  }, [labId, reclamacaoId]);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Carregando comunicações...
      </div>
    );
  }

  if (comunicacoes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Nenhuma comunicação enviada
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'entregue':
        return (
          <svg
            className="w-5 h-5 text-green-600 dark:text-green-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'erro':
        return (
          <svg
            className="w-5 h-5 text-red-600 dark:text-red-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'entregue':
        return 'Entregue';
      case 'erro':
        return 'Erro';
      default:
        return 'Enviado';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'entregue':
        return 'text-green-700 dark:text-green-400';
      case 'erro':
        return 'text-red-700 dark:text-red-400';
      default:
        return 'text-blue-700 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Timeline de Comunicações
      </h3>

      <div className="space-y-3">
        {comunicacoes.map((com, index) => {
          const data = com.criadoEm?.toDate?.() || new Date(com.criadoEm);
          const isLast = index === comunicacoes.length - 1;

          return (
            <div key={com.id} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div
                  className={`rounded-full p-1.5 ${getStatusColor(com.status)} bg-white dark:bg-[#1f2937] border-2`}
                >
                  {getStatusIcon(com.status)}
                </div>
                {!isLast && <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-700 mt-2" />}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {com.assunto}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Para: {com.para}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        com.status === 'entregue'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : com.status === 'erro'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {getStatusLabel(com.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {data.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
