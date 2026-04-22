/**
 * Equipamento — entidade de primeira classe que representa cada analisador,
 * coagulômetro, leitor de tira ou kit de imunoensaio em uso no laboratório.
 *
 * Evolução Fase D (2026-04-21 — segundo turno): antes do refactor o "equipa-
 * mento" vivia como dois campos (`equipamentoName`, `equipamentoModelo`) den-
 * tro de EquipmentSetup e havia **um por módulo**. Na realidade operacional
 * um lab tem N equipamentos por módulo (ex.: Yumizen H550 + Micros 60 em
 * hematologia), cada um com seu catálogo de reagentes e seu próprio setup
 * ativo. Aposentadoria (venda/sucata/devolução) exige retenção imutável do
 * registro por 5 anos — RDC 786/2023 art. 42 + RDC 978/2025.
 *
 * Firestore path: /labs/{labId}/equipamentos/{equipamentoId}
 * Trilha:         /labs/{labId}/equipamentos-audit/{auditId} (append-only)
 *
 * Ciclo de vida:
 *   ativo        — em uso rotineiro. Pode ter setup + lotes vinculados.
 *   manutencao   — fora da rotina temporariamente (aguardando reparo/cal).
 *                  Bloqueia criação de corridas mas setup + lotes preservados.
 *   aposentado   — saída definitiva. Soft-delete auditado com retenção 5 anos.
 *                  `retencaoAte = aposentadoEm + 5 anos`. Após esse prazo a
 *                  Cloud Function `cleanupEquipamentosExpirados` remove o doc
 *                  — registros de corridas e audit sobrevivem (outras cols).
 *
 * Relação com Insumo:
 *   reagente/tira-uro → `equipamentoId` (1:1, exclusivo)
 *   controle          → `equipamentosPermitidos[]` (N:1, compartilhado cross-equip)
 *
 * Relação com EquipmentSetup: 1:1 (cada equipamento ativo tem seu setup).
 */

import type { Timestamp } from 'firebase/firestore';
import type { InsumoModulo } from '../../insumos/types/Insumo';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type EquipamentoStatus = 'ativo' | 'manutencao' | 'aposentado';

/**
 * Destino final do equipamento aposentado. Alimenta relatório de baixa de
 * bens e comprovação de descarte ambientalmente correto (equipamento médico
 * tem eletrônicos + biomateriais residuais).
 */
export type EquipamentoDestinoFinal =
  | 'venda'              // transferência a terceiro com nota fiscal
  | 'devolucao'          // retorno ao fabricante/locadora
  | 'sucateamento'       // descarte como sucata eletrônica (WEEE)
  | 'descarte-ambiental' // coleta especializada (com resíduo biológico)
  | 'doacao';            // transferência sem contrapartida (ex: ensino)

// ─── Retenção ─────────────────────────────────────────────────────────────────

/**
 * Prazo de retenção (anos) após aposentadoria. RDC 786/2023 art. 42 e RDC
 * 978/2025 convergem em 5 anos para registros de rastreabilidade de insumos
 * e instrumentação de diagnóstico. Centralizado aqui para a Cloud Function
 * de cleanup consultar a mesma fonte.
 */
export const RETENCAO_ANOS_POS_APOSENTADORIA = 5;

// ─── Entidade ─────────────────────────────────────────────────────────────────

export interface Equipamento {
  id: string;
  labId: string;

  /**
   * Módulo ao qual o equipamento serve. Um equipamento serve a UM módulo
   * (hematologia, coagulação, etc). Equipamentos que fazem múltiplos tipos
   * de exame (analisadores combo) ficam em cadastros separados por módulo
   * — simplifica rastreabilidade e rules.
   */
  module: InsumoModulo;

  /**
   * Nome de exibição. Default vem do catálogo (`DEFAULT_EQUIPAMENTO_POR_MODULO`)
   * mas o lab pode customizar ("Yumizen H550 — Bancada 2", "Cell Dyn Sala A").
   */
  name: string;

  /**
   * Modelo normalizado. Usado como chave em `InsumoControle.statsPorModelo` —
   * a bula do controle multianalítico traz faixas por modelo, e o gráfico de
   * Levey-Jennings precisa escolher os valores-alvo certos para cada equip.
   * Convenção: UPPER_SNAKE_CASE (ex: YUMIZEN_H550, MICROS_60, CELL_DYN_RUBY).
   */
  modelo: string;

  /** Nome do fabricante (ex: "Horiba Medical", "Abbott"). */
  fabricante: string;

  /**
   * Número de série — identificador único físico. Opcional porque nem todo
   * equipamento antigo tem registro acessível, mas fortemente recomendado em
   * auditoria (RDC 786/2023 exige rastreabilidade da instrumentação).
   */
  numeroSerie?: string;

