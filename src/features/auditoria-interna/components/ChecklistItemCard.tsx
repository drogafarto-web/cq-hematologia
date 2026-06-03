import React, { useState } from 'react';
import {
  FileSearch,
  Camera,
  Mic,
  Paperclip,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ChecklistItem } from '../types';
import { AchadoForm } from './AchadoForm';
import { EvidencePanel } from './EvidencePanel';
import { ConformityScale } from './ConformityScale';
import { useAISuggestions } from '../hooks/useAISuggestions';

interface ChecklistResponse {
  resposta: string;
  severidade?: string;
  nivelConformidade?: number;
  observacoes?: string;
  timestamp: number;
}

interface ChecklistItemCardProps {
  item: ChecklistItem;
  response?: ChecklistResponse;
  onChange: (itemId: string, resposta: string, severidade?: string, observacoes?: string) => void;
  onConformityChange?: (itemId: string, nivel: number) => void;
  labId?: string;
  auditoriaId?: string;
  sessaoId?: string;
  templateType?: string;
  fr044Niveis?: Record<string, string>;
  indicadorId?: string;
}

export function ChecklistItemCard({
  item,
  response,
  onChange,
  onConformityChange,
  labId,
  auditoriaId,
  sessaoId,
  templateType,
  fr044Niveis,
  indicadorId,
}: ChecklistItemCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const {
    suggestion,
    loading: aiLoading,
    refresh: refreshAI,
  } = useAISuggestions(item.id, labId || '');

  const isFR044 = templateType === 'FR-044';
  const hasResponse = !!response?.resposta;

  const handleResposta = (resposta: string) => {
    onChange(item.id, resposta, response?.severidade, response?.observacoes);
    if (resposta === 'não-conforme' || resposta === 'N/A') {
      setShowDetails(true);
    }
  };

  const handleObservacoes = (text: string) => {
    onChange(item.id, response?.resposta || '', response?.severidade, text);
  };

  const handleAIApply = () => {
    if (suggestion) {
      handleObservacoes(suggestion.justificativa);
      if (suggestion.nivelSugerido && onConformityChange) {
        onConformityChange(item.id, suggestion.nivelSugerido);
      }
    }
  };

  return (
    <div
      className={`
      relative group border rounded-[28px] overflow-hidden transition-all duration-500
      ${hasResponse ? 'bg-[#1a1a20] border-white/10' : 'bg-white/5 border-white/5 hover:border-white/20'}
      ${response?.resposta === 'não-conforme' ? 'ring-1 ring-red-500/30' : ''}
    `}
    >
      {/* Visual Status Indicator */}
      {hasResponse && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            response.resposta === 'conforme'
              ? 'bg-emerald-500'
              : response.resposta === 'não-conforme'
                ? 'bg-red-500'
                : 'bg-white/20'
          }`}
        />
      )}

      <div className="p-6 sm:p-8 space-y-6">
        {/* Header: ID + Evidence Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-violet-600/20 text-violet-400 text-[10px] font-black tracking-widest uppercase">
              {item.numeroDICQ}
            </span>
            {item.categoria && (
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                {item.categoria}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEvidencePanel(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-violet-400 transition-all border border-white/5"
              title="Consultar Documentação SGD/Outros"
            >
              <FileSearch className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 transition-all border border-white/5"
            >
              {showDetails ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Question Text */}
        <h3 className="text-lg sm:text-xl font-bold leading-tight text-white/90">
          {item.descricao}
        </h3>

        {/* Main Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResponseButton
            active={response?.resposta === 'conforme'}
            onClick={() => handleResposta('conforme')}
            variant="success"
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Conforme"
          />
          <ResponseButton
            active={response?.resposta === 'não-conforme'}
            onClick={() => handleResposta('não-conforme')}
            variant="danger"
            icon={<XCircle className="w-5 h-5" />}
            label="Não Conforme"
          />
          <ResponseButton
            active={response?.resposta === 'N/A'}
            onClick={() => handleResposta('N/A')}
            variant="ghost"
            icon={<HelpCircle className="w-5 h-5" />}
            label="N/A"
          />
        </div>

        {/* Expanded Details Section */}
        {showDetails && (
          <div className="pt-6 border-t border-white/10 space-y-6 animate-in slide-in-from-top-2 duration-300">
            {/* Multimedia Capture Tools */}
            <div className="space-y-3">
              <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-black">
                Evidências de Campo
              </p>
              <div className="flex flex-wrap gap-3">
                <ToolButton icon={<Camera className="w-5 h-5" />} label="Foto" />
                <ToolButton
                  icon={
                    <Mic className={`w-5 h-5 ${isRecording ? 'text-red-500 animate-pulse' : ''}`} />
                  }
                  label={isRecording ? 'Gravando...' : 'Voz'}
                  onClick={() => setIsRecording(!isRecording)}
                />
                <ToolButton icon={<Paperclip className="w-5 h-5" />} label="Anexo" />

                <button
                  onClick={refreshAI}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-bold hover:bg-violet-600/30 transition-all"
                >
                  <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                  Assistente IA
                </button>
              </div>
            </div>

            {/* AI Suggestions Box */}
            {suggestion && (
              <div className="p-5 rounded-3xl bg-gradient-to-br from-violet-600/10 to-fuchsia-600/10 border border-violet-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-violet-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">
                      Sugestão da Inteligência Artificial
                    </span>
                  </div>
                  <button
                    onClick={handleAIApply}
                    className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition"
                  >
                    Aplicar Análise
                  </button>
                </div>
                <p className="text-sm text-white/70 italic leading-relaxed">
                  "{suggestion.justificativa}"
                </p>
                {suggestion.gaps && suggestion.gaps.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {suggestion.gaps.map((nc, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold"
                      >
                        {nc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Observations / Findings */}
            <div className="space-y-3">
              <label className="text-xs text-white/30 uppercase tracking-[0.2em] font-black">
                Achados e Observações
              </label>
              <textarea
                value={response?.observacoes || ''}
                onChange={(e) => handleObservacoes(e.target.value)}
                placeholder="Descreva as evidências observadas ou os detalhes da não-conformidade..."
                className="w-full h-32 bg-black/20 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all resize-none"
              />
            </div>

            {/* FR-044 Conformity Scale */}
            {isFR044 && fr044Niveis && (
              <div className="space-y-4">
                <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-black">
                  Régua de Maturidade (FR-044)
                </p>
                <ConformityScale
                  niveis={fr044Niveis}
                  value={response?.nivelConformidade ?? null}
                  onChange={(level) => onConformityChange?.(item.id, level)}
                />
              </div>
            )}

            {/* Severity for Non-Conformity */}
            {response?.resposta === 'não-conforme' && (
              <div className="space-y-3">
                <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-black">
                  Gravidade do Achado
                </p>
                <div className="flex flex-wrap gap-2">
                  {['crítica', 'grave', 'moderada', 'leve', 'observação'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => onChange(item.id, 'não-conforme', sev, response.observacoes)}
                      className={`
                        px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all border
                        ${
                          response.severidade === sev
                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20'
                            : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                        }
                      `}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evidence Panel Portal */}
      {labId && indicadorId && (
        <EvidencePanel
          indicadorId={indicadorId}
          labId={labId}
          isOpen={showEvidencePanel}
          onClose={() => setShowEvidencePanel(false)}
        />
      )}
    </div>
  );
}

function ResponseButton({ active, onClick, variant, icon, label }: any) {
  const styles = {
    success: active
      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
      : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10',
    danger: active
      ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20'
      : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10',
    ghost: active
      ? 'bg-white/20 border-white/30 text-white shadow-lg'
      : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-3 py-4 rounded-2xl border font-bold text-sm transition-all duration-300
        ${styles[variant as keyof typeof styles]}
        ${active ? 'scale-105 z-10' : 'scale-100'}
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function ToolButton({ icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/5 text-white/60 text-sm font-bold hover:bg-white/10 hover:text-white transition-all"
    >
      {icon}
      {label}
    </button>
  );
}
