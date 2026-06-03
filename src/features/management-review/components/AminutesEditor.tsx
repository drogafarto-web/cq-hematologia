import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Ata } from '../types';

/**
 * AminutesEditor
 * Form for capturing meeting minutes (Ata)
 *
 * Can be:
 * - Linked to a specific ManagementReview
 * - Standalone (associated later)
 */

interface AminutesEditorProps {
  ata?: Ata | null;
  managementReviewId?: string;
  mode?: 'create' | 'edit' | 'view';
  onSave?: (ata: Omit<Ata, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => void;
  onCancel?: () => void;
}

interface AminutesFormState {
  dataReuniao: string; // ISO date string
  horaInicio: string; // "HH:MM"
  horaFim: string; // "HH:MM"
  local: string;
  pauta: string;
  conteudo: string;
  participantes: string[];
  decisoes: string[];
}

export default function AminutesEditor({
  ata = null,
  managementReviewId = '',
  mode = 'create',
  onSave,
  onCancel,
}: AminutesEditorProps) {
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const defaultHour = now.getHours().toString().padStart(2, '0');
  const defaultMin = now.getMinutes().toString().padStart(2, '0');

  const [formState, setFormState] = useState<AminutesFormState>({
    dataReuniao: ata?.dataReuniao?.toDate?.()?.toISOString().split('T')[0] || defaultDate,
    horaInicio: ata?.horaInicio || `${defaultHour}:00`,
    horaFim: ata?.horaFim || `${defaultHour}:30`,
    local: ata?.local || '',
    pauta: ata?.pauta || '',
    conteudo: ata?.conteudo || '',
    participantes: ata?.participantes || [],
    decisoes: ata?.decisoes || [],
  });

  const [participantInput, setParticipantInput] = useState('');
  const [decisionInput, setDecisionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddParticipant = () => {
    if (participantInput.trim()) {
      setFormState((prev) => ({
        ...prev,
        participantes: [...prev.participantes, participantInput.trim()],
      }));
      setParticipantInput('');
    }
  };

  const handleRemoveParticipant = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      participantes: prev.participantes.filter((_, i) => i !== index),
    }));
  };

  const handleAddDecision = () => {
    if (decisionInput.trim()) {
      setFormState((prev) => ({
        ...prev,
        decisoes: [...prev.decisoes, decisionInput.trim()],
      }));
      setDecisionInput('');
    }
  };

  const handleRemoveDecision = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      decisoes: prev.decisoes.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.dataReuniao) {
      setError('Data da reunião é obrigatória');
      return;
    }

    if (!formState.horaInicio || !formState.horaFim) {
      setError('Horários são obrigatórios');
      return;
    }

    if (!formState.local.trim()) {
      setError('Local é obrigatório');
      return;
    }

    if (formState.participantes.length === 0) {
      setError('Adicione pelo menos 1 participante');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const dataReuniao = new Date(formState.dataReuniao);
      const ataData = {
        labId: '', // Will be filled by service
        managementReviewId: managementReviewId || '',
        dataReuniao: Timestamp.fromDate(dataReuniao),
        horaInicio: formState.horaInicio,
        horaFim: formState.horaFim,
        local: formState.local,
        pauta: formState.pauta,
        conteudo: formState.conteudo,
        participantes: formState.participantes,
        decisoes: formState.decisoes,
        assinado: false,
      };

      onSave?.(ataData as any);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(`Erro ao salvar: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const isReadonly = mode === 'view';

  return (
    <form onSubmit={handleSubmit} className="bg-[#141417] rounded-lg border border-white/5 p-8">
      <h2 className="text-2xl font-semibold text-white mb-8">
        {mode === 'create' ? 'Nova Ata de Reunião' : 'Editar Ata de Reunião'}
      </h2>

      {/* Date/Time */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs uppercase text-white/60 font-semibold mb-2">Data</label>
          <input
            type="date"
            value={formState.dataReuniao}
            onChange={(e) => setFormState((prev) => ({ ...prev, dataReuniao: e.target.value }))}
            disabled={isReadonly}
            className="w-full px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs uppercase text-white/60 font-semibold mb-2">
            Hora Início
          </label>
          <input
            type="time"
            value={formState.horaInicio}
            onChange={(e) => setFormState((prev) => ({ ...prev, horaInicio: e.target.value }))}
            disabled={isReadonly}
            className="w-full px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs uppercase text-white/60 font-semibold mb-2">
            Hora Fim
          </label>
          <input
            type="time"
            value={formState.horaFim}
            onChange={(e) => setFormState((prev) => ({ ...prev, horaFim: e.target.value }))}
            disabled={isReadonly}
            className="w-full px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Local */}
      <div className="mb-6">
        <label className="block text-xs uppercase text-white/60 font-semibold mb-2">Local</label>
        <input
          type="text"
          value={formState.local}
          onChange={(e) => setFormState((prev) => ({ ...prev, local: e.target.value }))}
          placeholder="Ex: Sala de Reuniões"
          disabled={isReadonly}
          className="w-full px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50"
        />
      </div>

      {/* Pauta */}
      <div className="mb-6">
        <label className="block text-xs uppercase text-white/60 font-semibold mb-2">Pauta</label>
        <textarea
          value={formState.pauta}
          onChange={(e) => setFormState((prev) => ({ ...prev, pauta: e.target.value }))}
          placeholder="Pontos a discutir..."
          disabled={isReadonly}
          rows={3}
          className="w-full px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50 resize-none"
        />
      </div>

      {/* Conteúdo */}
      <div className="mb-6">
        <label className="block text-xs uppercase text-white/60 font-semibold mb-2">
          Conteúdo da Ata
        </label>
        <textarea
          value={formState.conteudo}
          onChange={(e) => setFormState((prev) => ({ ...prev, conteudo: e.target.value }))}
          placeholder="Discussões, discussões, observações..."
          disabled={isReadonly}
          rows={6}
          className="w-full px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50 resize-none"
        />
      </div>

      {/* Participants */}
      <div className="mb-6">
        <label className="block text-xs uppercase text-white/60 font-semibold mb-2">
          Participantes
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={participantInput}
            onChange={(e) => setParticipantInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddParticipant())}
            placeholder="Nome do participante"
            disabled={isReadonly}
            className="flex-1 px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
          {!isReadonly && (
            <button
              type="button"
              onClick={handleAddParticipant}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-medium transition-colors"
            >
              Adicionar
            </button>
          )}
        </div>

        <div className="space-y-1">
          {formState.participantes.map((participant, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white"
            >
              <span>{participant}</span>
              {!isReadonly && (
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(idx)}
                  className="text-red-400 hover:text-red-500 font-semibold"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decisions */}
      <div className="mb-6">
        <label className="block text-xs uppercase text-white/60 font-semibold mb-2">
          Decisões Tomadas
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={decisionInput}
            onChange={(e) => setDecisionInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDecision())}
            placeholder="Decisão"
            disabled={isReadonly}
            className="flex-1 px-3 py-2 bg-[#0f0f12] border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
          {!isReadonly && (
            <button
              type="button"
              onClick={handleAddDecision}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-medium transition-colors"
            >
              Adicionar
            </button>
          )}
        </div>

        <div className="space-y-1">
          {formState.decisoes.map((decision, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white"
            >
              <span className="flex-1">{decision}</span>
              {!isReadonly && (
                <button
                  type="button"
                  onClick={() => handleRemoveDecision(idx)}
                  className="text-red-400 hover:text-red-500 font-semibold ml-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      {!isReadonly && (
        <div className="flex gap-4 pt-6 border-t border-white/10">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar Ata'}
          </button>
        </div>
      )}
    </form>
  );
}
