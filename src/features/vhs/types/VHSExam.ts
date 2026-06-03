import type { Timestamp } from 'firebase/firestore';

/**
 * Status do exame de VHS no fluxo de dupla verificacao.
 * RDC 978 Art. 128 — todo resultado exige conferencia por segundo operador
 * ou Responsavel Tecnico antes da liberacao.
 */
export type VHSStatus = 'pendente' | 'liberado' | 'divergente' | 'cancelado';

/**
 * Metodologia de leitura da VHS.
 * Westergren = metodo de referencia; automatizado = equipamento dedicado.
 */
export type VHSMetodo = 'westergren' | 'automatizado';

/**
 * Leitura individual da VHS (mm/h) com assinatura do operador.
 * RDC 978 Art. 128 — cada leitura deve identificar o operador e ser
 * atestada (SHA-256) para rastreabilidade ponta-a-ponta.
 */
export interface VHSLeitura {
  /** Valor em mm/h */
  valor: number;
  /** uid Firebase Auth do operador */
  operadorId: string;
  /** Nome do operador no momento da leitura (snapshot) */
  operadorNome: string;
  /** Timestamp do server no save */
  ts: Timestamp | null;
  /** SHA-256 hex (64 chars) — assinatura logica */
  assinatura: string;
}

/**
 * Divergencia entre leitura 1 e leitura 2.
 * Gerada automaticamente quando |delta| > tolerancia (3 mm/h).
 */
export interface VHSDivergencia {
  /** leitura2.valor - leitura1.valor (com sinal) */
  delta: number;
  /** Tolerancia fixa em mm/h */
  tolerancia: number;
}

/**
 * Documento de exame de VHS.
 * RDC 978 Art. 128 — exige dupla verificacao: operador 1 faz a leitura,
 * operador 2 (ou RT em caso de divergencia) confere antes da liberacao.
 */
export interface VHSExam {
  id: string;
  labId: string;
  pacienteId?: string;
  pacienteNome?: string;
  /** Identificador da amostra (livre — codigo de barras, numero interno etc) */
  amostraId: string;
  /** Primeira leitura (obrigatoria no create) */
  leitura1: VHSLeitura;
  /** Segunda leitura — null enquanto nao realizada */
  leitura2: VHSLeitura | null;
  /** Estado atual no fluxo regulatório */
  status: VHSStatus;
  /** Preenche automaticamente quando |delta| > tolerancia */
  divergencia?: VHSDivergencia;
  metodo: VHSMetodo;
  equipamentoId?: string;
  observacoes?: string;
  // auditoria
  criadoEm: Timestamp | null;
  /** uid do operador que fez a leitura 1 */
  criadoPor: string;
  /** Quando status passa a 'liberado' */
  liberadoEm?: Timestamp | null;
  /** uid do operador 2 ou RT que liberou */
  liberadoPor?: string;
  canceladoEm?: Timestamp | null;
  canceladoPor?: string;
  canceladoMotivo?: string;
}

/**
 * DTO para criar o exame com a primeira leitura.
 * Campos gerados pelo server (ts, assinatura) sao omitidos.
 */
export interface VHSExamInputLeitura1 {
  pacienteId?: string;
  pacienteNome?: string;
  amostraId: string;
  leitura1: Omit<VHSLeitura, 'ts' | 'assinatura'> & {
    valor: number;
    operadorId: string;
    operadorNome: string;
  };
  metodo: VHSMetodo;
  equipamentoId?: string;
  observacoes?: string;
}

/**
 * DTO para adicionar a segunda leitura a um exame existente.
 */
export interface VHSExamInputLeitura2 {
  leitura2: { valor: number; operadorId: string; operadorNome: string };
}

/**
 * DTO para liberacao de exame divergente pelo RT/admin.
 * RDC 978 Art. 128 — liberacao de resultado divergente exige justificativa
 * documentada e identificacao do responsavel.
 */
export interface VHSLiberarInput {
  /** true quando RT esta liberando um exame marcado como divergente */
  divergente: boolean;
  /** Obrigatorio quando divergente=true; minimo 10 caracteres */
  motivo?: string;
}
