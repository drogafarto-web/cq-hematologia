/**
 * ControlTemperatura — modelo de dados v2 do módulo FR-11 / PQ-06.
 *
 * Versão v2 (2026-04-24):
 *   - `Termometro` agora tem `calibracaoAtual` + `historicoCalibracoes[]`
 *     (RN-09: renovação encadeada, nunca deleta histórico).
 *   - `EquipamentoMonitorado.termometroId` é FK real (antes era `termometroNumeroSerie`).
 *   - `statusCalibracao` derivado: 'valido' | 'vencendo' | 'vencido' (RN-05).
 *   - Import XLSX em batch (RN-10) — ver ctXlsxService.
 *
 * Conforme:
 *   - RDC 978/2025 (rastreabilidade e guarda de 5 anos)
 *   - ISO 15189:2022 cl. 5.3 (controle ambiental) + cl. 5.3.1 (metrologia)
 *   - ANVISA — Gestão de Materiais e Infraestrutura
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

/** Estado derivado da calibração vigente do termômetro (RN-05). */
export type StatusCalibracao = 'valido' | 'vencendo' | 'vencido';

// ─── Configuração ─────────────────────────────────────────────────────────────

export interface ConfiguracaoCalendarioDia {
  obrigatorio: boolean;
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
  nome: string;
  tipo: TipoEquipamento;
  localizacao: string;
  /** FK para `Termometro.id`. Troca rastreável — v1 usava numeroSerie. */
  termometroId: string;
  limites: LimitesAceitabilidade;
  calendario: ConfiguracaoCalendario;
  status: StatusEquipamento;
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
  modelo: string;
  intervaloEnvioMinutos: number;
  ultimaTransmissao: Timestamp | null;
  online: boolean;
  firmwareVersao: string;
  /** SHA-256 hex (64 chars) do token plain. Plain nunca persistido. */
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
  temperaturaMax: number;
  temperaturaMin: number;
  foraDosLimites: boolean;
  origem: OrigemLeitura;
  dispositivoIoTId?: string;
  status: StatusLeitura;
  justificativaPerdida?: string;
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

// ─── Calibração & Termômetro ──────────────────────────────────────────────────

/**
 * Certificado de calibração emitido por laboratório de metrologia credenciado
 * (ISO 15189:2022 cl. 5.3.1). Cada renovação cria nova versão, a anterior é
 * arquivada (RN-09) mas nunca deletada — rastreabilidade metrológica integral.
 */
export interface CertificadoCalibracao {
  versao: number;
  dataEmissao: Timestamp;
  dataValidade: Timestamp;
  /** Download URL do Firebase Storage (PDF). Opcional na criação — upload depois. */
  certificadoUrl?: string;
  laboratorioCalibrador: string;
  /** Identificador emitido pelo laboratório (ex: CERT-2026-TM0012). */
  numeroCertificado: string;
  /** Preenchido quando esta versão é substituída por outra. */
  arquivadoEm?: Timestamp;
}

export type CertificadoCalibracaoInput = Omit<CertificadoCalibracao, 'versao' | 'arquivadoEm'>;

export interface Termometro {
  id: string;
  labId: LabId;
  numeroSerie: string;
  modelo: string;
  fabricante: string;
  /** Incerteza expandida em °C (ex: 0.5 → ±0.5°C). */
  incertezaMedicao: number;
  /** Versão vigente da calibração — usada pra checks e rodapé metrológico. */
  calibracaoAtual: CertificadoCalibracao;
  /**
   * Todas as calibrações, incluindo a vigente (v == calibracaoAtual.versao).
   * Array ordenado por versao asc. Append-only — RN-09 garante.
   */
  historicoCalibracoes: CertificadoCalibracao[];
  ativo: boolean;
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

/**
 * Input de criação — caller passa o primeiro certificado sem versao/arquivadoEm
 * (service atribui versao=1). `numeroSerie/modelo/fabricante/incertezaMedicao` +
 * `ativo` completam a entidade.
 */
export interface TermometroInput {
  numeroSerie: string;
  modelo: string;
  fabricante: string;
  incertezaMedicao: number;
  calibracaoAtual: CertificadoCalibracaoInput;
  ativo: boolean;
}

// ─── Derivações usadas pelo dashboard ─────────────────────────────────────────

export type StatusCardEquipamento = 'verde' | 'amarelo' | 'vermelho' | 'cinza';

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
