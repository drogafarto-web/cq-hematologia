import { useMemo } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import type {
  Colaborador,
  Periodicidade,
  Treinamento,
} from '../types/EducacaoContinuada';

import { useAvaliacaoCompetencia } from './useAvaliacaoCompetencia';
import { useColaboradores } from './useColaboradores';
import { useExecucoes } from './useExecucoes';
import { useTreinamentos } from './useTreinamentos';

export type StatusMatriz = 'ok' | 'vencendo' | 'vencido' | 'pendente';

export interface MatrizCelula {
  status: StatusMatriz;
  ultimaAvaliacao: Timestamp | null;
  proximoVencimento: Timestamp | null;
  diasAteVencimento: number | null;
}

export interface ContadoresMatriz {
  ok: number;
  vencendo: number;
  vencido: number;
  pendente: number;
  total: number;
}

export interface UseMatrizTreinamentosOptions {
  /** Janela em dias para considerar status 'vencendo' antes de vencer. Default 30. */
  diasAviso?: number;
}

export interface UseMatrizTreinamentosResult {
  colaboradores: Colaborador[];
  treinamentos: Treinamento[];
  /** matriz[i][j] = colaboradores[i] × treinamentos[j] */
  matriz: MatrizCelula[][];
  contadores: ContadoresMatriz;
  isLoading: boolean;
  diasAviso: number;
}

const MESES_POR_PERIODICIDADE: Record<Periodicidade, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function addMonths(ts: Timestamp, meses: number): Timestamp {
  const d = ts.toDate();
  d.setMonth(d.getMonth() + meses);
  return Timestamp.fromDate(d);
}

/**
 * Matriz de Treinamentos — derivação client-side em tempo real cruzando
 * Colaboradores ativos × Treinamentos ativos × última `AvaliacaoCompetencia`
 * com resultado `'aprovado'`. Status por célula:
 *
 *   pendente — colaborador nunca foi aprovado nesse treinamento
 *   vencido  — última aprovação + periodicidade já passou (`dias < 0`)
 *   vencendo — vence em ≤ `diasAviso` dias (default 30)
 *   ok       — dentro do prazo com folga > `diasAviso`
 *
 * Não persiste nada e não escreve no Firestore — apenas leituras reusando 4
 * hooks já existentes. Recalcula automaticamente quando qualquer subscribe
 * interno empurrar dados novos.
 */
export function useMatrizTreinamentos(
  options: UseMatrizTreinamentosOptions = {},
): UseMatrizTreinamentosResult {
  const { diasAviso = 30 } = options;

  const colaboradoresHook = useColaboradores({ somenteAtivos: true });
  const treinamentosHook = useTreinamentos({ somenteAtivos: true });
  const execucoesHook = useExecucoes({});
  const avaliacoesHook = useAvaliacaoCompetencia({});

  const isLoading =
    colaboradoresHook.isLoading ||
    treinamentosHook.isLoading ||
    execucoesHook.isLoading ||
    avaliacoesHook.isLoading;

  const colaboradores = useMemo(
    () =>
      [...colaboradoresHook.colaboradores].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [colaboradoresHook.colaboradores],
  );

  // Fase 10: Matriz só faz sentido para treinamentos com ciclo recorrente.
  // Tipos pontual/novo_procedimento/equipamento/acao_corretiva/capacitacao_externa
  // são event-triggered — não entram no dashboard semáforo.

  const treinamentos = useMemo(
    () =>
      treinamentosHook.treinamentos
        .filter((t) => t.tipo === 'periodico' || t.tipo === 'integracao')
        .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')),
    [treinamentosHook.treinamentos],
  );

  // execucaoId → treinamentoId (avaliações apontam para execução, não para treinamento direto)
  const execToTreinamento = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of execucoesHook.execucoes) {
      m.set(e.id, e.treinamentoId);
    }
    return m;
  }, [execucoesHook.execucoes]);

  // (colaboradorId|treinamentoId) → última dataAvaliacao com resultado 'aprovado'
  const ultimasAprovadas = useMemo(() => {
    const m = new Map<string, Timestamp>();
    for (const av of avaliacoesHook.avaliacoes) {
      if (av.resultado !== 'aprovado') continue;
      const treinamentoId = execToTreinamento.get(av.execucaoId);
      if (!treinamentoId) continue;
      const key = `${av.colaboradorId}|${treinamentoId}`;
      const atual = m.get(key);
      if (!atual || av.dataAvaliacao.toMillis() > atual.toMillis()) {
        m.set(key, av.dataAvaliacao);
      }
    }
    return m;
  }, [avaliacoesHook.avaliacoes, execToTreinamento]);

  const { matriz, contadores } = useMemo(() => {
    let ok = 0;
    let vencendo = 0;
    let vencido = 0;
    let pendente = 0;
    const hojeMillis = Date.now();

    const grid: MatrizCelula[][] = colaboradores.map((c) =>
      treinamentos.map((t) => {
        const key = `${c.id}|${t.id}`;
        const ultima = ultimasAprovadas.get(key) ?? null;

        if (!ultima) {
          pendente++;
          return {
            status: 'pendente',
            ultimaAvaliacao: null,
            proximoVencimento: null,
            diasAteVencimento: null,
          };
        }

        // Fase 10: após o filter acima, só entram tipos `periodico`|`integracao`.
        // Ambos exigem periodicidade por contrato da UI — mas para tipo `integracao`
        // a periodicidade pode estar ausente (revalidação opcional). Nesse caso
        // cai para `'anual'` como fallback seguro — onboarding sem renovação explícita.
        const meses = MESES_POR_PERIODICIDADE[t.periodicidade ?? 'anual'];
        const proximo = addMonths(ultima, meses);
        const dias = Math.ceil((proximo.toMillis() - hojeMillis) / MS_POR_DIA);

        let status: StatusMatriz;
        if (dias < 0) {
          status = 'vencido';
          vencido++;
        } else if (dias <= diasAviso) {
          status = 'vencendo';
          vencendo++;
        } else {
          status = 'ok';
          ok++;
        }

        return {
          status,
          ultimaAvaliacao: ultima,
          proximoVencimento: proximo,
          diasAteVencimento: dias,
        };
      }),
    );

    return {
      matriz: grid,
      contadores: {
        ok,
        vencendo,
        vencido,
        pendente,
        total: ok + vencendo + vencido + pendente,
      },
    };
  }, [colaboradores, treinamentos, ultimasAprovadas, diasAviso]);

  return {
    colaboradores,
    treinamentos,
    matriz,
    contadores,
    isLoading,
    diasAviso,
  };
}
