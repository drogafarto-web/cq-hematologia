import { useState } from 'react';
import { AlertTriangle, Search, ChevronRight } from 'lucide-react';
import type { NaoConformidade, NCFilters } from '../../types/NaoConformidade';
import {
  SEVERIDADE_LABEL,
  SEVERIDADE_CORES,
  CAPA_STATUS_LABEL,
  isBloqueada,
  diasAteVencimento,
} from '../../types/NaoConformidade';
import { useNCs } from '../useNCs';

interface NCListProps {
  onSelectNC?: (nc: NaoConformidade) => void;
  showBloqueando?: boolean;
}

export default function NCList({ onSelectNC, showBloqueando = false }: NCListProps) {
  const [filters, setFilters] = useState<NCFilters>({
    bloqueiaOperacoes: showBloqueando || undefined,
  });
  const [searchTerm, setSearchTerm] = useState('');

  const { ncs, loading } = useNCs({
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
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar NC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['critica', 'grave', 'moderada', 'leve'].map((sev) => (
          <button
            key={sev}
            onClick={() => {
              const current = filters.severidade as string[];
              setFilters({
                ...filters,
                severidade: current?.includes(sev)
                  ? current.filter((s) => s !== sev)
                  : [...(current || []), sev],
              });
            }}
            className="px-3 py-1 text-xs rounded-full border transition-colors"
          >
            {sev}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {ncs.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <p>Nenhuma não-conformidade encontrada</p>
          </div>
        ) : (
          ncs.map((nc) => {
            const bloqueada = isBloqueada(nc);
            const diasVencimento = nc.prazoClosure ? diasAteVencimento(nc) : null;

            return (
              <div
                key={nc.id}
                onClick={() => onSelectNC?.(nc)}
                className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {bloqueada && (
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white truncate">{nc.codigo}</h3>
                      <span className={`text-xs px-2 py-1 rounded text-white ${SEVERIDADE_CORES[nc.severidade]}`}>
                        {SEVERIDADE_LABEL[nc.severidade]}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 mt-1 truncate">{nc.titulo}</p>

                    <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                      <span>{CAPA_STATUS_LABEL[nc.capaStatus]}</span>
                      {diasVencimento !== null && (
                        <span className={diasVencimento <= 7 ? 'text-red-400' : ''}>
                          Vence em {diasVencimento} dias
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60 flex-shrink-0" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
