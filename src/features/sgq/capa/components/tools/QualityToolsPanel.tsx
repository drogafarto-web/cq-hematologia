/**
 * QualityToolsPanel — Painel principal de ferramentas da qualidade
 *
 * Orquestra: picker com resumo educativo → formulário da ferramenta selecionada
 * + assistente IA (Gemini) para ajudar o operador no preenchimento.
 *
 * Integrado ao detalhe da CAPA. Operador escolhe qual ferramenta usar.
 * Pode usar múltiplas ferramentas na mesma CAPA.
 */

import React, { useState, useCallback } from 'react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../../shared/services/firebase';
import { useUser } from '../../../../../store/useAuthStore';
import { QualityToolPicker } from './QualityToolPicker';
import { QualityToolAIAssistant } from './QualityToolAIAssistant';
import { CincosPorquesForm } from './CincosPorquesForm';
import { IshikawaForm } from './IshikawaForm';
import { FiveW2HForm } from './FiveW2HForm';
import { PDCAForm } from './PDCAForm';
import { GUTForm } from './GUTForm';
import { ParetoForm } from './ParetoForm';
import { EightDForm } from './EightDForm';
import { BrainstormingForm } from './BrainstormingForm';
import type { QualityToolType, QualityToolData } from '../../types/qualityTools';

interface QualityToolsPanelProps {
  labId: string;
  capaId: string;
  capaTitle: string;
  capaDescription: string;
  usedTools?: QualityToolType[];
  onToolSaved?: () => void;
}

export function QualityToolsPanel({
  labId,
  capaId,
  capaTitle,
  capaDescription,
  usedTools = [],
  onToolSaved,
}: QualityToolsPanelProps) {
  const user = useUser();
  const [selectedTool, setSelectedTool] = useState<QualityToolType | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const handleSave = useCallback(
    async (data: QualityToolData) => {
      if (!user) return;
      setSaving(true);
      try {
        const colRef = collection(db, `labs/${labId}/capa/${capaId}/ferramentas`);
        const docRef = doc(colRef);
        await setDoc(docRef, {
          id: docRef.id,
          labId,
          capaId,
          toolType: data.tipo,
          data,
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          status: 'concluido',
        });
        setSelectedTool(null);
        onToolSaved?.();
      } catch (err: any) {
        console.error('Erro ao salvar ferramenta:', err);
      } finally {
        setSaving(false);
      }
    },
    [labId, capaId, user, onToolSaved],
  );

  const handleCancel = () => setSelectedTool(null);

  if (selectedTool) {
    return (
      <div className="space-y-4">
        {/* AI Assistant toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedTool(null)}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            ← Voltar às ferramentas
          </button>
          <button
            type="button"
            onClick={() => setShowAI(!showAI)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              showAI
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
            }`}
          >
            {showAI ? '✦ IA ativa' : '✦ Pedir ajuda à IA'}
          </button>
        </div>

        {/* AI Panel */}
        {showAI && (
          <QualityToolAIAssistant
            toolType={selectedTool}
            capaTitle={capaTitle}
            capaDescription={capaDescription}
          />
        )}

        {/* Tool Form */}
        {selectedTool === 'cinco-porques' && (
          <CincosPorquesForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
        {selectedTool === 'ishikawa' && (
          <IshikawaForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
        {selectedTool === '5w2h' && (
          <FiveW2HForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
        {selectedTool === 'pdca' && (
          <PDCAForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
        {selectedTool === 'gut' && (
          <GUTForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
        {selectedTool === 'pareto' && (
          <ParetoForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
        {selectedTool === '8d' && (
          <EightDForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
        {selectedTool === 'brainstorming' && (
          <BrainstormingForm onSave={handleSave} onCancel={handleCancel} saving={saving} />
        )}
      </div>
    );
  }

  return <QualityToolPicker onSelect={setSelectedTool} usedTools={usedTools} />;
}
