/**
 * ControlTemperatura — modelo de dados do módulo FR-11 / PQ-06.
 *
 * Conforme:
 *   - RDC 978/2025 (rastreabilidade e guarda de 5 anos)
 *   - ISO 15189:2022 cl. 5.3 (controle ambiental de infraestrutura)
 *   - ANVISA — Gestão de Materiais e Infraestrutura
 *
 * Todas as entidades carregam `labId` redundantemente para defense-in-depth
 * nas rules e para permitir auditoria cross-tenant via collectionGroup.
 * Deleção é sempre lógica (RN-07) — campo `deletadoEm` nunca omitido.
 */

import type { LabId, LogicalSignature, Timestamp } from './_shared_refs';

// ─── Domínios / unions ────────────────────────────────────────────────────────

export type TipoEquipamento =
  | 'geladeira'
  | 'freezer'
  | 'freezer_ultrabaixo'
  | 'sala'
  | 'banho_maria'
  | 'estufa'
  | 'incubadora'
  | 'outro';

export type StatusEquipamento = 'ativo' | 'manutencao' | 'inativo';

export type OrigemLeitura = 'manual' | 'automatica_iot';

export type StatusLeitura = 'realizada' | 'perdida' | 'justificada';

export type TurnoLeitura = 'manha' | 'tarde' | 'noite' | 'automatica';

export type StatusLeituraPrevista = 'pendente' | 'realizada' | 'perdida' | 'justificada';

export type LimiteViolado = 'max' | 'min' | 'umidade';

export type StatusNC = 'aberta' | 'em_andamento' | 'resolvida';

// ─── Configuração ─────────────────────────────────────────────────────────────

export interface ConfiguracaoCalendarioDia {
  obrigatorio: boolean;
  /** Lista de horários no formato "HH:mm" (24h). Ex: ["08:00", "14:00", "18:00"]. */
  horarios: string[];
}

export interface ConfiguracaoCalendario {
  diasUteis: ConfiguracaoCalendarioDia;
  sabado: ConfiguracaoCalendarioDia;
  domingo: ConfiguracaoCalendarioDia;
  feriados: ConfiguracaoCalendarioDia;
}

export interface LimitesAceitabilidade {
  temperaturaMin: number;
  temperaturaMax: number;
  umidadeMin?: number;
  umidadeMax?: number;
}

// ─── EquipamentoMonitorado ────────────────────────────────────────────────────

