import React, { useEffect, useState } from 'react';
import { useLGPD } from '../useLGPD';
import type { SolicitacaoDados, LogExclusao } from '../types/LGPD';

/**
 * AdminDashboard — Request tracking and deletion verification for admins.
 * Workflow tracking, SLA monitoring, anonymization verification.
 */
export function AdminDashboard() {
  const { subscribeToSolicitacoes, subscribeToExclusoes, processarExclusao } = useLGPD();

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoDados[]>([]);
  const [exclusoes, setExclusoes] = useState<LogExclusao[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToSolicitacoes(
      (data) => {
        setSolicitacoes(data);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar solicitações:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [subscribeToSolicitacoes]);

  useEffect(() => {
    const unsub = subscribeToExclusoes(
      (data) => setExclusoes(data),
      (err) => console.error('Erro ao carregar logs de exclusão:', err)
    );

    return unsub;
  }, [subscribeToExclusoes]);

  const handleProcessarExclusao = async (solicitacao: SolicitacaoDados) => {
    if (!solicitacao.id) return;

    setProcessing(solicitacao.id);
    try {
      await processarExclusao(solicitacao.id, solicitacao.titular_id);
      // Data will refresh via subscription
    } catch (err: any) {
      console.error('Erro ao processar exclusão:', err);
      alert('Erro ao processar exclusão: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const calcularDiasRestantes = (dataPrazo: any): number => {
    const now = new Date();
    const prazo = dataPrazo?.toDate ? dataPrazo.toDate() : new Date(dataPrazo);
    const ms = prazo.getTime() - now.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'bg-yellow-100 text-yellow-900';
      case 'processando':
        return 'bg-blue-100 text-blue-900';
      case 'concluida':
        return 'bg-green-100 text-green-900';
      case 'recusada':
        return 'bg-red-100 text-red-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Carregando...</div>;

  const pendentes = solicitacoes.filter((s) => s.status === 'pendente');
  const comVencimento = pendentes.filter((s) => calcularDiasRestantes(s.data_prazo) <= 5);

  return (
    <div className="space-y-6 p-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-600">Total Solicitações</div>
          <div className="mt-2 text-2xl font-bold">{solicitacoes.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-600">Pendentes</div>
          <div className="mt-2 text-2xl font-bold text-yellow-600">{pendentes.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-600">Concluídas</div>
          <div className="mt-2 text-2xl font-bold text-green-600">
            {solicitacoes.filter((s) => s.status === 'concluida').length}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-600">Anonimizações</div>
          <div className="mt-2 text-2xl font-bold text-purple-600">{exclusoes.length}</div>
        </div>
      </div>

      {/* Urgent Warnings */}
      {comVencimento.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="font-medium text-red-900">⚠️ SLA Crítico</div>
          <div className="mt-2 text-sm text-red-800">
            {comVencimento.length} solicitação(ões) vencendo em 5 dias ou menos
          </div>
        </div>
      )}

      {/* Pending Requests */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold">Solicitações Pendentes</h3>
        <div className="mt-4 space-y-3">
          {pendentes.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhuma solicitação pendente</div>
          ) : (
            pendentes.map((solicitacao) => {
              const diasRestantes = calcularDiasRestantes(solicitacao.data_prazo);
              const isUrgent = diasRestantes <= 5;

              return (
                <div
                  key={solicitacao.id}
                  className={`rounded-lg border p-4 ${
                    isUrgent ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{solicitacao.titular_nome}</div>
                      <div className="mt-1 text-sm text-gray-600">{solicitacao.titular_email}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        ID: {solicitacao.titular_id}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-900">
                          {solicitacao.tipo.toUpperCase()}
                        </span>
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-medium ${getStatusColor(
                            solicitacao.status
                          )}`}
                        >
                          {solicitacao.status.toUpperCase()}
                        </span>
                        {isUrgent && (
                          <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-900">
                            {diasRestantes} dias
                          </span>
                        )}
                      </div>
                    </div>

                    {solicitacao.tipo === 'exclusao' && (
                      <button
                        onClick={() => handleProcessarExclusao(solicitacao)}
                        disabled={processing === solicitacao.id}
                        className="whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {processing === solicitacao.id ? 'Processando...' : 'Processar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Anonymization Log */}
      {exclusoes.length > 0 && (
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold">Histórico de Anonimizações</h3>
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {exclusoes.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <div className="flex-1">
                  <div className="font-medium">{log.usuario_nome}</div>
                  <div className="text-xs text-gray-500">
                    {log.dados_excluidos?.length || 0} registros anonimizados
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  {log.data_exclusao?.toDate?.().toLocaleDateString?.() || 'Data desconhecida'}
                </div>
                {log.verificado && (
                  <div className="ml-2 text-green-600">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Info */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="text-sm text-green-900">
          <strong>Conformidade LGPD:</strong>
          <ul className="mt-2 ml-4 space-y-1 list-disc text-xs">
            <li>Todas as solicitações têm SLA de 30 dias</li>
            <li>Exclusões incluem 7 anos de retenção de arquivo</li>
            <li>PII é criptografado com SHA-256</li>
            <li>Trilha de auditoria completa mantida</li>
            <li>Anonimização verificada antes de conclusão</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
