import { useState } from 'react';
import type { NaoConformidade, CAPAStatus } from '../../types/NaoConformidade';
import { CAPA_STATUS_LABEL, getProximoStatusCAPAValido } from '../../types/NaoConformidade';
import {
  callInvestigarNC,
  callExecutarAcaoCorretiva,
  callVerificarEficacia,
} from '../services/capaCallables';
import { useActiveLabId } from '../../../../store/useAuthStore';

interface CAPAWorkflowProps {
  nc: NaoConformidade;
  onUpdate?: () => void;
}

const WORKFLOW_ORDER: CAPAStatus[] = [
  'nao_iniciada',
  'investigacao',
  'acao',
  'eficacia',
  'fechada',
];

export default function CAPAWorkflow({ nc, onUpdate }: CAPAWorkflowProps) {
  const labId = useActiveLabId();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    descricao: '',
    achados: '',
    dataPrevista: undefined as Date | undefined,
    resultado: undefined as 'eficaz' | 'ineficaz' | 'nao_concluida' | undefined,
    evidencia: '',
  });

  const nextStatuses = getProximoStatusCAPAValido(nc.capaStatus);
  const currentIndex = WORKFLOW_ORDER.indexOf(nc.capaStatus);

  const handleStatusChange = async (novoStatus: CAPAStatus) => {
    if (!labId) return;

    setLoading(true);
    try {
      // Route to appropriate callable based on target status
      if (novoStatus === 'investigacao') {
        await callInvestigarNC({
          labId,
          ncId: nc.id,
          descricao: formData.descricao,
          achados: formData.achados || undefined,
        });
      } else if (novoStatus === 'acao') {
        if (!formData.dataPrevista) {
          throw new Error('Data prevista é obrigatória.');
        }
        await callExecutarAcaoCorretiva({
          labId,
          ncId: nc.id,
          descricao: formData.descricao,
          dataPrevista: formData.dataPrevista.getTime(),
        });
      } else if (novoStatus === 'eficacia' || novoStatus === 'fechada') {
        if (!formData.resultado) {
          throw new Error('Resultado da verificação é obrigatório.');
        }
        await callVerificarEficacia({
          labId,
          ncId: nc.id,
          resultado: formData.resultado,
          evidencia: formData.evidencia || undefined,
        });
      }

      onUpdate?.();
      setShowForm(false);
      setFormData({
        descricao: '',
        achados: '',
        dataPrevista: undefined,
        resultado: undefined,
        evidencia: '',
      });
    } catch (err) {
      console.error('Erro ao atualizar CAPA:', err);
      alert(
        err instanceof Error
          ? err.message
          : 'Erro ao processar ação. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="relative">
        <div className="space-y-4">
          {WORKFLOW_ORDER.map((status, idx) => {
            const isActive = idx === currentIndex;
            const isCompleted = idx < currentIndex;
            const isNext = idx === currentIndex + 1;

            return (
              <div key={status} className="flex items-start gap-4">
                {/* Indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isActive
                          ? 'bg-violet-600 text-white ring-4 ring-violet-600/30'
                          : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {isCompleted ? (
                      <span>✓</span>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  {idx < WORKFLOW_ORDER.length - 1 && (
                    <div
                      className={`w-1 h-8 mt-2 ${isCompleted || isActive ? 'bg-emerald-600' : 'bg-white/10'}`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-2">
                  <h4 className={`font-medium ${isActive ? 'text-violet-300' : 'text-white/60'}`}>
                    {CAPA_STATUS_LABEL[status]}
                  </h4>

                  {/* Event timestamp if available */}
                  {nc.capaHistorico
                    .filter((e) => e.status === status)
                    .slice(0, 1)
                    .map((event) => (
                      <div key={event.timestamp.toString()} className="text-xs text-white/40 mt-1">
                        {event.timestamp.toDate().toLocaleDateString('pt-BR')} por{' '}
                        {event.realizadoPorName}
                      </div>
                    ))}

                  {/* Action button for next status */}
                  {isActive && nextStatuses.length > 0 && (
                    <button
                      onClick={() => setShowForm(!showForm)}
                      className="mt-3 px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded transition-colors"
                    >
                      Avançar
                    </button>
                  )}

                  {/* Form */}
                  {isActive && showForm && nextStatuses.length > 0 && (
                    <div className="mt-4 p-3 bg-black/20 rounded-lg space-y-3">
                      <textarea
                        value={formData.descricao}
                        onChange={(e) =>
                          setFormData({ ...formData, descricao: e.target.value })
                        }
                        placeholder="Descreva a ação..."
                        rows={3}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
                      />

                      {/* Additional fields based on next status */}
                      {nextStatuses.includes('investigacao') && (
                        <textarea
                          value={formData.achados}
                          onChange={(e) =>
                            setFormData({ ...formData, achados: e.target.value })
                          }
                          placeholder="Achados da investigação (opcional)"
                          rows={2}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
                        />
                      )}

                      {nextStatuses.some((s) => s === 'acao') && (
                        <input
                          type="date"
                          value={
                            formData.dataPrevista
                              ? formData.dataPrevista.toISOString().split('T')[0]
                              : ''
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              dataPrevista: e.target.value
                                ? new Date(e.target.value)
                                : undefined,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-violet-500/50"
                          required
                        />
                      )}

                      {nextStatuses.some((s) => s === 'eficacia' || s === 'fechada') && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs text-white/70">
                              Resultado da verificação
                            </label>
                            <div className="flex gap-3">
                              {(
                                ['eficaz', 'ineficaz', 'nao_concluida'] as const
                              ).map((res) => (
                                <label
                                  key={res}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <input
                                    type="radio"
                                    name="resultado"
                                    value={res}
                                    checked={formData.resultado === res}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        resultado: e.target
                                          .value as typeof formData.resultado,
                                      })
                                    }
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xs text-white/70">
                                    {res === 'eficaz'
                                      ? 'Eficaz'
                                      : res === 'ineficaz'
                                        ? 'Ineficaz'
                                        : 'Não concluída'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <textarea
                            value={formData.evidencia}
                            onChange={(e) =>
                              setFormData({ ...formData, evidencia: e.target.value })
                            }
                            placeholder="Evidência de eficácia (opcional)"
                            rows={2}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
                          />
                        </>
                      )}

                      <div className="flex gap-2">
                        {nextStatuses.map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            disabled={loading}
                            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
                          >
                            {loading ? 'Salvando...' : CAPA_STATUS_LABEL[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      {nc.capaHistorico.length > 0 && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-3">Histórico</h4>
          <div className="space-y-2 text-xs">
            {nc.capaHistorico.map((event, idx) => (
              <div key={idx} className="flex items-start justify-between p-2 bg-black/20 rounded">
                <div>
                  <p className="text-white/80">{CAPA_STATUS_LABEL[event.status]}</p>
                  {event.descricao && (
                    <p className="text-white/50 mt-1">{event.descricao}</p>
                  )}
                </div>
                <span className="text-white/40 whitespace-nowrap ml-2">
                  {event.timestamp.toDate().toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
