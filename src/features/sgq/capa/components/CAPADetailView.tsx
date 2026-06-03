/**
 * CAPADetailView — Detail page for single CAPA
 *
 * Sections:
 * - Finding summary (titulo, descricao, createdBy, priority, dataPrazo)
 * - Actions section (list of CAParecao with ActionCard)
 * - Verification form (if actions done)
 * - Audit trail (read-only, last 10 entries)
 *
 * Dark-first design, WCAG AA
 */

import React, { useState } from 'react';
import { useActiveLabId } from '../../../../store/useAuthStore';
import { useCAPADetail } from '../hooks/useCAPADetail';
import { updateCAPAStatus } from '../services/capaService';
import ActionCard from './ActionCard';
import VerificationForm from './VerificationForm';
import { QualityToolsPanel } from './tools/QualityToolsPanel';
import type { CAPAStatus } from '../types';
import type { QualityToolType } from '../types/qualityTools';

interface CAPADetailViewProps {
  capaId?: string;
  onBack?: () => void;
}

const STATUS_STYLES = {
  aberta: { bg: 'bg-red-900/20 border-red-700/50', text: 'text-red-200', icon: '●' },
  'em-tratamento': { bg: 'bg-amber-900/20 border-amber-700/50', text: 'text-amber-200', icon: '◐' },
  verificada: { bg: 'bg-blue-900/20 border-blue-700/50', text: 'text-blue-200', icon: '◐' },
  fechada: { bg: 'bg-emerald-900/20 border-emerald-700/50', text: 'text-emerald-200', icon: '✓' },
  cancelada: { bg: 'bg-gray-900/20 border-gray-700/50', text: 'text-gray-200', icon: '✕' },
};

function formatDate(timestamp: any): string {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '—';
  }
}

export default function CAPADetailView({ capaId: providedCapaId, onBack }: CAPADetailViewProps) {
  const labId = useActiveLabId();
  const effectiveCapaId = providedCapaId;

  const { capa, acoes, verificacoes, isLoading, error } = useCAPADetail(
    labId || '',
    effectiveCapaId || '',
  );

  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [usedTools, setUsedTools] = useState<QualityToolType[]>([]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141417]">
        <div className="text-white/60">Carregando CAPA...</div>
      </div>
    );
  }

  if (error || !capa) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141417] p-6">
        <div className="text-red-200">{error || 'CAPA não encontrada'}</div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[capa.status as CAPAStatus];
  const allActionsCompleted = acoes.length > 0 && acoes.every((a) => a.status === 'concluida');
  const canShowVerification = allActionsCompleted && !verificacoes.length;

  const handleStatusChange = async (newStatus: CAPAStatus) => {
    setIsUpdatingStatus(true);
    setStatusError(null);

    try {
      await updateCAPAStatus(labId || '', capa.id, newStatus, 'Status atualizado via UI');
    } catch (err: any) {
      setStatusError(err.message || 'Erro ao atualizar status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141417] text-white p-6">
      {/* Header with back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="mb-6 text-violet-400 hover:text-violet-300 focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
          aria-label="Voltar à lista de CAPAs"
        >
          ← Voltar
        </button>
      )}

      {/* Main Container */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Finding Summary Card */}
        <div className="p-6 bg-white/[0.02] border border-white/10 rounded-lg">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-white mb-2">{capa.titulo}</h1>
              <p className="text-white/70">{capa.descricao}</p>
            </div>
            <span
              className={`flex items-center gap-1 px-3 py-1 rounded border text-sm font-medium ${statusStyle.bg} ${statusStyle.text} whitespace-nowrap`}
              role="status"
              aria-label={`Status atual: ${capa.status}`}
            >
              <span>{statusStyle.icon}</span>
              <span className="capitalize">{capa.status}</span>
            </span>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <span className="text-xs text-white/60">Criada por</span>
              <p className="text-sm text-white/90 font-medium mt-1">{capa.criadoPor || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-white/60">Data de criação</span>
              <p className="text-sm text-white/90 font-medium mt-1">{formatDate(capa.criadoEm)}</p>
            </div>
            <div>
              <span className="text-xs text-white/60">Prioridade</span>
              <p className="text-sm text-white/90 font-medium mt-1">
                {'▁▂▃▄▅'[capa.prioridade - 1]} {capa.prioridade}/5
              </p>
            </div>
            <div>
              <span className="text-xs text-white/60">Prazo</span>
              <p className="text-sm text-white/90 font-medium mt-1">{formatDate(capa.dataPrazo)}</p>
            </div>
          </div>

          {/* Status error */}
          {statusError && (
            <div className="mt-4 px-3 py-2 bg-red-900/20 border border-red-700/50 rounded text-red-200 text-xs">
              {statusError}
            </div>
          )}
        </div>

        {/* Quality Tools Section */}
        <div className="p-6 bg-white/[0.02] border border-white/10 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Ferramentas da Qualidade</h2>
            <button
              type="button"
              onClick={() => setShowTools(!showTools)}
              className="text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/20 text-violet-300 rounded-lg transition-colors"
            >
              {showTools ? 'Fechar' : '+ Usar ferramenta'}
            </button>
          </div>
          {!showTools && usedTools.length === 0 && (
            <p className="text-xs text-white/40">
              Nenhuma ferramenta utilizada ainda. Use ferramentas como 5 Porquês, Ishikawa ou 5W2H
              para investigar e tratar esta NC.
            </p>
          )}
          {showTools && (
            <QualityToolsPanel
              labId={labId || ''}
              capaId={capa.id}
              capaTitle={capa.titulo}
              capaDescription={capa.descricao}
              usedTools={usedTools}
              onToolSaved={() => {
                setUsedTools([...usedTools]);
                setShowTools(false);
              }}
            />
          )}
        </div>

        {/* Actions Section */}
        {acoes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Ações Corretivas ({acoes.length})</h2>
            <div className="space-y-3">
              {acoes.map((acao) => (
                <ActionCard key={acao.id} action={acao} />
              ))}
            </div>
          </div>
        )}

        {/* No actions info */}
        {acoes.length === 0 && (
          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-lg text-center text-white/60">
            Nenhuma ação atribuída ainda
          </div>
        )}

        {/* Verification Form */}
        {canShowVerification && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Registrar Verificação</h2>
            <VerificationForm
              labId={labId || ''}
              capaId={capa.id}
              onSuccess={() => {
                setShowVerificationForm(false);
                // Trigger refetch in parent
              }}
              onCancel={() => setShowVerificationForm(false)}
            />
          </div>
        )}

        {/* Verification History */}
        {verificacoes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Verificações ({verificacoes.length})
            </h2>
            <div className="space-y-2">
              {verificacoes.map((v) => (
                <div key={v.id} className="p-3 bg-white/[0.02] border border-white/10 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white/70">
                      {formatDate(v.dataVerificacao)} por {v.verificadoPor}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        v.resultado === 'efetiva'
                          ? 'bg-emerald-900/20 text-emerald-200'
                          : v.resultado === 'nao-efetiva'
                            ? 'bg-red-900/20 text-red-200'
                            : 'bg-amber-900/20 text-amber-200'
                      }`}
                    >
                      {v.resultado}
                    </span>
                  </div>
                  <p className="text-sm text-white/80">{v.notas}</p>
                  {v.horasInvestidas && (
                    <p className="text-xs text-white/60 mt-2">
                      Horas investidas: {v.horasInvestidas}h
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
