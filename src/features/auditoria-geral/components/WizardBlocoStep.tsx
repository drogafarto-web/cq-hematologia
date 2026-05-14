import { INDICADORES } from '../data/indicadores';
import type { BlocoMeta, RespostaIndicador } from '../types';
import { IndicadorCard } from './IndicadorCard';

interface WizardBlocoStepProps {
  bloco: BlocoMeta;
  respostas: RespostaIndicador[];
  labId: string;
  auditoriaId: string;
}

export function WizardBlocoStep({ bloco, respostas, labId, auditoriaId }: WizardBlocoStepProps) {
  const indicadoresDoBloco = INDICADORES.filter((ind) =>
    bloco.indicadores.includes(ind.numero)
  );

  const respondidos = indicadoresDoBloco.filter((ind) =>
    respostas.some((r) => r.numero === ind.numero && (r.score !== null || r.naoAplica))
  ).length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white/90">
        {bloco.nome}{' '}
        <span className="text-sm font-normal text-white/40">
          {respondidos}/{indicadoresDoBloco.length} respondidos
        </span>
      </h2>

      {indicadoresDoBloco.map((ind) => (
        <IndicadorCard
          key={ind.id}
          indicador={ind}
          resposta={respostas.find((r) => r.numero === ind.numero)}
          labId={labId}
          auditoriaId={auditoriaId}
        />
      ))}
    </div>
  );
}
