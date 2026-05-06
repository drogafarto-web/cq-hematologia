import React, { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useSessao } from '../hooks/useAuditorias';
import { ChecklistItemCard } from './ChecklistItemCard';

interface SessaoExecucaoPanelProps {
  auditoriaId: string;
  sessaoId: string;
  onBack: () => void;
}

interface ChecklistResponse {
  resposta: string;
  severidade?: string;
  timestamp: number;
}

export function SessaoExecucaoPanel({ auditoriaId, sessaoId, onBack }: SessaoExecucaoPanelProps) {
  const labId = useActiveLabId();
  const { sessao, checklistItems, isLoading } = useSessao(auditoriaId, sessaoId);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [draftResponses, setDraftResponses] = useState<Record<string, ChecklistResponse>>({});

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(`sessao-${sessaoId}-draft`);
    if (draft) {
      try {
        setDraftResponses(JSON.parse(draft));
      } catch (e) {
        console.error('Failed to parse draft:', e);
      }
    }
  }, [sessaoId]);

  // Persist draft responses
  useEffect(() => {
    localStorage.setItem(`sessao-${sessaoId}-draft`, JSON.stringify(draftResponses));
  }, [draftResponses, sessaoId]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleItemResponse = (itemId: string, resposta: string, severidade?: string) => {
    setDraftResponses((prev) => ({
      ...prev,
      [itemId]: { resposta, severidade, timestamp: Date.now() },
    }));
  };

  const handleSaveDraft = () => {
    // Already persisted to localStorage in useEffect
    alert('Rascunho salvo');
  };

  const handleComplete = async () => {
    if (!labId) {
      alert('Lab não ativo');
      return;
    }
    // TODO: Call Cloud Function callable to save all responses
    console.log('Complete session:', draftResponses);
    alert('Sessão finalizada (implementar callable)');
    onBack();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-pulse w-12 h-12 bg-white/10 rounded-lg mx-auto" />
          <p>Carregando sessão...</p>
        </div>
      </div>
    );
  }

  const completedCount = Object.keys(draftResponses).length;
  const totalCount = checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#141417] text-white/90 flex flex-col">
      {/* Header — sticky */}
      <div className="sticky top-0 z-10 bg-[#141417] border-b border-white/10 p-4 space-y-3">
        <div className="flex justify-between items-start">
          <button
            onClick={onBack}
            className="text-violet-500 hover:text-violet-400 font-medium transition"
          >
            ← Voltar
          </button>
          {!isOnline && <span className="text-amber-500 text-sm">⚠️ Modo offline</span>}
        </div>

        {/* Session title */}
        <h2 className="text-xl font-semibold">
          {sessao?.dataInicio
            ? new Date(sessao.dataInicio.toDate()).toLocaleDateString('pt-BR')
            : 'Sessão'}
        </h2>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Progresso</span>
            <span>
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {checklistItems.map((item) => (
          <ChecklistItemCard
            key={item.id}
            item={item}
            response={draftResponses[item.id]}
            onChange={handleItemResponse}
          />
        ))}
      </div>

      {/* Footer — action buttons */}
      <div className="sticky bottom-0 border-t border-white/10 bg-[#141417] p-4 space-y-3">
        <button
          onClick={handleSaveDraft}
          className="w-full h-12 px-4 rounded-lg border border-white/10 hover:bg-white/5 text-white font-medium transition"
        >
          💾 Salvar rascunho
        </button>
        <button
          onClick={handleComplete}
          className="w-full h-12 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
        >
          ✓ Finalizar sessão
        </button>
      </div>
    </div>
  );
}
