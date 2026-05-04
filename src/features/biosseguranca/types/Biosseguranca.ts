/**
 * Módulo: Biossegurança (RH + Infra)
 *
 * Gestão de áreas de risco, níveis de biossegurança (NB1-NB4),
 * equipamentos de proteção (EPE) e conformidade ISO 14644.
 *
 * Firestore path: /labs/{labId}/biosseguranca/{areaId}
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Enums ────────────────────────────────────────────────────────────────

export type BiosseguridadeNivel = 1 | 2 | 3 | 4;
export type StatusArea = 'ativa' | 'desativada' | 'em_manutencao';
export type TipoEPE = 'luva' | 'mascara' | 'jaleco' | 'oculos' | 'avental' | 'propé' | 'touca' | 'outro';

export const NIVEL_LABEL: Record<BiosseguridadeNivel, string> = {
  1: 'NB1 — Risco mínimo',
  2: 'NB2 — Risco moderado',
  3: 'NB3 — Risco sério',
  4: 'NB4 — Risco extremo',
};

export const STATUS_LABEL: Record<StatusArea, string> = {
  ativa: 'Ativa',
  desativada: 'Desativada',
  em_manutencao: 'Em Manutenção',
};

// ─── Entity — Area de Biossegurança ────────────────────────────────────────

export interface Area {
  readonly id: string;
  readonly labId: string;

  nome: string;
  descricao?: string;
  nivelBiosseguranca: BiosseguridadeNivel;
  status: StatusArea;

  // ISO 14644 classification (cleanroom)
  classeISO?: number; // ISO 14644-1: 1-9

  // EPE requirements for this area
  epeObrigatorio: TipoEPE[];

  // Capacidade
  capacidadeMaximaPessoas?: number;
  pessoasAtuais: number;

  // Certificações
  certificadoValidade?: Timestamp;
  inspetorResponsavel?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

// ─── Entity — EPE (Equipamento de Proteção) ───────────────────────────────

export interface EPE {
  readonly id: string;
  readonly labId: string;

  tipo: TipoEPE;
  descricao: string;
  marca?: string;
  lote?: string;

  dataFabricacao: Timestamp;
  dataValidade: Timestamp;

  qtdEstoque: number;
  qtdMinima: number;

  status: 'em_uso' | 'descartado' | 'inutilizado';

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

// ─── Entity — Inspeção de Área ─────────────────────────────────────────────

export interface InspecaoArea {
  readonly id: string;
  readonly labId: string;

  areaId: string;
  areaNome: string;
  data: Timestamp;
  inspetor: string;

  conformidades: {
    limpeza: boolean;
    ventilacao: boolean;
    pressao: boolean;
    filtros: boolean;
    EPEDisponiveis: boolean;
  };

  observacoes?: string;
  necessitaManutencao: boolean;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
}

// ─── Request/Response ──────────────────────────────────────────────────────

export type AreaInput = Omit<
  Area,
  | 'id'
  | 'labId'
  | 'pessoasAtuais'
  | 'criadoEm'
  | 'criadoPor'
  | 'deletadoEm'
>;

export interface AreaCreationRequest {
  labId: string;
  nome: string;
  nivelBiosseguranca: BiosseguridadeNivel;
  epeObrigatorio: TipoEPE[];
}

export type EPEInput = Omit<EPE, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'>;

export interface InspecaoAreaRequest {
  labId: string;
  areaId: string;
  conformidades: InspecaoArea['conformidades'];
  observacoes?: string;
}

// ─── Filters ──────────────────────────────────────────────────────────────

export interface BiossegurancaFilters {
  status?: StatusArea;
  nivelMinimo?: BiosseguridadeNivel;
  areaId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function epeVencida(epe: EPE, now: Date = new Date()): boolean {
  return epe.dataValidade.toDate().getTime() < now.getTime();
}

export function epeEstoque(epe: EPE): 'critico' | 'baixo' | 'ok' {
  if (epe.qtdEstoque === 0) return 'critico';
  if (epe.qtdEstoque <= epe.qtdMinima) return 'baixo';
  return 'ok';
}

export function diasAteVencimentoEPE(epe: EPE, now: Date = new Date()): number {
  const diff = epe.dataValidade.toDate().getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function areaConformidade(inspecao: InspecaoArea): number {
  const checks = Object.values(inspecao.conformidades);
  const conformes = checks.filter((c) => c === true).length;
  return Math.round((conformes / checks.length) * 100);
}
