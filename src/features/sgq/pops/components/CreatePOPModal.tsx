import { useState } from 'react';
import { useActiveLabId } from '../../../../store/useAuthStore';
import type { POPInput } from '../../types/POP';
import { createPOPClient } from '../popsService';

interface CreatePOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (popId: string) => void;
}

const MODULOS = [
  'hematologia',
  'coagulacao',
  'imunologia',
  'bioquimica',
  'uroanalise',
  'uroanalise-qf',
];

export default function CreatePOPModal({
  isOpen,
  onClose,
  onSuccess,
}: CreatePOPModalProps) {
  const labId = useActiveLabId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<POPInput>({
    nome: '',
    codigo: '',
    conteudo: {
      markdown: '',
      versaoDocumento: '1.0',
    },
    treinamentosObrigatorios: [],
    modulos: [],
  });

  const [selectedModulos, setSelectedModulos] = useState<string[]>([]);

  const handleToggleModulo = (modulo: string) => {
    setSelectedModulos((prev) =>
      prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) return;

    setError(null);
    setLoading(true);

    try {
      const popId = await createPOPClient(labId, {
        ...formData,
        modulos: selectedModulos,
      });
      onSuccess?.(popId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar POP');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1f] border border-white/10 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#1a1a1f]">
          <h2 className="text-lg font-semibold text-white">Novo POP</h2>
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
              {error}
            </div>
          )}

          {/* Código */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Código *</label>
            <input
              type="text"
              required
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              placeholder="Ex: POP-001"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Nome *</label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Coleta de Sangue Venoso"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          {/* Conteúdo */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Conteúdo (Markdown)
            </label>
            <textarea
              value={formData.conteudo.markdown || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  conteudo: { ...formData.conteudo, markdown: e.target.value },
                })
              }
              rows={6}
              placeholder="Descreva o procedimento..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 font-mono text-xs"
            />
          </div>

          {/* Módulos */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">Módulos</label>
            <div className="grid grid-cols-2 gap-2">
              {MODULOS.map((modulo) => (
                <label
                  key={modulo}
                  className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedModulos.includes(modulo)}
                    onChange={() => handleToggleModulo(modulo)}
                    className="w-4 h-4 rounded border-white/20 text-violet-600 focus:ring-offset-0"
                  />
                  <span className="text-sm text-white/80 capitalize">{modulo}</span>
                </label>
              ))}
            </div>
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
              disabled={loading || !formData.codigo || !formData.nome}
              className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Criando...' : 'Criar POP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