export interface EquipamentoMonitorado {
  id: string;
  labId: LabId;
  /** Ex: "Geladeira Reagentes Sala 2". */
  nome: string;
  tipo: TipoEquipamento;
  /** Ex: "Setor Bioquímica". */
  localizacao: string;
  /** Número de série do termômetro instalado — vínculo com Termometro.numeroSerie. */
  termometroNumeroSerie: string;
  limites: LimitesAceitabilidade;
  calendario: ConfiguracaoCalendario;
  status: StatusEquipamento;
  /** Vincula a um DispositivoIoT se o equipamento tiver coleta automática. */
  dispositivoIoTId?: string;
  observacoes?: string;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export type EquipamentoInput = Omit<
  EquipamentoMonitorado,
  'id' | 'labId' | 'criadoEm' | 'atualizadoEm' | 'deletadoEm'
>;

// ─── DispositivoIoT ───────────────────────────────────────────────────────────

export interface DispositivoIoT {
  id: string;
  labId: LabId;
  equipamentoId: string;
  macAddress: string;
  /** Ex: "ESP32+DHT22". */
  modelo: string;
  /** Periodicidade nominal. Offline = silêncio > 2× este valor (RN-06). */
  intervaloEnvioMinutos: number;
  ultimaTransmissao: Timestamp | null;
  /** Derivado por regra (RN-06). Persistido para consulta rápida no dashboard. */
  online: boolean;
  firmwareVersao: string;
  /**
   * Hash SHA-256 do token entregue ao ESP32. O token plain-text NUNCA é
   * armazenado — é exibido uma única vez ao operador na criação e precisa ser
   * flasheado no firmware. Endpoint IoT autentica comparando hashes.
   */
  tokenAcesso: string;
  ativo: boolean;
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export type DispositivoInput = Omit<
  DispositivoIoT,
  'id' | 'labId' | 'ultimaTransmissao' | 'online' | 'criadoEm' | 'deletadoEm'
>;

// ─── LeituraTemperatura ───────────────────────────────────────────────────────

export interface LeituraTemperatura {
  id: string;
  labId: LabId;
  equipamentoId: string;
  dataHora: Timestamp;
  turno: TurnoLeitura;
  temperaturaAtual: number;
  umidade?: number;
  /** Termômetro de máxima — só zerado manualmente após registro. */
  temperaturaMax: number;
  /** Termômetro de mínima — só zerado manualmente após registro. */
  temperaturaMin: number;
  /** Derivado automaticamente no service comparando com limites do equipamento. */
  foraDosLimites: boolean;
  origem: OrigemLeitura;
  dispositivoIoTId?: string;
  status: StatusLeitura;
  /** Preenchido quando status === 'justificada'. */
  justificativaPerdida?: string;
  /** Obrigatório quando origem === 'manual' (RN-02). */
  assinatura?: LogicalSignature;
  observacao?: string;
  deletadoEm: Timestamp | null;
}

export type LeituraInput = Omit<
  LeituraTemperatura,
  'id' | 'labId' | 'foraDosLimites' | 'deletadoEm'
>;

// ─── LeituraPrevista ──────────────────────────────────────────────────────────

export interface LeituraPrevista {
  id: string;
  labId: LabId;
  equipamentoId: string;
  dataHoraPrevista: Timestamp;
  turno: TurnoLeitura;
  status: StatusLeituraPrevista;
  /** Preenchido quando status === 'realizada'. */
  leituraId?: string;
}

export type LeituraPrevistaInput = Omit<LeituraPrevista, 'id' | 'labId'>;

// ─── NaoConformidadeTemp ──────────────────────────────────────────────────────

export interface NaoConformidadeTemp {
  id: string;
  labId: LabId;
  leituraId: string;
  equipamentoId: string;
  temperaturaRegistrada: number;
  limiteViolado: LimiteViolado;
  descricao: string;
  acaoImediata: string;
  acaoCorretiva?: string;
  responsavelAcao: string;
  dataAbertura: Timestamp;
  dataResolucao?: Timestamp;
  status: StatusNC;
  assinatura: LogicalSignature;
  deletadoEm: Timestamp | null;
}

export type NCInput = Omit<
  NaoConformidadeTemp,
  'id' | 'labId' | 'dataAbertura' | 'deletadoEm'
>;

// ─── Termometro ───────────────────────────────────────────────────────────────

export interface Termometro {
  id: string;
  labId: LabId;
  numeroSerie: string;
  modelo: string;
  fabricante: string;
  /** Incerteza expandida em °C (ex: 0.5 → ±0.5°C). */
  incertezaMedicao: number;
  dataUltimaCalibracao: Timestamp;
  proximaCalibracao: Timestamp;
  /** Download URL do Firebase Storage — certificado PDF. */
  certificadoUrl?: string;
  ativo: boolean;
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export type TermometroInput = Omit<
  Termometro,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

// ─── Derivações usadas pelo dashboard ─────────────────────────────────────────

export type StatusCardEquipamento =
  | 'verde' /* dentro dos limites, última leitura recente */
  | 'amarelo' /* pendente — última leitura antiga */
  | 'vermelho' /* fora dos limites OU dispositivo offline */
  | 'cinza' /* inativo ou em manutenção */;

export interface CardStatusEquipamento {
  equipamento: EquipamentoMonitorado;
  statusCard: StatusCardEquipamento;
  ultimaLeitura: LeituraTemperatura | null;
  dispositivo: DispositivoIoT | null;
  ncsAbertas: number;
  motivo: string;
}

export interface IndicadorConformidade {
  equipamentoId: string;
  nomeEquipamento: string;
  totalPrevisto: number;
  totalRealizado: number;
  totalPerdido: number;
  percentualConformidade: number;
  leiturasForaDosLimites: number;
}
