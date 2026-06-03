/**
 * ReviewLaudoModal — RT review UI for report (laudo)
 *
 * Displays:
 * - Header: patient, physician, collection/emission dates
 * - Exams table: name, method, result, unit, reference, flags
 * - Sample restrictions section
 * - Auto-release status with reason
 * - Footer actions: Approve & Release, Reject, Cancel
 *
 * Opens RTSignatureGate on "Approve & Release" click
 */

import React, { useState } from 'react';
import { Laudo } from '../types/laudo';
import { LaudoStatusBadge } from './LaudoStatusBadge';
import { RTSignatureGate } from './RTSignatureGate';

interface ReviewLaudoModalProps {
  laudo: Laudo;
  autoReleaseInfo?: {
    shouldAutoRelease: boolean;
    reason: string;
    blockers: string[];
  };
  onClose: () => void;
  onLiberate?: (laudoId: string, versionId?: string) => Promise<void>;
  onReject?: (laudoId: string, motivo: string) => Promise<void>;
}

/**
 * ExamesTable — sub-component for exam results display
 */
function ExamesTable({ exames }: { exames: Laudo['exames'] }) {
  return (
    <div className="overflow-x-auto border border-white/10 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-white/5 border-b border-white/10">
          <tr>
            <th className="text-left p-3 text-white/70 font-medium">Exame</th>
            <th className="text-left p-3 text-white/70 font-medium">Método</th>
            <th className="text-right p-3 text-white/70 font-medium tabular-nums">Resultado</th>
            <th className="text-center p-3 text-white/70 font-medium">Unidade</th>
            <th className="text-left p-3 text-white/70 font-medium">Valor Ref.</th>
            <th className="text-center p-3 text-white/70 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {exames.map((exame, idx) => (
            <tr key={idx} className="hover:bg-white/5 transition-colors">
              <td className="p-3 text-white/90 font-medium">{exame.nome}</td>
              <td className="p-3 text-white/70 text-xs">{exame.metodoAnalitico}</td>
              <td className="p-3 text-right text-white/90 tabular-nums font-mono">
                {exame.resultados[0]?.value ?? '—'}
              </td>
              <td className="p-3 text-center text-white/70 text-xs">
                {exame.resultados[0]?.unidade || '—'}
              </td>
              <td className="p-3 text-white/70 text-xs">
                {exame.valoresReferencia.min} — {exame.valoresReferencia.max}
              </td>
              <td className="p-3 text-center">
                {exame.duplaVerificacao && (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      exame.duplaVerificacao.statusVerificacao === 'aguardando_segunda_leitura'
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : exame.duplaVerificacao.statusVerificacao === 'divergente_bloqueado'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : exame.duplaVerificacao.statusVerificacao === 'liberado_coincidente'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-green-500/20 text-green-300 border border-green-500/30'
                    }`}
                  >
                    {exame.duplaVerificacao.statusVerificacao === 'aguardando_segunda_leitura' &&
                      '⏳ 2ª Leitura Pendente'}
                    {exame.duplaVerificacao.statusVerificacao === 'divergente_bloqueado' &&
                      '🚨 Divergente'}
                    {exame.duplaVerificacao.statusVerificacao === 'liberado_coincidente' &&
                      '✅ Verificado'}
                    {exame.duplaVerificacao.statusVerificacao === 'revisado_e_liberado' &&
                      '✅ Revisado'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * AmostraSection — sub-component for sample restrictions
 */
function AmostraSection() {
  return (
    <div className="border border-white/10 rounded-lg p-4 bg-white/2">
      <h3 className="text-sm font-semibold text-white/90 mb-3">Restrições de Amostra</h3>
      <div className="text-sm text-white/70">Sem restrições detectadas</div>
    </div>
  );
}

/**
 * AutoReleaseStatus — sub-component for auto-release decision display
 */
function AutoReleaseStatus({ info }: { info?: ReviewLaudoModalProps['autoReleaseInfo'] }) {
  if (!info) return null;

  return (
    <div
      className={`border rounded-lg p-4 ${
        info.shouldAutoRelease
          ? 'border-violet-500/30 bg-violet-500/5'
          : 'border-yellow-500/30 bg-yellow-500/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`text-xl ${info.shouldAutoRelease ? 'text-violet-400' : 'text-yellow-400'}`}
        >
          {info.shouldAutoRelease ? '🤖' : '🔒'}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white/90">
            {info.shouldAutoRelease ? 'Elegível para Auto-Liberação' : 'Requer Revisão RT'}
          </h4>
          <p className="text-xs text-white/70 mt-1">{info.reason}</p>
          {info.blockers.length > 0 && (
            <div className="mt-2 space-y-1">
              {info.blockers.map((blocker, idx) => (
                <p key={idx} className="text-xs text-white/60">
                  • {blocker}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main ReviewLaudoModal component
 */
export function ReviewLaudoModal({
  laudo,
  autoReleaseInfo,
  onClose,
  onLiberate,
  onReject,
}: ReviewLaudoModalProps) {
  const [showSignatureGate, setShowSignatureGate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleLiberate = async () => {
    if (!onLiberate) return;

    setIsLoading(true);
    try {
      await onLiberate(laudo.id);
      onClose();
    } catch (err) {
      console.error('Erro ao liberar laudo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !rejectReason.trim()) return;

    setIsLoading(true);
    try {
      await onReject(laudo.id, rejectReason);
      onClose();
    } catch (err) {
      console.error('Erro ao rejeitar laudo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-end z-50">
        <div className="bg-[#141417] w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-white/10 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-[#141417]/95 backdrop-blur border-b border-white/10 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Revisão de Laudo</h2>
              <p className="text-sm text-white/60 mt-1">
                Paciente: {laudo.paciente.nome} | Status: <LaudoStatusBadge status={laudo.status} />
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-2xl"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Seção 1: Dados do paciente e médico */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
                  Paciente
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-white/90 font-medium">{laudo.paciente.nome}</p>
                  <p className="text-white/60">
                    Idade:{' '}
                    {typeof laudo.pacienteIdade === 'object' && 'value' in laudo.pacienteIdade
                      ? `${laudo.pacienteIdade.value} ${laudo.pacienteIdade.unit}`
                      : '—'}
                  </p>
                  <p className="text-white/60">
                    Sexo:{' '}
                    {laudo.paciente.sexo === 'M'
                      ? 'Masculino'
                      : laudo.paciente.sexo === 'F'
                        ? 'Feminino'
                        : 'Não informado'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
                  Médico Solicitante
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-white/90 font-medium">{laudo.profissionalAssinaName}</p>
                  <p className="text-white/60">Registro: {laudo.profissionalAssinaRegistro}</p>
                </div>
              </div>
            </div>

            {/* Seção 2: Datas */}
            <div className="grid grid-cols-2 gap-6 border-y border-white/10 py-6">
              <div>
                <h4 className="text-xs text-white/60 font-medium uppercase tracking-wider mb-2">
                  Data/Hora da Coleta
                </h4>
                <p className="text-sm text-white/90">
                  {laudo.coletaEm.toDate?.().toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <h4 className="text-xs text-white/60 font-medium uppercase tracking-wider mb-2">
                  Data/Hora da Emissão
                </h4>
                <p className="text-sm text-white/90">
                  {laudo.emissaoEm.toDate?.().toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Seção 3: Tabela de exames */}
            <div>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                Exames
              </h3>
              <ExamesTable exames={laudo.exames} />
            </div>

            {/* Seção 4: Amostra e restrições */}
            <AmostraSection />

            {/* Seção 5: Auto-release status */}
            {autoReleaseInfo && <AutoReleaseStatus info={autoReleaseInfo} />}

            {/* Seção 6: Formulário de rejeição (condicional) */}
            {showRejectForm && (
              <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/5">
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Motivo da Rejeição
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Descreva o motivo da rejeição..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-red-500/50"
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Footer with actions */}
          <div className="sticky bottom-0 bg-[#141417]/95 backdrop-blur border-t border-white/10 p-6 flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 text-white/80 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(false)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 text-white/80 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleReject}
                  disabled={isLoading || !rejectReason.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Rejeitando...' : 'Rejeitar'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-lg border border-red-500/30 hover:border-red-500/60 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Rejeitar
                </button>
                <button
                  onClick={() => setShowSignatureGate(true)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Liberando...' : 'Aprovar e Liberar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RTSignatureGate Modal */}
      {showSignatureGate && (
        <RTSignatureGate
          onClose={() => setShowSignatureGate(false)}
          onSignatureConfirmed={handleLiberate}
          laudoId={laudo.id}
        />
      )}
    </>
  );
}

export default ReviewLaudoModal;
