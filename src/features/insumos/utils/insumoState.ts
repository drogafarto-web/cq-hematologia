/**
 * insumoState — resolve o rótulo operacional do insumo para UI.
 *
 * O campo `status` armazena 4 valores (`ativo|fechado|vencido|descartado`)
 * mas a semântica de `fechado` é ambígua na rotina — pode ser:
 *   - LACRADO: lote ainda não aberto (estoque pronto pra rotacionar)
 *   - ENCERRADO: lote que foi aberto e depois fechado (fim de vida)
 *
 * O operador precisa distinguir os dois: lacrado é material disponível;
 * encerrado é histórico. Este helper decide com base em `dataAbertura`:
 * se ausente = lote nunca foi aberto = LACRADO; se presente = ENCERRADO.
 *
 * Retorna kind + label + classes Tailwind pra chip. Classes estáveis —
 * UI aplica direto sem mapear de novo.
 */

import type { Insumo } from '../types/Insumo';

export type InsumoStateKind =
  | 'em-uso'
  | 'lacrado'
  | 'encerrado'
  | 'vencido'
  | 'descartado';

export interface InsumoStateChip {
  kind: InsumoStateKind;
  label: string;
  /** Tailwind classes completas para o chip (incluindo bg/border/text). */
  chipCls: string;
  /** Descrição curta pra tooltip. */
  tooltip: string;
}

export function resolveInsumoState(
  insumo: Pick<Insumo, 'status' | 'dataAbertura'>,
): InsumoStateChip {
  switch (insumo.status) {
    case 'ativo':
      return {
        kind: 'em-uso',
        label: 'Em uso',
        chipCls:
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
        tooltip: 'Lote aberto e em rotina — declarável em corridas.',
      };
    case 'fechado':
      // Distingue lacrado (nunca aberto) vs encerrado (fim de vida).
      if (insumo.dataAbertura == null) {
        return {
          kind: 'lacrado',
          label: 'Lacrado',
          chipCls: 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300',
          tooltip:
            'Lote recebido mas ainda lacrado. Abra formalmente para disponibilizar nas corridas.',
        };
      }
      return {
        kind: 'encerrado',
        label: 'Encerrado',
        chipCls:
          'bg-slate-400/15 border-slate-400/40 text-slate-600 dark:text-white/55',
        tooltip:
          'Lote já foi usado e encerrado — mantido apenas no histórico (RDC 786 retenção).',
      };
    case 'vencido':
      return {
        kind: 'vencido',
        label: 'Vencido',
        chipCls: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
        tooltip: 'Validade expirada. Bloqueado para novas corridas.',
      };
    case 'descartado':
      return {
        kind: 'descartado',
        label: 'Descartado',
        chipCls:
          'bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400',
        tooltip: 'Descarte formal com motivo registrado (RDC 786).',
      };
  }
}

/** true quando o lote faz parte da rotina operacional (em uso ou lacrado pronto pra abrir). */
export function isEmRotina(insumo: Pick<Insumo, 'status' | 'dataAbertura'>): boolean {
  const k = resolveInsumoState(insumo).kind;
  return k === 'em-uso' || k === 'lacrado';
}