  /** Ano de fabricação do equipamento. */
  anoFabricacao?: number;
  /** Ano em que o lab adquiriu/alugou. Útil em contabilidade + compliance. */
  anoAquisicao?: number;

  /** Registro ANVISA do equipamento (quando aplicável). */
  registroAnvisa?: string;

  /**
   * Observações livres — calibração especial, contrato de manutenção, etc.
   * Não estruturado de propósito; campos estruturados emergem da necessidade.
   */
  observacoes?: string;

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  status: EquipamentoStatus;

  /** Quando entrou em manutenção (última vez). Zerado ao voltar pra 'ativo'. */
  manutencaoDesde?: Timestamp;
  /** Motivo da manutenção atual (se em manutenção). */
  motivoManutencao?: string;

  /** Timestamp da aposentadoria — imutável após setado. */
  aposentadoEm?: Timestamp;
  aposentadoPor?: string;
  aposentadoPorName?: string;
  /**
   * Justificativa da aposentadoria (≥10 chars). Obrigatório para manter
   * trilha defensável em auditoria. Preservado indefinidamente no doc audit.
   */
  motivoAposentadoria?: string;
  destinoFinal?: EquipamentoDestinoFinal;
  /**
   * Data em que o doc do equipamento pode ser removido. Calculado como
   * `aposentadoEm + RETENCAO_ANOS_POS_APOSENTADORIA anos`. A Cloud Function
   * `cleanupEquipamentosExpirados` deleta apenas quando `now > retencaoAte`.
   * Antes disso, o doc permanece disponível para auditoria.
   */
  retencaoAte?: Timestamp;

  // ── Auditoria básica ──────────────────────────────────────────────────────

  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

/**
 * Evento da trilha de auditoria do equipamento. Append-only por rules.
 * Cobre criação, edição de campos, entrada/saída de manutenção e aposentadoria.
 *
 * Firestore path: /labs/{labId}/equipamentos-audit/{auditId}
 */
export type EquipamentoAuditEventType =
  | 'created'
  | 'updated'              // edição de campos (nome, modelo, obs, nº série)
  | 'manutencao-iniciada'
  | 'manutencao-concluida'
  | 'aposentado';

export interface EquipamentoAuditEvent {
  id: string;
  labId: string;
  equipamentoId: string;
  equipamentoNameSnapshot: string;   // congelado — sobrevive a delete do mestre
  equipamentoModeloSnapshot: string;

  type: EquipamentoAuditEventType;

  /** Snapshot dos campos alterados (antes → depois) quando aplicável. */
  changes?: Record<string, { from: unknown; to: unknown }>;

  /** Motivo obrigatório em aposentadoria e manutenção; opcional em edição. */
  motivo?: string;

  /** Destino final (apenas em 'aposentado'). */
  destinoFinal?: EquipamentoDestinoFinal;

  timestamp: Timestamp;
  operadorId: string;
  operadorName: string;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface EquipamentoFilters {
  module?: InsumoModulo;
  /**
   * Default no service: apenas `'ativo' | 'manutencao'`. Passar `'aposentado'`
   * explicitamente para ver histórico (tela de relatório/auditoria).
   */
  status?: EquipamentoStatus | EquipamentoStatus[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcula o timestamp de retenção a partir da aposentadoria — `+5 anos`.
 * Uso no service no momento de marcar aposentado e na Cloud Function de
 * cleanup (verificação inversa).
 */
export function computeRetencaoAte(aposentadoEm: Date): Date {
  const out = new Date(aposentadoEm);
  out.setFullYear(out.getFullYear() + RETENCAO_ANOS_POS_APOSENTADORIA);
  return out;
}

/** True quando o equipamento pode receber corridas novas. */
export function podeReceberCorrida(e: Equipamento): boolean {
  return e.status === 'ativo';
}

/**
 * True quando o equipamento já passou do prazo de retenção — elegível pra
 * remoção definitiva pela Cloud Function de cleanup.
 */
export function retencaoExpirada(e: Equipamento, now: Date = new Date()): boolean {
  if (e.status !== 'aposentado' || !e.retencaoAte) return false;
  return now.getTime() > e.retencaoAte.toDate().getTime();
}

/**
 * Snapshot mínimo de equipamento para preservar em runs — congelamento da
 * identidade usada naquela corrida. Sobrevive à aposentadoria do equipamento
 * (que é soft-delete com 5a retenção) e eventual cleanup pós-retenção.
 */
export interface EquipamentoSnapshot {
  id: string;
  name: string;
  modelo: string;
  fabricante: string;
  numeroSerie?: string;
}

export function buildEquipamentoSnapshot(e: Equipamento): EquipamentoSnapshot {
  const snap: EquipamentoSnapshot = {
    id: e.id,
    name: e.name,
    modelo: e.modelo,
    fabricante: e.fabricante,
  };
  if (e.numeroSerie) snap.numeroSerie = e.numeroSerie;
  return snap;
}
