import React, { useState, useEffect } from 'react';
import { db } from '../../../shared/services/firebase';
import { getDoc, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { StatusBadge } from './StatusBadge';
import { SLATracker } from './SLATracker';
import { StatusTransitionModal } from './StatusTransitionModal';
import { RCAFiveWhysForm } from './RCAFiveWhysForm';
import { ResolucaoForm } from './ResolucaoForm';
import { ComunicacaoTimeline } from './ComunicacaoTimeline';
import { AcoesCorretivas, Acao } from './AcoesCorretivas';
import { validateTransition } from '../utils/stateMachine';
import type { ReclamacaoStatus } from '../utils/stateMachine';
import { functions } from '../../../shared/services/firebase';
import { httpsCallable } from 'firebase/functions';
import type { LabId } from '../types';

interface ReclamacaoDetailProps {
  id: string;
}

interface Reclamacao {
  id: string;
  descricao: string;
  reclamante: {
    nome: string;
    cpf: string;
    email?: string;
    telefone?: string;
  };
  status: ReclamacaoStatus;
  severidade: string;
  canalEntrada: string;
  criadoEm: any;
  slaPrazo: any;
  classificacaoAuto?: {
    tipo: string;
    severidade: string;
    areaResponsavel: string;
  };
  rcaFiveWhys?: any;
  acoesCorrretivas?: Acao[];
  resolucao?: any;
}

export const ReclamacaoDetail: React.FC<ReclamacaoDetailProps> = ({ id }) => {
  const labId = useActiveLabId() as LabId;
  const user = useUser();

  const [reclamacao, setReclamacao] = useState<Reclamacao | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRCAForm, setShowRCAForm] = useState(false);
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!labId || !id) return;

    const loadReclamacao = async () => {
      try {
        const docRef = doc(db, `labs/${labId}/reclamacoes`, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Reclamação não encontrada');
          return;
        }

        const data = docSnap.data() as Reclamacao;
        setReclamacao({ ...data, id: docSnap.id });
        setAcoes(data.acoesCorrretivas || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar reclamação');
      } finally {
        setIsLoading(false);
      }
    };

    loadReclamacao();
  }, [labId, id]);

  const handleTransition = async (novoStatus: ReclamacaoStatus, descricao: string) => {
    if (!reclamacao || !labId || !user?.uid) return;

    if (!validateTransition(reclamacao.status, novoStatus)) {
      setError('Transição de status inválida');
      return;
    }

    try {
      setIsTransitioning(true);
      const transitarReclamacao = httpsCallable(functions, 'transitarReclamacao');

      await transitarReclamacao({
        labId,
        reclamacaoId: id,
        novoStatus,
        descricaoTransicao: descricao,
      });

      setReclamacao({ ...reclamacao, status: novoStatus });
      setShowStatusModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleRCASubmit = async (rcaData: any) => {
    if (!reclamacao || !labId) return;

    try {
      const docRef = doc(db, `labs/${labId}/reclamacoes`, id);
      await updateDoc(docRef, {
        rcaFiveWhys: rcaData,
        updatedAt: serverTimestamp(),
      });

      setReclamacao({ ...reclamacao, rcaFiveWhys: rcaData });
      setShowRCAForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar RCA');
    }
  };

  const handleResolutionSubmit = async (resolucao: any) => {
    if (!reclamacao || !labId) return;

    try {
      // If resolution is ineffective, reopen to RCA status
      const newStatus = resolucao.eficacia === 'ineficaz' ? 'RCA' : 'Resolvida';

      const docRef = doc(db, `labs/${labId}/reclamacoes`, id);
      await updateDoc(docRef, {
        resolucao: {
          ...resolucao,
          descricaoEm: serverTimestamp(),
        },
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setReclamacao({
        ...reclamacao,
        resolucao: { ...resolucao, descricaoEm: new Date() },
        status: newStatus,
      });
      setShowResolutionForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar resolução');
    }
  };

  const handleAddAcao = async (acao: Omit<Acao, 'id'>) => {
    if (!labId || !reclamacao) return;

    try {
      const newId = Date.now().toString();
      const novasAcoes = [...acoes, { ...acao, id: newId }];
      setAcoes(novasAcoes);

      const docRef = doc(db, `labs/${labId}/reclamacoes`, id);
      await updateDoc(docRef, {
        acoesCorrretivas: novasAcoes,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar ação');
    }
  };

  const handleUpdateAcao = async (acaoId: string, updates: Partial<Acao>) => {
    if (!labId || !reclamacao) return;

    try {
      const novasAcoes = acoes.map((a) => (a.id === acaoId ? { ...a, ...updates } : a));
      setAcoes(novasAcoes);

      const docRef = doc(db, `labs/${labId}/reclamacoes`, id);
      await updateDoc(docRef, {
        acoesCorrretivas: novasAcoes,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar ação');
    }
  };

  const handleDeleteAcao = async (acaoId: string) => {
    if (!labId || !reclamacao) return;

    try {
      const novasAcoes = acoes.filter((a) => a.id !== acaoId);
      setAcoes(novasAcoes);

      const docRef = doc(db, `labs/${labId}/reclamacoes`, id);
      await updateDoc(docRef, {
        acoesCorrretivas: novasAcoes,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover ação');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0c0c0c] flex items-center justify-center">
        <div className="animate-spin">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
          </svg>
        </div>
      </div>
    );
  }

  if (error && !reclamacao) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0c0c0c] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Erro</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!reclamacao) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0c0c0c] py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Reclamação #{id.slice(-6)}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {new Date(reclamacao.criadoEm?.toDate?.() || reclamacao.criadoEm).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusBadge status={reclamacao.status} size="lg" />
            <SLATracker slaPrazo={reclamacao.slaPrazo} />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Details */}
          <div className="col-span-2 space-y-6">
            {/* Reclamant info */}
            <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Dados do Reclamante
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Nome</label>
                  <p className="font-medium text-gray-900 dark:text-white">{reclamacao.reclamante.nome}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">CPF</label>
                  <p className="font-medium text-gray-900 dark:text-white">{reclamacao.reclamante.cpf}</p>
                </div>
                {reclamacao.reclamante.email && (
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {reclamacao.reclamante.email}
                    </p>
                  </div>
                )}
                {reclamacao.reclamante.telefone && (
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400">Telefone</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {reclamacao.reclamante.telefone}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Descrição da Reclamação
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {reclamacao.descricao}
              </p>
              <div className="mt-4 flex gap-3">
                <span className="px-3 py-1.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                  Canal: {reclamacao.canalEntrada}
                </span>
                <span className={`px-3 py-1.5 text-xs rounded-full font-medium ${
                  reclamacao.severidade === 'alta'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : reclamacao.severidade === 'media'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}>
                  Severidade: {reclamacao.severidade}
                </span>
              </div>
            </div>

            {/* IA Classification */}
            {reclamacao.classificacaoAuto && (
              <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Classificação Automática (Gemini)
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400">Tipo</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {reclamacao.classificacaoAuto.tipo}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400">Severidade</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {reclamacao.classificacaoAuto.severidade}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Área Responsável</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {reclamacao.classificacaoAuto.areaResponsavel}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* RCA Section */}
            {!showRCAForm && reclamacao.rcaFiveWhys ? (
              <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  5 Whys - Causa Raiz
                </h2>
                <div className="space-y-3">
                  {reclamacao.rcaFiveWhys.niveis?.map((nivel: any) => (
                    <div key={nivel.nivel}>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Nível {nivel.nivel}
                      </p>
                      <p className="text-gray-900 dark:text-white">{nivel.resposta}</p>
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                      Causa Raiz Identificada
                    </p>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {reclamacao.rcaFiveWhys.nivelRaiz}
                    </p>
                  </div>
                </div>
              </div>
            ) : reclamacao.status === 'RCA' || reclamacao.status === 'Resolvida' ? (
              <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Preencher 5 Whys
                  </h2>
                  {reclamacao.rcaFiveWhys && (
                    <button
                      onClick={() => setShowRCAForm(true)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
                {showRCAForm ? (
                  <RCAFiveWhysForm
                    labId={labId}
                    reclamacaoId={id}
                    onSubmit={handleRCASubmit}
                  />
                ) : (
                  <button
                    onClick={() => setShowRCAForm(true)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Iniciar RCA 5 Whys
                  </button>
                )}
              </div>
            ) : null}

            {/* Ações Corretivas */}
            {reclamacao.severidade === 'alta' && (
              <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <AcoesCorretivas
                  acoes={acoes}
                  onAddAcao={handleAddAcao}
                  onUpdateAcao={handleUpdateAcao}
                  onDeleteAcao={handleDeleteAcao}
                />
              </div>
            )}

            {/* Resolution Form */}
            {reclamacao.status === 'RCA' && (
              <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Registrar Resolução
                </h2>
                {showResolutionForm || !reclamacao.resolucao ? (
                  <ResolucaoForm
                    reclamacaoId={id}
                    onSubmit={handleResolutionSubmit}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-700 dark:text-gray-300">
                      {reclamacao.resolucao.descricao}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Eficácia: {reclamacao.resolucao.eficacia}
                    </p>
                    <button
                      onClick={() => setShowResolutionForm(true)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Communications */}
            <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <ComunicacaoTimeline labId={labId} reclamacaoId={id} />
            </div>
          </div>

          {/* Right: Actions panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Ações
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowStatusModal(true)}
                  disabled={isTransitioning}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  Alterar Status
                </button>
              </div>

              {/* Status info */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status Atual</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    <StatusBadge status={reclamacao.status} />
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Prazo SLA</p>
                  <SLATracker slaPrazo={reclamacao.slaPrazo} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Transition Modal */}
      <StatusTransitionModal
        isOpen={showStatusModal}
        currentStatus={reclamacao.status}
        reclamacaoId={id}
        onConfirm={handleTransition}
        onClose={() => setShowStatusModal(false)}
      />
    </div>
  );
};
