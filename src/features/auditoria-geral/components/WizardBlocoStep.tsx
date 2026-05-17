import { INDICADORES } from '../data/indicadores';
import type { BlocoMeta, RespostaIndicador } from '../types';
import { IndicadorCard } from './IndicadorCard';

interface WizardBlocoStepProps {
  bloco: BlocoMeta;
  respostas: RespostaIndicador[];
  labId: string;
  auditoriaId: string;
  readonly?: boolean;
}

function getItemStatus(numero: number, respostas: RespostaIndicador[]) {
  const r = respostas.find((resp) => resp.numero === numero);
  if (!r) return 'pendente';
  if (r.naoAplica) return 'na';
  if (r.score === null) return 'pendente';
  if (r.critica === 'NÃO CONFORME') return 'nc';
  return 'respondido';
}

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  pendente: { label: '○', classes: 'bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-white/30' },
  respondido: { label: '✓', classes: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
  nc: { label: '!', classes: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
  na: { label: '—', classes: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400' },
};

export function WizardBlocoStep({ bloco, respostas, labId, auditoriaId, readonly = false }: WizardBlocoStepProps) {
  const indicadoresDoBloco = INDICADORES.filter((ind) =>
    bloco.indicadores.includes(ind.numero)
  );

  const respondidos = indicadoresDoBloco.filter((ind) =>
    respostas.some((r) => r.numero === ind.numero && (r.score !== null || r.naoAplica))
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white/90">
          {bloco.nome}{' '}
          <span className="text-sm font-normal text-slate-500 dark:text-white/40">
            {respondidos}/{indicadoresDoBloco.length} respondidos
          </span>
        </h2>

        {/* Mini status indicators */}
        <div className="flex items-center gap-0.5">
          {indicadoresDoBloco.map((ind) => {
            const status = getItemStatus(ind.numero, respostas);
            const badge = STATUS_BADGE[status];
            return (
              <span
                key={ind.numero}
                title={`#${ind.numero} — ${status}`}
                className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${badge.classes}`}
              >
                {badge.label}
              </span>
            );
          })}
        </div>
      </div>

      {indicadoresDoBloco.map((ind) => {
        const status = getItemStatus(ind.numero, respostas);
        const borderClass =
          status === 'nc'
            ? 'ring-1 ring-red-300 dark:ring-red-500/30'
            : status === 'respondido'
              ? 'ring-1 ring-emerald-200 dark:ring-emerald-500/20'
              : status === 'na'
                ? 'ring-1 ring-violet-200 dark:ring-violet-500/20'
                : '';

        return (
          <div key={ind.id} className={`rounded-lg ${borderClass}`}>
            <IndicadorCard
              indicador={ind}
              resposta={respostas.find((r) => r.numero === ind.numero)}
              labId={labId}
              auditoriaId={auditoriaId}
              readonly={readonly}
            />
          </div>
        );
      })}
    </div>
  );
}
