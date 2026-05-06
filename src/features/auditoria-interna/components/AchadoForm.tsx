import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAchadoMutation } from '../hooks/useAuditorias';

interface AchadoFormProps {
  itemId: string;
  severity: string;
  onSave: () => void;
}

export function AchadoForm({ itemId, severity, onSave }: AchadoFormProps) {
  const labId = useActiveLabId();
  const { registerAchado, isLoading } = useAchadoMutation();
  const [descricao, setDescricao] = useState('');
  const [evidencias, setEvidencias] = useState<string[]>([]);

  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      setEvidencias((prev) => [...prev, data]);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!descricao.trim()) {
      alert('Descrição do achado é obrigatória');
      return;
    }

    if (!labId) {
      alert('Lab não ativo');
      return;
    }

    try {
      // TODO: Wire sessionId and auditoriaId from parent context
      await registerAchado({
        labId,
        auditoriaId: 'placeholder-auditoria-id',
        sessaoId: 'placeholder-sessao-id',
        checklistItemId: itemId,
        descricao,
        severidade: severity as any,
        evidencia: evidencias[0] || '',
        statusNC: 'pendente',
      });
      onSave();
    } catch (err) {
      console.error('Error saving achado:', err);
      alert('Erro ao salvar achado');
    }
  };

  return (
    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 space-y-3 mt-4">
      <h4 className="text-sm font-semibold text-red-400">Registrar Achado</h4>

      {/* Description textarea */}
      <textarea
        placeholder="Descreva o achado encontrado..."
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className="w-full h-24 bg-white/5 border border-white/10 rounded p-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
      />

      {/* Evidence upload */}
      <div className="space-y-2">
        <label className="block text-sm text-white/70">Evidência (foto/documento)</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          className="w-full text-sm text-white/60"
        />
        {evidencias.length > 0 && (
          <div className="space-y-2">
            {evidencias.map((ev, i) => (
              <div key={i} className="flex items-center space-x-2 p-2 bg-white/5 rounded">
                {ev.startsWith('data:image') && (
                  <img
                    src={ev}
                    alt={`Evidence ${i}`}
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                <span className="text-sm text-white/60 flex-1">Evidência {i + 1}</span>
                <button
                  type="button"
                  onClick={() => setEvidencias((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-400 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={isLoading || !descricao.trim()}
          className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition"
        >
          {isLoading ? '⏳ Salvando...' : 'Salvar achado'}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex-1 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white text-sm font-medium transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
