import { useState } from 'react';
import type { Auditoria, AuditoriaFilters } from '../../types/Auditoria';
import { temAchadosGraves, contaAchadosPorSeveridade, diasAteVencimento } from '../../types/Auditoria';
import { useAuditorias } from '../useAuditorias';

interface AuditoriaListProps {
  onSelectAuditoria?: (auditoria: Auditoria) => void;
}

export default function AuditoriaList({ onSelectAuditoria }: AuditoriaListProps) {
  const [filters, setFilters] = useState<AuditoriaFilters>({});
  const [searchTerm, setSearchTerm] = useState('');

  const { auditorias, loading } = useAuditorias({
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
          <input
            type="text"
            placeholder="Buscar auditoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['planejada', 'em_execucao', 'finalizada', 'fechada'].map((status) => (
          <button
            key={status}
            onClick={() => {
              const currentStatus = filters.status;
              setFilters({
                ...filters,
                status: currentStatus === status ? undefined : (status as any),
              });
            }}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filters.status === status
                ? 'bg-violet-600 border-violet-600 text-white'
                : 'border-white/20 text-white/60 hover:text-white/80'
            }`}
          >
            {status.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {auditorias.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <p>Nenhuma auditoria encontrada</p>
          </div>
        ) : (
          auditorias.map((auditoria) => {
            const temGraves = temAchadosGraves(auditoria);
            const criticas = contaAchadosPorSeveridade(auditoria, 'critica');
            const graves = contaAchadosPorSeveridade(auditoria, 'grave');
            const diasVenc = auditoria.prazoClosure ? diasAteVencimento(auditoria) : null;

            return (
              <div
                key={auditoria.id}
                onClick={() => onSelectAuditoria?.(auditoria)}
                className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{auditoria.codigo}</h3>
                      {temGraves && (
                        <span className="text-amber-400" title="Achados graves">⚠</span>
                      )}
                    </div>
                    <p className="text-sm text-white/60 mt-1">{auditoria.titulo}</p>

                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="px-2 py-1 bg-white/10 rounded text-white/70">
                        {auditoria.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-white/50">{auditoria.escopo}</span>
                      {criticas > 0 && (
                        <span className="text-red-400">
                          {criticas} crítica{criticas !== 1 ? 's' : ''}
                        </span>
                      )}
                      {graves > 0 && (
                        <span className="text-amber-400">
                          {graves} grave{graves !== 1 ? 's' : ''}
                        </span>
                      )}
                      {diasVenc !== null && (
                        <span className={diasVenc <= 7 ? 'text-red-400' : 'text-white/50'}>
                          Vence em {diasVenc}d
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-white/30 group-hover:text-white/60 flex-shrink-0">›</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
