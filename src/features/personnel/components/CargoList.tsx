/**
 * personnel/components/CargoList.tsx
 *
 * List all job descriptions (cargos).
 * Grid of cards with search/filter.
 */

import React, { useMemo, useState } from 'react';
import type { Cargo } from '../types';

interface CargoListProps {
  cargos: Cargo[];
}

interface CargoListItemProps {
  cargo: Cargo;
  onSelect: (cargo: Cargo) => void;
}

function CargoListItem({ cargo, onSelect }: CargoListItemProps): React.ReactElement {
  return (
    <button
      onClick={() => onSelect(cargo)}
      className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-all hover:bg-white/10 hover:border-white/20"
    >
      <div>
        <h3 className="font-semibold text-white">{cargo.titulo}</h3>
        {cargo.reportaA && (
          <p className="mt-1 text-xs text-white/60">Reports to: {cargo.reportaA}</p>
        )}
      </div>

      <p className="line-clamp-2 text-sm text-white/70">{cargo.descricao}</p>

      {cargo.responsabilidades.length > 0 && (
        <div className="text-xs text-white/50">
          <span className="font-medium">{cargo.responsabilidades.length}</span> responsabilidades
        </div>
      )}
    </button>
  );
}

interface CargoDetailProps {
  cargo: Cargo;
  onClose: () => void;
}

function CargoDetail({ cargo, onClose }: CargoDetailProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[#1a1a1d] p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">{cargo.titulo}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold uppercase text-white/40 mb-2">Descrição</h3>
            <p className="text-white/80 leading-relaxed text-justify">{cargo.descricao}</p>
          </div>

          {/* Responsibilities */}
          <div>
            <h3 className="text-sm font-semibold uppercase text-white/40 mb-3">
              Responsabilidades
            </h3>
            <ul className="space-y-2">
              {cargo.responsabilidades.map((resp, i) => (
                <li key={i} className="flex gap-3 text-white/80">
                  <span className="text-violet-400 font-bold">•</span>
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Authorities */}
          {cargo.autoridades.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase text-white/40 mb-3">Autoridades</h3>
              <ul className="space-y-2">
                {cargo.autoridades.map((auth, i) => (
                  <li key={i} className="flex gap-3 text-white/80">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{auth}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Certifications */}
          {cargo.certificacoes && cargo.certificacoes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase text-white/40 mb-3">
                Certificações Requeridas
              </h3>
              <div className="flex flex-wrap gap-2">
                {cargo.certificacoes.map((cert, i) => (
                  <span
                    key={i}
                    className="inline-block rounded-full bg-violet-500/20 px-3 py-1 text-sm text-violet-200"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reporting */}
          {cargo.reportaA && (
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/70">
                <span className="font-medium text-white">Reporta para:</span> {cargo.reportaA}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CargoList({ cargos }: CargoListProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);

  const filtered = useMemo(() => {
    return cargos.filter(
      (cargo) =>
        cargo.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cargo.descricao.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [cargos, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Buscar cargos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/40 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/60">Nenhum cargo encontrado</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cargo) => (
            <CargoListItem key={cargo.id} cargo={cargo} onSelect={setSelectedCargo} />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedCargo && (
        <CargoDetail cargo={selectedCargo} onClose={() => setSelectedCargo(null)} />
      )}
    </div>
  );
}
