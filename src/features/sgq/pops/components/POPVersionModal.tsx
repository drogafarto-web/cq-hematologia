import { useState } from 'react';
import { useCreatePOPVersion } from '../usePOPs';
import type { POP } from '../../types/POP';

interface POPVersionModalProps {
  isOpen: boolean;
  pop: POP;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function POPVersionModal({ isOpen, pop, onClose, onSuccess }: POPVersionModalProps) {
  const { execute, loading, error } = useCreatePOPVersion();
  const [markdown, setMarkdown] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [isMajor, setIsMajor] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markdown && !pdfUrl) {
      alert('Forneça conteúdo (Markdown ou PDF URL)');
      return;
    }

    try {
      await execute(
        pop.id,
        {
          markdown: markdown || undefined,
          pdfUrl: pdfUrl || undefined,
        },
        isMajor,
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Erro ao criar versão:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1f] border border-white/10 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#1a1a1f]">
          <div>
            <h2 className="text-lg font-semibold text-white">Nova Versão</h2>
            <p className="text-xs text-white/50 mt-1">
              {pop.codigo} — {pop.nome}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors text-white/60 font-bold text-xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-300">
              {error.message}
            </div>
          )}

          {/* Version type */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              Tipo de Atualização
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-3 rounded border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={!isMajor}
                  onChange={() => setIsMajor(false)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Versão Menor (v1.0 → v1.1)</div>
                  <div className="text-xs text-white/50">Bug fixes e clarificações</div>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 rounded border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={isMajor}
                  onChange={() => setIsMajor(true)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Versão Maior (v1.0 → v2.0)</div>
                  <div className="text-xs text-white/50">
                    Mudanças significativas; requer novo treinamento
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Markdown content */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Conteúdo (Markdown)
            </label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={6}
              placeholder="Descreva as mudanças e o procedimento..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 font-mono text-xs"
            />
          </div>

          {/* PDF URL */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              URL do PDF (opcional)
            </label>
            <input
              type="url"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-white/20 text-white/80 rounded-lg hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (!markdown && !pdfUrl)}
              className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Criando versão...' : 'Criar Versão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
