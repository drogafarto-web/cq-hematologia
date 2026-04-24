import type { LabId, LogicalSignature, Timestamp, UserId } from './_shared_refs';

// ─── Unions reutilizáveis ─────────────────────────────────────────────────────

export type Modalidade = 'presencial' | 'online' | 'em_servico';
export type Unidade = 'fixa' | 'itinerante' | 'ambas';
export type Periodicidade =
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual';

/**
 * Tipo regulatório do treinamento (ISO 15189:2022 cl. 6.2 + RDC 978/2025).
 *
 * Cada tipo tem gatilho e obrigação regulatória distinta:
 *   - `periodico`             — recorrente com periodicidade obrigatória (Art. 126)
 *   - `integracao`            — onboarding de colaborador novo (cl. 6.2.2)
 *   - `novo_procedimento`    — após criação/revisão de POP/MRT (cl. 5.5)
 *   - `equipamento`           — implantação ou atualização de equipamento (cl. 5.3.2)
 *   - `acao_corretiva`        — pós-NC (cl. 8.7 + FR-013); exige ncOrigemId + ncOrigemColecao
 *   - `pontual`               — esporádico sem gatilho fixo
 *   - `capacitacao_externa`   — curso/congresso externo; exige certificadoExternoUrl
 */
export type TipoTreinamento =
  | 'periodico'
  | 'integracao'
  | 'novo_procedimento'
  | 'equipamento'
  | 'acao_corretiva'
  | 'pontual'
  | 'capacitacao_externa';

/** Coleção alvo da FK `ncOrigemId` — par obrigatório quando tipo='acao_corretiva'. */
export type NcOrigemColecao = 'avaliacoesEficacia' | 'avaliacoesCompetencia';

export type ExecucaoStatus = 'planejado' | 'realizado' | 'adiado' | 'cancelado';

export type ResultadoEficacia = 'eficaz' | 'ineficaz';

export type MetodoAvaliacaoCompetencia =
  | 'observacao_direta'
  | 'teste_escrito'
  | 'simulacao_pratica'
  | 'revisao_registro';

export type ResultadoCompetencia =
  | 'aprovado'
  | 'reprovado'
  | 'requer_retreinamento';

export type StatusAlertaVencimento = 'pendente' | 'notificado' | 'resolvido';

// ─── Entidades persistidas ────────────────────────────────────────────────────

