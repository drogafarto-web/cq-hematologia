/**
 * ctExportService.ts
 *
 * Payload + helpers da geração do FR-11 (Controle de Temperatura).
 *
 * Render + impressão ficam no componente `CTRelatorioPrint` via
 * `react-to-print` — mesmo padrão dos módulos EC e Uroanálise. Este service
 * expõe apenas os tipos de payload e o "montador" determinístico que
 * transforma leituras + NCs do mês em uma grade 31×2 pronta pra layout.
 *
 * Regras FR-11 (PQ-06):
 *   - Tabela principal: 31 linhas (1 por dia do mês). Cada dia tem 2 colunas
 *     de leitura (manhã/tarde). Dias inexistentes (30/31 em fev) ficam em
 *     branco com traço.
 *   - Valor fora dos limites: sufixo "*".
 *   - Leitura não realizada: "—".
 *   - Leitura justificada: "J" (justificativa no verso).
 *   - Observações: NCs do mês (data | equipamento | valor | ação imediata).
 *   - Rodapé: hash do documento (SHA-256 do conjunto ordenado) pra auditoria.
 */

import { Timestamp } from '../../../shared/services/firebase';
import type {
  EquipamentoMonitorado,
  LeituraTemperatura,
  NaoConformidadeTemp,
  Termometro,
} from '../types/ControlTemperatura';

export type TipoRelatorioCT = 'FR-11';

/** Uma célula da coluna de leitura da tabela FR-11. */
export interface CelulaLeituraFR11 {
  hora: string;
  temperaturaAtual: string;
  umidade: string;
  temperaturaMax: string;
  temperaturaMin: string;
  responsavel: string;
  foraDosLimites: boolean;
  justificada: boolean;
}

/** Linha 1..31 do corpo do FR-11. Pode ter 0, 1 ou 2 leituras no dia. */
export interface LinhaDiaFR11 {
  dia: number;
  manha: CelulaLeituraFR11 | null;
  tarde: CelulaLeituraFR11 | null;
}

export interface NCResumoFR11 {
  data: string;
  equipamento: string;
  valor: string;
  acaoImediata: string;
}

export interface RelatorioFR11 {
  tipo: 'FR-11';
  equipamento: EquipamentoMonitorado;
  termometro: Termometro | null;
  mes: number; // 1..12
  ano: number;
  linhas: LinhaDiaFR11[]; // sempre 31
  ncs: NCResumoFR11[];
  /** SHA-256 determinístico do conteúdo — impresso no rodapé para auditoria. */
  hashDocumento: string;
  emitidoEm: Timestamp;
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

export function formatTemperatura(v: number | undefined | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toFixed(1);
}

export function formatUmidade(v: number | undefined | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toFixed(0)}%`;
}

export function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

export function formatDateTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatHora(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const NOMES_MES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function nomeMes(mes: number): string {
  return NOMES_MES[mes - 1] ?? '—';
}

// ─── Montagem determinística ──────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface MontarRelatorioFR11Params {
  equipamento: EquipamentoMonitorado;
  termometro: Termometro | null;
  mes: number;
  ano: number;
  leituras: LeituraTemperatura[];
  ncs: NaoConformidadeTemp[];
  resolveResponsavel: (uid: string) => string;
}

/**
 * Constrói o payload completo do FR-11 a partir das leituras/NCs do mês.
 * Pure — não lê Firestore, não mutaciona nada. Leituras são agrupadas por
 * dia e classificadas em manhã (< 12h) ou tarde (≥ 12h). Quando há mais de
 * uma leitura no mesmo turno, a mais recente prevalece.
 */
export async function montarRelatorioFR11(
  params: MontarRelatorioFR11Params,
): Promise<RelatorioFR11> {
  const { equipamento, termometro, mes, ano, leituras, ncs, resolveResponsavel } = params;

  const linhas: LinhaDiaFR11[] = Array.from({ length: 31 }, (_, i) => ({
    dia: i + 1,
    manha: null,
    tarde: null,
  }));

  const ordenadas = [...leituras]
    .filter((l) => l.deletadoEm === null)
    .sort((a, b) => a.dataHora.toMillis() - b.dataHora.toMillis());

  for (const l of ordenadas) {
    const d = l.dataHora.toDate();
    if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) continue;
    const dia = d.getDate();
    const bucket = d.getHours() < 12 ? 'manha' : 'tarde';
    const cell: CelulaLeituraFR11 = {
      hora: formatHora(l.dataHora),
      temperaturaAtual: formatTemperatura(l.temperaturaAtual),
      umidade: formatUmidade(l.umidade),
      temperaturaMax: formatTemperatura(l.temperaturaMax),
      temperaturaMin: formatTemperatura(l.temperaturaMin),
      responsavel:
        l.assinatura?.operatorId !== undefined
          ? resolveResponsavel(l.assinatura.operatorId)
          : l.origem === 'automatica_iot'
            ? 'IoT'
            : '—',
      foraDosLimites: l.foraDosLimites,
      justificada: l.status === 'justificada',
    };
    linhas[dia - 1][bucket] = cell;
  }

  const ncsMes: NCResumoFR11[] = ncs
    .filter((n) => n.deletadoEm === null && n.equipamentoId === equipamento.id)
    .filter((n) => {
      const d = n.dataAbertura.toDate();
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    })
    .sort((a, b) => a.dataAbertura.toMillis() - b.dataAbertura.toMillis())
    .map((n) => ({
      data: formatDateTime(n.dataAbertura),
      equipamento: equipamento.nome,
      valor: `${formatTemperatura(n.temperaturaRegistrada)}°C (${n.limiteViolado})`,
      acaoImediata: n.acaoImediata,
    }));

  const emitidoEm = Timestamp.now();
  const hashBase = JSON.stringify({
    tipo: 'FR-11',
    equipamentoId: equipamento.id,
    mes,
    ano,
    linhas,
    ncs: ncsMes,
    emitidoEm: emitidoEm.toMillis(),
  });
  const hashDocumento = await sha256Hex(hashBase);

  return {
    tipo: 'FR-11',
    equipamento,
    termometro,
    mes,
    ano,
    linhas,
    ncs: ncsMes,
    hashDocumento,
    emitidoEm,
  };
}
