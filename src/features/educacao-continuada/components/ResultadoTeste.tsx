import type { AvaliacaoTeste } from '../types/EducacaoContinuada';

export interface ResultadoTesteProps {
  avaliacao: AvaliacaoTeste;
  onClose?: () => void;
}

/**
 * Exibe resultado de AvaliacaoTeste submetida. RN-10: server-side já corrigiu;
 * aqui só mostra o booleano `correta` + percentual total. Gabarito nunca é
 * enviado ao cliente nesta visão.
 */
export function ResultadoTeste({ avaliacao, onClose }: ResultadoTesteProps) {
  const aprovado = avaliacao.aprovado;
  const pendenciaDissertativa = avaliacao.status === 'submetido';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
      <header className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            aprovado
              ? 'bg-emerald-500/15 text-emerald-400'
              : pendenciaDissertativa
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-red-500/15 text-red-400'
          }`}
          aria-hidden
        >
          {aprovado ? '✓' : pendenciaDissertativa ? '⋯' : '✗'}
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-100">
            {aprovado
              ? 'Aprovado'
              : pendenciaDissertativa
                ? 'Aguardando correção manual'
                : 'Não aprovado'}
          </p>
          <p className="text-xs text-slate-400">
            {avaliacao.percentualAcerto}% de acerto · {avaliacao.pontuacaoTotal} pontos
          </p>
        </div>
      </header>

      {pendenciaDissertativa && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Questões dissertativas exigem correção manual. O responsável receberá o
          resultado final após revisão.
        </p>
      )}

      {onClose && (
        <footer className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Fechar
          </button>
        </footer>
      )}
    </div>
  );
}
