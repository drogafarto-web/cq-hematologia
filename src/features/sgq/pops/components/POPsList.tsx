import { memo, useState } from 'react';
import type { POP, POPFilters } from '../../types/POP';
import { usePOPs } from '../usePOPs';
import { isVersaoExpirada, getVersaoAtiva } from '../../types/POP';
import CreatePOPModal from './CreatePOPModal';

interface POPsListProps {
  onSelectPOP?: (pop: POP) => void;
}

export default function POPsList({ onSelectPOP }: POPsListProps) {
  const [filters, setFilters] = useState<POPFilters>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { pops, loading } = usePOPs({
    ...filters,
    busca: searchTerm,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
            />
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-3 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          + Novo POP
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {pops.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <p>Nenhum POP encontrado</p>
          </div>
        ) : (
          pops.map((pop) => (
            <POPCard key={pop.id} pop={pop} onSelect={onSelectPOP} />
          ))
        )}
      </div>

      {showCreateModal && (
        <CreatePOPModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── POPCard ─────────────────────────────────────────────────────────────────

const POPCard = memo(function POPCard({
  pop,
  onSelect,
}: {
  pop: POP;
  onSelect?: (pop: POP) => void;
}) {
  const versaoAtiva = getVersaoAtiva(pop);
  const isExpirada = versaoAtiva ? isVersaoExpirada(versaoAtiva) : false;

  return (
    <div
      onClick={() => onSelect?.(pop)}
      className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">{pop.codigo}</h3>
            {isExpirada && (
              <span className="text-red-400 font-bold" title="POP expirado">⚠</span>
            )}
          </div>
          <p className="text-sm text-white/60 mt-1">{pop.nome}</p>
          <div className="flex items-center gap-2 mt-2">
            {versaoAtiva && (
              <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded">
                v{versaoAtiva.numero}
              </span>
            )}
            <div className="text-xs text-white/40 space-x-1">
              <span>{pop.modulos.join(', ')}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/40">
            {pop.treinamentosObrigatorios.length} treinamento
            {pop.treinamentosObrigatorios.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
});
