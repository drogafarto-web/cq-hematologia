import { useState } from 'react';
import { ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import type { NaoConformidade, CAPAStatus } from '../../types/NaoConformidade';
import { CAPA_STATUS_LABEL, getProximoStatusCAPAValido } from '../../types/NaoConformidade';
import { updateCAPAStatus } from '../ncService';
import { useActiveLabId } from '@/store/useAuthStore';

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
  const [formData, setFormData] = useState({ descricao: '' });

  const nextStatuses = getProximoStatusCAPAValido(nc.capaStatus);
  const currentIndex = WORKFLOW_ORDER.indexOf(nc.capaStatus);

  const handleStatusChange = async (novoStatus: CAPAStatus) => {
    if (!labId) return;

    setLoading(true);
    try {
      await updateCAPAStatus(labId, nc.id, novoStatus, formData.descricao);
      onUpdate?.();
      setShowForm(false);
      setFormData({ descricao: '' });
    } catch (err) {
      console.error('Erro ao atualizar CAPA:', err);
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
                      <CheckCircle2 className="h-5 w-5" />
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
                        onChange={(e) => setFormData({ descricao: e.target.value })}
                        placeholder="Descreva a ação..."
                        rows={3}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
                      />
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
