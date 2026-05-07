import type { LabId, UserId, Timestamp } from './shared_refs';

// ─── Enumerations ────────────────────────────────────────────────────────────

export type Criticidade = 'baixa' | 'media' | 'alta';
export type ResultadoAvaliacao = 'aprovado' | 'aprovado_com_ressalva' | 'reprovado';

// ─── Entidades persistidas ───────────────────────────────────────────────────

/**
 * Exame terceirizado.
 * Mapeado com código de tabela, descrição, e tempo de turnaround.
 */
export interface ExameItem {
  codigo: string; // e.g., "01001" (TUSS/CBPO)
  descricao: string; // e.g., "Glicose"
  tat: number; // turnaround time em horas
}

/**
 * Certificação/habilitação do laboratório de apoio.
 * ex: ISO 15189, ISO 17043, habilitação específica.
 */
export interface Certificacao {
  id: string;
  nome: string;
  dataValidade: Timestamp | null;
  ativo: boolean;
}

/**
 * Contato direto do laboratório de apoio.
 */
export interface Contato {
  id: string;
  nome: string;
  funcao: string; // e.g., "Gerente de Qualidade"
  telefone?: string;
  email: string;
}

/**
 * Endereço estruturado.
 */
export interface Endereco {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string; // UF
  cep: string;
}

/**
 * Avaliação periódica (RDC 978 Art. 39).
 * Immutable history-preserving append.
 */
export interface AvaliacaoPeriodica {
  id: string;
  data: Timestamp;
  resultado: ResultadoAvaliacao;
  responsavel: UserId; // FK para educacao-continuada/{labId}/colaboradores
  responsavelNome: string; // snapshot
  observacoes?: string;
  anexoUrl?: string;
}

/**
 * Contrato de laboratório de apoio.
 *
 * RN-LABAPOIO-01: (labId, cnpj) único entre não-deletados
 * RN-LABAPOIO-02: vigenciaInicio < vigenciaFim
 * RN-LABAPOIO-03: habilitacaoAnvisa não-vazio (min 6 chars)
 * RN-LABAPOIO-04: soft-delete only (RN-06)
 * RN-LABAPOIO-05: assinatura server-side na criação
 * RN-LABAPOIO-06: chainHash contínuo em events subcoleção
 * RN-LABAPOIO-07: avaliacoes append-only history-preserving
 */
export interface Contrato {
  readonly id: string;
  readonly labId: LabId;
  /** Razão social do laboratório de apoio */
  nome: string;
  /** Razão social (alias ou nome adicional) */
  razaoSocial: string;
  /** CNPJ: 14 dígitos com checksum validado */
  cnpj: string;
  /** AVS (Autorização Válida da Supervisa) — habilitação Anvisa */
  habilitacaoAnvisa: string;
  /** Data início vigência (ISO string YYYY-MM-DD) */
  vigenciaInicio: string;
  /** Data fim vigência (ISO string YYYY-MM-DD) */
  vigenciaFim: string;
  /** Criticidade do exame terceirizado */
  criticidade: Criticidade;
  /** Array de exames terceirizados */
  exames: ExameItem[];
  /** Endereço completo */
  endereco: Endereco;
  /** Certificações ativas (ISO 15189, etc) */
  certificacoes: Certificacao[];
  /** Contatos do laboratório */
  contatos: Contato[];
  /** Observações gerais */
  observacoes?: string;
  /** URL do contrato em PDF (Storage) */
  anexoContratoUrl?: string;
  /** Tamanho em bytes do anexo */
  anexoContratoSize?: number;
  /** Histórico de avaliações periódicas (anual) */
  avaliacaoPeriodica: AvaliacaoPeriodica[];
  /** Próxima avaliação agendada */
  proximaAvaliacaoEm: Timestamp | null;
  /** Flag ativo (contratos vencidos podem ser marcados como inativos) */
  ativo: boolean;
  /** Assinatura server-side gerada na criação */
  logicalSignature: {
    hash: string;
    operatorId: string;
    ts: Timestamp;
  };
  readonly criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

/**
 * Input DTO para criar contrato.
 * Omite campos imutáveis + server-generated.
 */
export type ContratoInput = Omit<
  Contrato,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'logicalSignature' | 'proximaAvaliacaoEm' | 'avaliacaoPeriodica'
> & {
  avaliacaoPeriodica?: AvaliacaoPeriodica[];
  proximaAvaliacaoEm?: Timestamp | null;
};

/**
 * Update DTO para editar contrato.
 * Apenas observacoes, contatos, certificacoes são editáveis (append-only).
 */
export type ContratoUpdateInput = {
  observacoes?: string;
  contatos?: Contato[];
  certificacoes?: Certificacao[];
};

/**
 * Filtros para queries de contratos.
 */
export interface LabApoioFilters {
  ativo?: boolean;
  criticidade?: Criticidade;
  vencendo?: boolean; // vigenciaFim dentro de 90 dias
  semavaliacaoAnual?: boolean; // proximaAvaliacaoEm < today
  includeDeleted?: boolean;
}

/**
 * Evento de auditoria registrado em subcoleção /labs/{labId}/lab-apoio/{contratoId}/events/.
 */
export interface LabApoioAuditEvent {
  readonly id: string;
  /** Tipo: 'created' | 'updated' | 'avaliacao-registrada' | 'anexo-uploaded' | 'softdeleted' */
  tipo: 'created' | 'updated' | 'avaliacao-registrada' | 'anexo-uploaded' | 'softdeleted';
  /** Operador que gerou o evento */
  operadorId: string;
  /** Timestamp do evento */
  timestamp: Timestamp;
  /** Mudanças (para 'updated') */
  mudancas?: {
    campo: string;
    anterior: string | null;
    novo: string | null;
  }[];
  /** Chain hash — SHA-256 do evento anterior + canonical payload deste */
  chainHash: string;
  /** Previous chain hash para validação de continuidade */
  chainHashAnterior: string | null;
}
