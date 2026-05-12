/**
 * ManutencaoList — manutenções do equipamento em tempo real + badge de calibração (equipamento).
 *
 * Dados: `useManutencoes`. Status de calibração: `useCalibracaoStatus` + `CalibracaoBadge` (sem duplicar derivação).
 */

import type { Timestamp } from 'firebase/firestore';

import { useCalibracaoStatus } from '../hooks/useCalibracaoStatus';
import { useManutencoes } from '../hooks/useManutencoes';
import type { ManutencaoPreventiva, ManutencaoStatus } from '../types/ManutencaoPreventiva';
import { CalibracaoBadge } from './CalibracaoBadge';

const STATUS_ROW: Record<
  ManutencaoStatus,
  { label: string; cls: string }
> = {
  agendada: {
    label: 'Agendada',
    cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
  },
  realizada: {
    label: 'Realizada',
    cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
  },
  cancelada: {
    label: 'Cancelada',
    cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400',
  },
};

const TIPO_LABEL: Record<ManutencaoPreventiva['tipo'], string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
};

const CHIP = `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border`;

function formatData(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('pt-BR');
}

export interface ManutencaoListProps {
  labId: string | null;
  equipamentoId: string | null;
  /** Próxima calibração do equipamento — quando ausente, o badge de calibração não é exibido. */
  proximaCalibracao?: Timestamp;
  /**
   * Quando true, não renderiza o badge no cabeçalho da lista (ex.: `EquipamentoDetail` mostra
   * `CalibracaoBadge` acima com o mesmo `useCalibracaoStatus`).
   */
  omitCalibracaoBadge?: boolean;
}

export function ManutencaoList({
  labId,
  equipamentoId,
  proximaCalibracao,
  omitCalibracaoBadge = false,
}: ManutencaoListProps) {
  const { manutencoes, loading, error } = useManutencoes({ labId, equipamentoId });
  const { calibracaoStatus } = useCalibracaoStatus(proximaCalibracao);
  const showCalibracaoBadge = !omitCalibracaoBadge && proximaCalibracao != null;

  return (
    <section
      aria-labelledby="manutencao-list-title"
      className="rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30">
            Equipamento
          </p>
          <h3
            id="manutencao-list-title"
            className="text-sm font-semibold text-slate-900 dark:text-white/90"
          >
            Manutenções
          </h3>
        </div>
        {showCalibracaoBadge ? <CalibracaoBadge calibracaoStatus={calibracaoStatus} /> : null}
      </header>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-white/40">Carregando manutenções…</p>
      ) : error ? (
        <p className="py-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : manutencoes.length === 0 ? (
        <div className="border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl py-8 px-4 text-center">
          <p className="text-sm text-slate-600 dark:text-white/55">Nenhuma manutenção registrada.</p>
          <p className="text-xs text-slate-500 dark:text-white/35 mt-1">
            Agendamentos e registros aparecem aqui em tempo real.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {manutencoes.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 dark:text-white/85 truncate">
                    {m.descricao}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
                    {TIPO_LABEL[m.tipo]} · prevista {formatData(m.dataPrevista)}
                    {m.dataRealizada ? ` · realizada ${formatData(m.dataRealizada)}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-white/35 mt-0.5 truncate">
                    {m.responsavelNome}
                  </p>
                </div>
                <span className={`${CHIP} shrink-0 ${STATUS_ROW[m.status].cls}`}>{STATUS_ROW[m.status].label}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
