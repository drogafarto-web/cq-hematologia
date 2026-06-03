import { useState } from 'react';
import type { Auditoria, Achado, SeveridadeAchado } from '../../types/Auditoria';

interface FindingsFormProps {
  auditoria: Auditoria;
  onAddFinding?: (achado: Achado) => void;
  onCreateNCs?: (achadosIds: string[]) => void;
}

const SEVERIDADES: SeveridadeAchado[] = ['critica', 'grave', 'moderada', 'leve', 'observacao'];

export default function FindingsForm({ auditoria, onAddFinding, onCreateNCs }: FindingsFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [showNCDialog, setShowNCDialog] = useState(false);
  const [pendingAchados, setPendingAchados] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    descricao: '',
    severidade: 'grave' as SeveridadeAchado,
    criterio: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const novoAchado: Achado = {
      id: `achado-${Date.now()}`,
      ...formData,
      registradoEm: { toDate: () => new Date() } as any,
      registradoPor: 'usuario',
    };

    onAddFinding?.(novoAchado);

    // Check if achado is grave or critica
    if (['critica', 'grave'].includes(formData.severidade)) {
      setPendingAchados([novoAchado.id]);
      setShowNCDialog(true);
    }

    setFormData({ descricao: '', severidade: 'grave', criterio: '' });
    setShowForm(false);
  };

  const handleCreateNCs = () => {
    onCreateNCs?.(pendingAchados);
    setShowNCDialog(false);
    setPendingAchados([]);
  };

  return (
    <div className="space-y-4">
      {/* Existing findings */}
      {auditoria.achados.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Achados registrados</h4>
          {auditoria.achados.map((achado) => (
            <div key={achado.id} className="p-3 bg-black/20 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-white">{achado.descricao}</p>
                  <p className="text-xs text-white/50 mt-1">{achado.criterio}</p>
                  <div className="mt-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        achado.severidade === 'critica'
                          ? 'bg-red-600 text-white'
                          : achado.severidade === 'grave'
                            ? 'bg-amber-600 text-white'
                            : achado.severidade === 'moderada'
                              ? 'bg-yellow-600 text-white'
                              : achado.severidade === 'leve'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 text-white'
                      }`}
                    >
                      {achado.severidade}
                    </span>
                  </div>
                </div>
                {achado.ncGerada && <div className="text-xs text-emerald-400">NC criada</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-white/80 mb-2">
              Descrição do achado *
            </label>
            <textarea
              required
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
              placeholder="Descreva o achado encontrado..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/80 mb-2">
              Critério / Norma violada *
            </label>
            <input
              type="text"
              required
              value={formData.criterio}
              onChange={(e) => setFormData({ ...formData, criterio: e.target.value })}
              placeholder="Ex: DICQ 4.13, RDC 978 cl. 8.1"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/80 mb-2">Severidade *</label>
            <select
              value={formData.severidade}
              onChange={(e) =>
                setFormData({ ...formData, severidade: e.target.value as SeveridadeAchado })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-violet-500/50"
            >
              {SEVERIDADES.map((sev) => (
                <option key={sev} value={sev}>
                  {sev}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded transition-colors"
            >
              Registrar achado
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors font-bold"
            >
              ×
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          + Novo achado
        </button>
      )}

      {/* NC Auto-gen Dialog */}
      {showNCDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141417] border border-white/[0.08] shadow-2xl">
            <div className="px-6 py-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Achado grave/crítico detectado</h3>
              <p className="text-xs text-white/50">
                Um ou mais achados com severidade grave/crítica foram registrados. Deseja criar
                Não-Conformidades automaticamente?
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNCDialog(false)}
                  className="px-4 py-2 rounded-md text-sm text-white/60 hover:bg-white/[0.05]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateNCs}
                  className="px-4 py-2 rounded-md bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400"
                >
                  Criar NCs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