export interface Colaborador {
  readonly id: string;
  readonly labId: LabId;
  nome: string;
  cargo: string;
  setor: string;
  ativo: boolean;
  readonly criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export interface Treinamento {
  readonly id: string;
  readonly labId: LabId;
  titulo: string;
  tema: string;
  /** Em horas. */
  cargaHoraria: number;
  modalidade: Modalidade;
  unidade: Unidade;
  responsavel: string;
  /** Obrigatória apenas quando `tipo === 'periodico'`. Omitida nos demais tipos. */
  periodicidade?: Periodicidade;
  ativo: boolean;
  /**
   * Tipo regulatório (Fase 10). Documentos antigos sem este campo são mapeados
   * como `'periodico'` para preservar comportamento pré-Fase 10.
   */
  tipo: TipoTreinamento;
  /** Usado por tipo='integracao' — colaborador específico alvo do onboarding. */
  colaboradorAlvoId?: string;
  /** Usado por tipo='novo_procedimento' — ex: "POP-012 Rev.03". */
  popVersao?: string;
  /** Usado por tipo='equipamento' — string livre, ex: "Sysmex XN-550 #SN12345" (sem FK cross-module). */
  equipamentoNome?: string;
  /** Par obrigatório com ncOrigemColecao quando tipo='acao_corretiva' (FR-013). */
  ncOrigemId?: string;
  ncOrigemColecao?: NcOrigemColecao;
  /** Obrigatório quando tipo='capacitacao_externa' — URL externa ou Firebase Storage. */
  certificadoExternoUrl?: string;
  /** ID do template de origem (Fase 6). Marker — herança não-locked, campos editáveis. */
  templateId?: string;
  readonly criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export interface Execucao {
  readonly id: string;
  readonly labId: LabId;
  readonly treinamentoId: string;
  dataPlanejada: Timestamp;
  dataAplicacao: Timestamp | null;
  ministrante: string;
  pauta: string;
  status: ExecucaoStatus;
  /** ID da execução original — preenchido quando esta é um reagendamento (RN-01). */
  origemReagendamento?: string;
  /** ID do template que originou esta execução (Fase 6). Marker de origem; opcional. */
  templateId?: string;
  assinatura: LogicalSignature;
  readonly criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export interface Participante {
  readonly id: string;
  readonly labId: LabId;
  readonly execucaoId: string;
  readonly colaboradorId: string;
  presente: boolean;
  assinatura: LogicalSignature;
  deletadoEm: Timestamp | null;
}

export interface AvaliacaoEficacia {
  readonly id: string;
  readonly labId: LabId;
  readonly execucaoId: string;
  resultado: ResultadoEficacia;
  evidencia: string;
  dataAvaliacao: Timestamp;
  dataFechamento: Timestamp | null;
  /** Obrigatório quando resultado === 'ineficaz' — alimenta FR-013 (RN-02). */
  acaoCorretiva?: string;
  assinatura: LogicalSignature;
  deletadoEm: Timestamp | null;
}

export interface AvaliacaoCompetencia {
  readonly id: string;
  readonly labId: LabId;
  readonly execucaoId: string;
  readonly colaboradorId: string;
  metodo: MetodoAvaliacaoCompetencia;
  resultado: ResultadoCompetencia;
  avaliadorId: UserId;
  dataAvaliacao: Timestamp;
  evidencia: string;
  /** Obrigatório quando resultado === 'reprovado'. */
  proximaAvaliacaoEm?: Timestamp;
  assinatura: LogicalSignature;
  deletadoEm: Timestamp | null;
}

export interface AlertaVencimento {
  readonly id: string;
  readonly labId: LabId;
  readonly treinamentoId: string;
  dataVencimento: Timestamp;
  status: StatusAlertaVencimento;
  diasAntecedencia: number;
}

// ─── Input DTOs ───────────────────────────────────────────────────────────────
// Payloads aceitos pelo service layer. Campos de identidade e auditoria são
// preenchidos exclusivamente por ecFirebaseService — o caller nunca os envia.

export type ColaboradorInput = Omit<
  Colaborador,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

export type TreinamentoInput = Omit<
  Treinamento,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

export type ExecucaoInput = Omit<
  Execucao,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

export type ParticipanteInput = Omit<Participante, 'id' | 'labId' | 'deletadoEm'>;

export type AvaliacaoEficaciaInput = Omit<
  AvaliacaoEficacia,
  'id' | 'labId' | 'deletadoEm'
>;

export type AvaliacaoCompetenciaInput = Omit<
  AvaliacaoCompetencia,
  'id' | 'labId' | 'deletadoEm'
>;

export type AlertaVencimentoInput = Omit<AlertaVencimento, 'id' | 'labId'>;

// ─── Helpers de discriminação ─────────────────────────────────────────────────

/** Entidades soft-deletable — todas as entidades do módulo exceto AlertaVencimento (ciclo de vida via `status`). */
export type SoftDeletable =
  | Colaborador
  | Treinamento
  | Execucao
  | Participante
  | AvaliacaoEficacia
  | AvaliacaoCompetencia
  | TemplateTreinamento
  | KitIntegracao;

// ─── FASE 6 — Biblioteca de Templates + Materiais Didáticos ──────────────────

export type TipoMaterial = 'pdf' | 'video' | 'link' | 'apresentacao';

export interface MaterialDidatico {
  readonly id: string;
  tipo: TipoMaterial;
  titulo: string;
  /** Firebase Storage download URL ou URL externa (vídeo, link). */
  url: string;
  /** Path no Firebase Storage para `pdf`/`apresentacao` carregados via upload. Permite delete posterior. */
  storagePath?: string;
  tamanhoBytes?: number;
  uploadEm: Timestamp;
}

export interface TemplateTreinamento {
  readonly id: string;
  readonly labId: LabId;
  titulo: string;
  tema: string;
  /** "Ao final, o colaborador será capaz de…" */
  objetivo: string;
  cargaHoraria: number;
  modalidade: Modalidade;
  periodicidade: Periodicidade;
  /** Pauta padrão reutilizável. */
  pauta: string;
  /** Ex: ["biossegurança", "coleta", "rdc978"]. Busca por includes case-insensitive. */
  tags: string[];
  /** Contador incremental — começa em 1, +1 a cada update. */
  versao: number;
  materialDidatico: MaterialDidatico[];
  ativo: boolean;
  readonly criadoEm: Timestamp;
  atualizadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export interface KitIntegracao {
  readonly id: string;
  readonly labId: LabId;
  /** Ex: "Kit Biomédico Júnior". */
  nome: string;
  /** Cargo alvo do kit. */
  cargo: string;
  /** Sequência ordenada de templates a aplicar. */
  templateIds: string[];
  ativo: boolean;
  readonly criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export type TemplateTreinamentoInput = Omit<
  TemplateTreinamento,
  'id' | 'labId' | 'versao' | 'criadoEm' | 'atualizadoEm' | 'deletadoEm'
>;

export type KitIntegracaoInput = Omit<KitIntegracao, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>;

export type MaterialDidaticoInput = Omit<MaterialDidatico, 'id' | 'uploadEm'>;

// ─── FASE 7 — Trilhas de Aprendizado + Onboarding Digital ────────────────────

export type StatusProgressoTrilha = 'em_andamento' | 'concluida' | 'pausada';
export type StatusProgressoEtapa = 'pendente' | 'agendado' | 'realizado' | 'aprovado';

export interface EtapaTrilha {
  ordem: number;
  templateId: string;
  /** Prazo em dias após início da trilha (ou etapa anterior). */
  prazoEmDias: number;
  obrigatoria: boolean;
}

export interface TrilhaAprendizado {
  readonly id: string;
  readonly labId: LabId;
  nome: string;
  descricao: string;
  cargo: string;
  etapas: EtapaTrilha[];
  ativo: boolean;
  readonly criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export interface ProgressoEtapa {
  templateId: string;
  execucaoId?: string;
  status: StatusProgressoEtapa;
  dataRealizacao?: Timestamp;
}

export interface ProgressoTrilha {
  readonly id: string;
  readonly labId: LabId;
  readonly colaboradorId: string;
  readonly trilhaId: string;
  dataInicio: Timestamp;
  status: StatusProgressoTrilha;
  etapas: ProgressoEtapa[];
  /** Percentual derivado 0-100. Re-calculado a cada update. */
  percentualConcluido: number;
  dataConclusao?: Timestamp;
  deletadoEm: Timestamp | null;
}

export type TrilhaAprendizadoInput = Omit<
  TrilhaAprendizado,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

export type ProgressoTrilhaInput = Omit<
  ProgressoTrilha,
  'id' | 'labId' | 'deletadoEm'
>;

// ─── FASE 8 — Banco de Questões + Avaliação Automática ───────────────────────

export type TipoQuestao = 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';
export type StatusAvaliacaoTeste = 'em_andamento' | 'submetido' | 'corrigido';

/** Opção visível ao cliente — SEM `correta`. Correção fica em `questoesGabarito`. */
export interface OpcaoQuestaoPublica {
  readonly id: string;
  texto: string;
}

export interface Questao {
  readonly id: string;
  readonly labId: LabId;
  templateId: string;
  enunciado: string;
  tipo: TipoQuestao;
  /** Visível ao cliente (sem gabarito). Presente em multipla_escolha e verdadeiro_falso. */
  opcoes?: OpcaoQuestaoPublica[];
  pontuacao: number;
  ordem: number;
  ativo: boolean;
  readonly criadoEm: Timestamp;
}

/**
 * Gabarito server-only. Coleção separada (`questoesGabarito`) com rules
 * `allow read: if false` no cliente. Admin SDK (via callable ec_submeterTeste)
 * lê e corrige. NUNCA expor estes campos no cliente.
 */
export interface QuestaoGabarito {
  readonly id: string;
  readonly labId: LabId;
  readonly questaoId: string;
  /** IDs de opções corretas (múltipla escolha / v-f). */
  opcoesCorretas?: string[];
  /** Gabarito livre para dissertativas (usado por revisor manual). */
  gabaritoTexto?: string;
}

export interface RespostaAvaliacao {
  readonly id: string;
  readonly labId: LabId;
  readonly avaliacaoTesteId: string;
  readonly colaboradorId: string;
  readonly questaoId: string;
  /** Para dissertativas. */
  respostaTexto?: string;
  /** Para objetivas: id da opção escolhida. */
  opcaoId?: string;
  /** Preenchido pelo callable após correção; `null` para dissertativas pendentes. */
  correta: boolean | null;
  pontuacaoObtida: number;
  respondidaEm: Timestamp;
}

export interface AvaliacaoTeste {
  readonly id: string;
  readonly labId: LabId;
  readonly execucaoId: string;
  readonly colaboradorId: string;
  status: StatusAvaliacaoTeste;
  pontuacaoTotal: number;
  percentualAcerto: number;
  /** threshold: percentualAcerto >= 70 (hard-coded MVP; configurável futuro). */
  aprovado: boolean;
  iniciadoEm: Timestamp;
  submetidoEm?: Timestamp;
  corrigidoEm?: Timestamp;
}

/** Input para criar questão via callable (inclui gabarito — server separa). */
export interface OpcaoQuestaoInput {
  texto: string;
  correta: boolean;
}

export interface QuestaoInput {
  templateId: string;
  enunciado: string;
  tipo: TipoQuestao;
  opcoes?: OpcaoQuestaoInput[];
  /** Gabarito livre para dissertativas. */
  gabaritoTexto?: string;
  pontuacao: number;
  ordem: number;
  ativo: boolean;
}

// ─── FASE 9 — Certificados + Configuração de Alertas ─────────────────────────

export interface CertificadoConfig {
  readonly labId: LabId;
  nomeDoLab: string;
  logoUrl?: string;
  assinaturaResponsavelUrl?: string;
  textoRodape: string;
}

export interface Certificado {
  readonly id: string;
  readonly labId: LabId;
  readonly colaboradorId: string;
  readonly treinamentoId: string;
  readonly execucaoId: string;
  readonly avaliacaoCompetenciaId: string;
  /** URL pública de verificação via QR: `.../validarCertificadoEc?id={certId}`. */
  qrCodePayload: string;
  /** URL do PDF armazenado no Storage. */
  pdfStoragePath: string;
  pdfDownloadUrl: string;
  readonly emitidoEm: Timestamp;
  readonly geradoPor: UserId;
}

export interface ConfiguracaoAlerta {
  readonly labId: LabId;
  diasAntecedenciaVencimento: number;
  emailResponsavel: boolean;
  emailColaborador: boolean;
  /** "HH:mm" no fuso America/Sao_Paulo. */
  horaEnvio: string;
  /** Lista opcional de emails adicionais para CC. */
  emailsCopia?: string[];
}

export type CertificadoConfigInput = Omit<CertificadoConfig, 'labId'>;
export type ConfiguracaoAlertaInput = Omit<ConfiguracaoAlerta, 'labId'>;
