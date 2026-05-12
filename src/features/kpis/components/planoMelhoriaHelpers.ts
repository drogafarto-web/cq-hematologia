/**
 * Labels e classes de badge compartilhados entre lista, card e detalhe de plano de melhoria.
 */

import type { AcaoMelhoriaStatus, PlanoMelhoriaStatus } from '../types/PlanoMelhoria';

export function planoStatusBadgeClass(status: PlanoMelhoriaStatus): string {
  switch (status) {
    case 'rascunho':
      return 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30';
    case 'ativo':
      return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/35';
    case 'concluido':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35';
    case 'cancelado':
      return 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function planoStatusLabel(status: PlanoMelhoriaStatus): string {
  switch (status) {
    case 'rascunho':
      return 'Rascunho';
    case 'ativo':
      return 'Ativo';
    case 'concluido':
      return 'Concluído';
    case 'cancelado':
      return 'Cancelado';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function acaoStatusLabel(s: AcaoMelhoriaStatus): string {
  switch (s) {
    case 'pendente':
      return 'Pendente';
    case 'em_andamento':
      return 'Em andamento';
    case 'concluida':
      return 'Concluída';
    case 'cancelada':
      return 'Cancelada';
    default: {
      const _e: never = s;
      return _e;
    }
  }
}

export function acaoStatusPillClass(s: AcaoMelhoriaStatus): string {
  switch (s) {
    case 'pendente':
      return 'bg-amber-500/15 text-amber-200 ring-amber-500/30';
    case 'em_andamento':
      return 'bg-blue-500/15 text-blue-200 ring-blue-500/35';
    case 'concluida':
      return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/35';
    case 'cancelada':
      return 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30';
    default: {
      const _e: never = s;
      return _e;
    }
  }
}
