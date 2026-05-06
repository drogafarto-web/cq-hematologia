/**
 * Reclamacoes (Feedback Loop) Domain Types
 *
 * Central export barrel for all complaint, suggestion, satisfaction, and LGPD types.
 */

// ─── Complaint Domain ──────────────────────────────────────────────────────────
export type {
  LogicalSignature,
  ChainHashEntry,
  ConsentimentoLgpd,
  CanalEntrada,
  OrigemDados,
  Reclamante,
  AnexoReclamacao,
  ClassificacaoAuto,
  TipoReclamacao,
  SeveridadeReclamacao,
  AreaResponsavel,
  Classificacao,
  PorquePergunta,
  RCAFiveWhys,
  AcaoCorretiva,
  Resolucao,
  ComunicacaoCliente,
  StatusNC,
  StatusReclamacao,
  Reclamacao,
  ReclamacaoVersion,
  CreateReclamacaoInput,
  UpdateReclamacaoInput,
} from './reclamacao';

// ─── RCA Domain ────────────────────────────────────────────────────────────────
export type {
  RCAValidationResult,
  RCAHeuristicResult,
  RCATemplate,
  RCAEngine,
} from './rca';

// ─── Suggestion Domain ─────────────────────────────────────────────────────────
export type {
  CategoriasugestaoSugestao,
  StatusSugestao,
  TipoAutor,
  ComentarioSugestao,
  Sugestao,
  CreateSugestaoInput,
  UpdateSugestaoInput,
} from './sugestao';

// ─── Satisfaction Domain ───────────────────────────────────────────────────────
export type {
  NPSCategoria,
  OrigemNPS,
  CampanhaSatisfacao,
  NPSResposta,
  CampanhaTrimestralConfig,
  CreateNPSRespostaInput,
  UpdateNPSRespostaInput,
  CreateCampanhaSatisfacaoInput,
} from './satisfacao';

// ─── LGPD Domain ──────────────────────────────────────────────────────────────
export type {
  BaseLegal,
  TipoLgpdRequest,
  StatusLgpdRequest,
  LgpdRequest,
  LgpdAuditLog,
  ReclamacaoAnonimizada,
  NPSRespostaAnonimizada,
  DadosPacienteLgpd,
  CreateLgpdRequestInput,
  CreateLgpdAuditLogInput,
} from './lgpd';
