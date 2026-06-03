import { memo } from 'react';

import type { PlanoMelhoria } from '../types/PlanoMelhoria';
import { planoStatusBadgeClass, planoStatusLabel } from './planoMelhoriaHelpers';

export interface PlanoMelhoriaCardProps {
  readonly plano: PlanoMelhoria;
  readonly pendentesCount: number;
  readonly onSelect: (plano: PlanoMelhoria) => void;
}

function PlanoMelhoriaCardInner({ plano, pendentesCount, onSelect }: PlanoMelhoriaCardProps) {
  const prazoStr = plano.prazoMeta.toDate().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const pendentesLabel =
    pendentesCount === 0
      ? 'Nenhuma ação pendente'
      : pendentesCount === 1
        ? '1 ação pendente'
        : `${pendentesCount} ações pendentes`;

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(plano);
      }}
      className="group w-full rounded-xl border border-white/10 bg-[#1a1a1d] p-4 text-left transition-colors duration-150 hover:border-violet-500/35 hover:bg-[#1e1e22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 font-semibold tracking-tight text-white/95">
          {plano.titulo}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${planoStatusBadgeClass(plano.status)}`}
        >
          {planoStatusLabel(plano.status)}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/55">{plano.descricao}</p>
      <dl className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Responsável</dt>
          <dd className="mt-0.5 font-medium text-white/85">{plano.responsavelNome || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Prazo meta</dt>
          <dd className="mt-0.5 tabular-nums font-medium text-white/85">{prazoStr}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-xs text-white/45">{pendentesLabel}</span>
        <span
          className="text-xs font-medium text-violet-400/90 transition-colors group-hover:text-violet-300"
          aria-hidden
        >
          Abrir
        </span>
      </div>
    </button>
  );
}

export const PlanoMelhoriaCard = memo(PlanoMelhoriaCardInner);
