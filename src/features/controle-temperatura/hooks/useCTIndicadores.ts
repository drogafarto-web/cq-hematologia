import { useMemo } from 'react';
import { Timestamp } from '../../../shared/services/firebase';

import { computarOnline } from '../services/ctFirebaseService';
import type {
  CardStatusEquipamento,
  DispositivoIoT,
  EquipamentoMonitorado,
  IndicadorConformidade,
  LeituraPrevista,
  LeituraTemperatura,
  NaoConformidadeTemp,
  StatusCardEquipamento,
} from '../types/ControlTemperatura';

const MAX_HORAS_SEM_LEITURA = 24;

function statusCardPara(
  equipamento: EquipamentoMonitorado,
  ultimaLeitura: LeituraTemperatura | null,
  dispositivo: DispositivoIoT | null,
  agora: Date,
): { status: StatusCardEquipamento; motivo: string } {
  if (equipamento.status === 'inativo' || equipamento.status === 'manutencao') {
    return { status: 'cinza', motivo: `Equipamento ${equipamento.status}` };
  }
  if (dispositivo && !computarOnline(dispositivo.ultimaTransmissao, dispositivo.intervaloEnvioMinutos, agora)) {
    return { status: 'vermelho', motivo: 'Dispositivo IoT offline' };
  }
  if (ultimaLeitura?.foraDosLimites) {
    return { status: 'vermelho', motivo: 'Última leitura fora dos limites' };
  }
  if (!ultimaLeitura) {
    return { status: 'amarelo', motivo: 'Sem leitura registrada' };
  }
  const horasSemLeitura = (agora.getTime() - ultimaLeitura.dataHora.toMillis()) / (60 * 60 * 1000);
  if (horasSemLeitura > MAX_HORAS_SEM_LEITURA) {
    return { status: 'amarelo', motivo: `${Math.round(horasSemLeitura)}h sem leitura` };
  }
  return { status: 'verde', motivo: 'Conforme' };
}

export interface UseCTIndicadoresInput {
  equipamentos: EquipamentoMonitorado[];
  leituras: LeituraTemperatura[];
  previstas: LeituraPrevista[];
  ncs: NaoConformidadeTemp[];
  dispositivos: DispositivoIoT[];
  /** Escopo de tempo para indicadores do mês corrente. */
  inicioPeriodo?: Timestamp;
  fimPeriodo?: Timestamp;
}

export interface UseCTIndicadoresResult {
  cards: CardStatusEquipamento[];
  indicadores: IndicadorConformidade[];
  totalNCsAbertas: number;
  totalPendentesHoje: number;
  percentualConformidadeGlobal: number;
}

/**
 * Derivação pura — dados já vêm dos hooks subscribers. Centraliza a lógica de
 * dashboard pra garantir consistência entre CTDashboard e CTIndicadores.
 */
export function useCTIndicadores(input: UseCTIndicadoresInput): UseCTIndicadoresResult {
  const { equipamentos, leituras, previstas, ncs, dispositivos, inicioPeriodo, fimPeriodo } = input;

  return useMemo(() => {
    const agora = new Date();
    const ultimaLeituraPor: Record<string, LeituraTemperatura | undefined> = {};
    for (const l of leituras) {
      const prev = ultimaLeituraPor[l.equipamentoId];
      if (!prev || l.dataHora.toMillis() > prev.dataHora.toMillis()) {
        ultimaLeituraPor[l.equipamentoId] = l;
      }
    }

    const dispositivoPor: Record<string, DispositivoIoT | undefined> = {};
    for (const d of dispositivos) {
      if (d.ativo && d.deletadoEm === null) dispositivoPor[d.equipamentoId] = d;
    }

    const ncsAbertasPor: Record<string, number> = {};
    for (const nc of ncs) {
      if (nc.deletadoEm === null && nc.status !== 'resolvida') {
        ncsAbertasPor[nc.equipamentoId] = (ncsAbertasPor[nc.equipamentoId] ?? 0) + 1;
      }
    }

    const cards: CardStatusEquipamento[] = equipamentos.map((eq) => {
      const ultima = ultimaLeituraPor[eq.id] ?? null;
      const disp = dispositivoPor[eq.id] ?? null;
      const { status, motivo } = statusCardPara(eq, ultima, disp, agora);
      return {
        equipamento: eq,
        statusCard: status,
        ultimaLeitura: ultima,
        dispositivo: disp,
        ncsAbertas: ncsAbertasPor[eq.id] ?? 0,
        motivo,
      };
    });

    const indicadores: IndicadorConformidade[] = equipamentos.map((eq) => {
      const previstasDoEq = previstas.filter((p) => {
        if (p.equipamentoId !== eq.id) return false;
        if (inicioPeriodo && p.dataHoraPrevista.toMillis() < inicioPeriodo.toMillis()) return false;
        if (fimPeriodo && p.dataHoraPrevista.toMillis() > fimPeriodo.toMillis()) return false;
        return true;
      });
      const leiturasDoEq = leituras.filter((l) => {
        if (l.equipamentoId !== eq.id) return false;
        if (l.deletadoEm !== null) return false;
        if (inicioPeriodo && l.dataHora.toMillis() < inicioPeriodo.toMillis()) return false;
        if (fimPeriodo && l.dataHora.toMillis() > fimPeriodo.toMillis()) return false;
        return true;
      });
      const totalPrevisto = previstasDoEq.length;
      const totalRealizado = previstasDoEq.filter((p) => p.status === 'realizada').length;
      const totalPerdido = previstasDoEq.filter((p) => p.status === 'perdida').length;
      const forasLimite = leiturasDoEq.filter((l) => l.foraDosLimites).length;
      const percentual =
        totalPrevisto === 0 ? 100 : Math.round((totalRealizado / totalPrevisto) * 100);
      return {
        equipamentoId: eq.id,
        nomeEquipamento: eq.nome,
        totalPrevisto,
        totalRealizado,
        totalPerdido,
        percentualConformidade: percentual,
        leiturasForaDosLimites: forasLimite,
      };
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
    const totalPendentesHoje = previstas.filter(
      (p) =>
        p.status === 'pendente' &&
        p.dataHoraPrevista.toMillis() >= hoje.getTime() &&
        p.dataHoraPrevista.toMillis() < amanha.getTime(),
    ).length;

    const totalNCsAbertas = ncs.filter(
      (nc) => nc.deletadoEm === null && nc.status !== 'resolvida',
    ).length;

    const somaPrev = indicadores.reduce((s, i) => s + i.totalPrevisto, 0);
    const somaReal = indicadores.reduce((s, i) => s + i.totalRealizado, 0);
    const percentualConformidadeGlobal =
      somaPrev === 0 ? 100 : Math.round((somaReal / somaPrev) * 100);

    return {
      cards,
      indicadores,
      totalNCsAbertas,
      totalPendentesHoje,
      percentualConformidadeGlobal,
    };
  }, [equipamentos, leituras, previstas, ncs, dispositivos, inicioPeriodo, fimPeriodo]);
}
