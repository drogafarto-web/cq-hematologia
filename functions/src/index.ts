import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import * as admin from 'firebase-admin';
import { syncClaims, syncModuleClaims } from './helpers/claims';

// CRÍTICO: setGlobalOptions DEVE ser chamado ANTES de qualquer import/export
// de módulo com Cloud Functions. Os re-exports abaixo executam os
// `onCall`/`onDocumentWritten` dos arquivos importados — sem a região global
// setada antes, as functions herdam o default `us-central1` (bug histórico
// do Onda 2/4/5: provisionModulesClaims, onHematologiaRunAudit, etc.
// acabaram em us-central1 enquanto o client chama southamerica-east1).
setGlobalOptions({ region: 'southamerica-east1' });

// Initialize Admin SDK once — runtime may reuse warm instances
if (!admin.apps.length) {
  admin.initializeApp();
}

// ─── emailBackup module ───────────────────────────────────────────────────────
// Re-export so Firebase CLI discovers scheduledDailyBackup and triggerLabBackup.
export { scheduledDailyBackup, triggerLabBackup } from './modules/emailBackup/index';

// ─── cqiReport module ────────────────────────────────────────────────────────
// Re-export so Firebase CLI discovers scheduledDailyCQIReport and triggerCQIReport.
export { scheduledDailyCQIReport, triggerCQIReport } from './modules/cqiReport/index';

// ─── firestoreBackup module ──────────────────────────────────────────────────
// Daily Firestore export to GCS + manual SuperAdmin trigger. Complements PITR.
export {
  scheduledFirestoreExport,
  triggerFirestoreExport_onCall as triggerFirestoreExport,
} from './modules/firestoreBackup/index';
export { scheduledVerifyBackupIntegrity } from './modules/firestoreBackup/verifyIntegrity';

// ─── Data migrations (one-time and scheduled) ────────────────────────────────
export { scheduledMigrateNotaFiscalDates } from './scheduledMigrateNotaFiscalDates';

// ─── insumos module ──────────────────────────────────────────────────────────
// Scheduled expiration: move insumos vencidos (validadeReal < now) de 'ativo'
// para 'vencido'. Manual trigger disponível para admin/owner do lab.
// Chain hash: trigger onDocumentCreated sela criptograficamente cada
// movimentação de insumo em ordem canônica (tamper-evidence RDC 978/2025).
// validateFR10: endpoint HTTP público consultado via QR do FR-10 impresso.
export {
  scheduledExpireInsumos,
  triggerInsumosExpiration,
  onInsumoMovimentacaoCreate,
  validateFR10,
  triggerBackfillInsumoModulos,
} from './modules/insumos/index';

// ─── lotsMigration module (Fase B — 2026-04-28) ──────────────────────────────
// Migração one-time idempotente /lots → /insumos com tipo='controle'.
// Resolve a duplicação de modelo identificada na auditoria 2026-04-27.
// Mantém /lots intacto como backup. SuperAdmin-only.
export { triggerLotsMigration } from './modules/lotsMigration/index';

// ─── equipamentos module (Fase D — 2026-04-21) ───────────────────────────────
// Note: Legacy equipment migration (Setups → Equipamentos) handled in backfill phase
// Scheduled cleanup for expired equipment deferred to Wave 2

// ─── admin module (Onda 2 + onda superadmin temporário) ──────────────────────
// provisionModulesClaims: varre users e provisiona claim `modules` com dry-run.
// grantTemporarySuperAdminToAll / revokeTemporarySuperAdmin: ferramenta
// AUTORIZADA explicitamente para período de testes 2026-04-22. Snapshot
// reversível em `temp/superadmin-grant/snapshots`.
export { provisionModulesClaims } from './modules/admin/provisionModulesClaims';
export {
  grantTemporarySuperAdminToAll,
  revokeTemporarySuperAdmin,
} from './modules/admin/temporarySuperAdmin';

// ─── audit module (ADR 0005 — cryptoAudit helper) ───────────────────────────
// Centralizes HMAC-SHA256 + chain-hash validation. Resolves V-009 duplication.
// validateChainIntegrityScheduled: scheduled 12h validator.
// validateChainIntegrityOnDemand: callable for admin debugging.
export {
  validateChainIntegrityScheduled,
  validateChainIntegrityOnDemand,
} from './modules/audit/chainHashValidator';

// ─── ciqAudit module (Onda 4) ────────────────────────────────────────────────
// Triggers onDocumentWritten em runs (hemato + imuno) e insumos — derivam
// CIQAuditEvent e gravam em `labs/{labId}/ciq-audit` com hash chain tamper-evident.
// Alimenta a Seção 3 do relatório operacional (anexo operacional do email diário).
export {
  onHematologiaRunAudit,
  onImunoRunAudit,
  onInsumoLifecycleAudit,
} from './modules/ciqAudit/index';

// ─── signatures module (Onda 5) ──────────────────────────────────────────────
// Dual-write de HMAC server-side em runs + movimentações. Divergências viram
// auditLogs. Rules endurecem após janela de observação (7-14 dias).
export {
  onHematologiaRunSignature,
  onImunoRunSignature,
  onMovimentacaoSignature,
} from './modules/signatures/index';

// ─── compliance module ───────────────────────────────────────────────────────
// Trigger onCreate em runs hematológicas revalida insumos declarados. Runs sem
// `complianceOverride` e com reagente vencido/reprovado/inativo recebem flag
// `complianceViolation` + audit log. Defesa em profundidade — UI valida mas o
// server é a fonte de verdade regulatória (RDC 978/2025 Art.128).
export { onHematologiaRunComplianceCheck } from './modules/compliance/index';

// ─── controleTemperatura module (FR-11 / PQ-06) ──────────────────────────────
// registrarLeituraIoT            — HTTP público consumido por ESP32/sensores.
//                                  Autentica via hash SHA-256 do X-Device-Token,
//                                  grava leitura + NC automática em batch,
//                                  marca LeituraPrevista próxima como realizada.
// scheduledGenerateLeiturasPrevistas — 01:00 SP diário, gera previsões do
//                                      próximo dia por equipamento ativo (RN-03).
// scheduledMarcarLeiturasPerdidas    — a cada 30min, marca previsões pendentes
//                                      com >1h de atraso como 'perdida' (RN-04).
export {
  registrarLeituraIoT,
  scheduledGenerateLeiturasPrevistas,
  scheduledMarcarLeiturasPerdidas,
} from './modules/ctIoT/index';

// ─── insumoQualificacao module (PR1 — 2026-04-26) ────────────────────────────
// approveQualificacao / reproveQualificacao: callables sign-and-write RT-only
// que decidem formalmente o lote (Imuno PR1). Reprovação dispara
// status='segregado' + bloqueia uso normal. onInsumoQualificacaoCreate
// re-valida assinatura SHA-256 server-side e cria alerta em /alertas/ se inválida.
export {
  approveQualificacao,
  reproveQualificacao,
  onInsumoQualificacaoCreate,
} from './modules/insumoQualificacao/index';

// ─── controleTemperatura callables (Fase 0b equivalente EC) ──────────────────
// ct_commitLeitura: sign-and-write atomic de leitura manual. Substitui geração
// client-side de assinatura (CT-01). Server valida claim + re-lê limites +
// deriva foraDosLimites + cria NC automática em batch. rules/{leituras,ncs}
// vão pra `allow create: if false` — só server cria.
export { ct_commitLeitura } from './modules/controleTemperatura/index';

// ─── educacaoContinuada module (Fase 0b — 2026-04-24) ────────────────────────
// 6 callables que migram a geração de assinatura de client-side (compliance
// theater — RDC 978 reprovaria) para server-side. Hooks do módulo passam a
// chamar estas callables; service layer fica intocada para rollback.
//   ec_mintSignature              — assinatura em lote (ExecucaoForm + Import XLSX)
//   ec_commitExecucaoRealizada    — RN-03 + RN-05, batch atomic (exec + N participantes + alerta)
//   ec_commitExecucaoAdiada       — RN-01, batch atomic
//   ec_registrarAvaliacaoEficacia — RN-02 (ineficaz+fechar exige acaoCorretiva)
//   ec_fecharAvaliacaoEficacia    — re-aplica RN-02 na transição
//   ec_registrarAvaliacaoCompetencia — ISO 15189 + auto-injeta avaliadorId
export {
  ec_mintSignature,
  ec_commitExecucaoRealizada,
  ec_commitExecucaoAdiada,
  ec_registrarAvaliacaoEficacia,
  ec_fecharAvaliacaoEficacia,
  ec_registrarAvaliacaoCompetencia,
  // Fase 8 — Banco de Questões + correção server-side (RN-10)
  ec_criarQuestao,
  ec_arquivarQuestao,
  ec_submeterTeste,
  // Fase 9 — Certificados + alertas email
  ec_gerarCertificado,
  validarCertificadoEc,
  ec_scheduledAlertasVencimento,
  // Fase 7 trigger — RN-08 server-side (substitui observer client em 2026-04-24)
  ec_onColaboradorCreated,
  // 2026-04-24 — defense-in-depth + soft-delete cascade
  ec_onParticipanteCreated,
  ec_softDeleteExecucaoCascade,
} from './modules/educacaoContinuada/index';

// ─── turnos module (Phase 0 / Plan 00-01 — RDC 978 Art. 122) ─────────────────
// Supervisor shift registry (manhã / tarde / noite / plantão) with chainHash-validated
// audit trail. DL-1 — callables from day 1 (no client-side writes).
//   turnos_createTurno              — create with server-side signature + supervisor snapshot
//   turnos_updateTurno              — edit observações + supervisorName (post-backfill)
//   turnos_softDeleteTurno          — logical delete only (RN-TURNO-04)
//   turnos_backfill90Days           — admin-only backfill for last 90d × 4 periodos
//   onTurnoEventCreated             — Firestore trigger, computes chainHash per event
export {
  turnos_createTurno,
  turnos_updateTurno,
  turnos_softDeleteTurno,
  turnos_backfill90Days,
  onTurnoEventCreated,
} from './modules/turnos/index';

// ─── lab-apoio module (Phase 0 / Plan 00-03 — RDC 978 Arts. 36–39) ────────────
// Support lab contracts (CNPJ + AVS habilitação + vigência + exames + annual eval).
// DL-1 — callables from day 1 (no client-side writes).
//   labApoio_createContrato         — create with CNPJ validation + server-side signature
//   labApoio_updateContrato         — edit observações + contatos + certificacoes (append-only)
//   labApoio_softDeleteContrato     — logical delete only (RN-LABAPOIO-04)
//   labApoio_registrarAvaliacaoPeriodica — append annual evaluation (Art. 39)
//   labApoio_uploadContratoAnexo    — register PDF URL + size (Storage pre-validates)
//   labApoio_checkExpiry            — scheduled cron: 60d/30d/7d/0d alerts (email + in-app)
//   onContratoEventCreated          — Firestore trigger, computes chainHash per event
export {
  labApoio_createContrato,
  labApoio_updateContrato,
  labApoio_softDeleteContrato,
  labApoio_registrarAvaliacaoPeriodica,
  labApoio_uploadContratoAnexo,
  labApoio_checkExpiry,
  onContratoEventCreated,
} from './modules/labApoio';

// ─── risks module (Phase 0 / Plan 00-04 — DICQ 4.14.6 + RDC 978 Art. 86) ────────
// Living risk register with FMEA-lite scoring (P × S × D, NPR 1–125), 5×5 heatmap,
// periodic review automation (annual + monthly top-5), treatment tracking.
// ADR-0016 documents methodology + escape hatch (ISO 31000 v1.5).
// DL-1 — callables from day 1 (no client-side writes).
//   risks_createRisk                — create with server-side NPR + signature
//   risks_updateRisk                — mutate P/S/D (NPR recomputed server-side)
//   risks_softDeleteRisk            — logical delete (reject if status=fechado)
//   risks_registrarRevisao          — append review (reclassificado recomputes NPR)
//   risks_seedFromCsv               — admin-only bulk import (stretch, optional)
//   onRiskEventCreated              — Firestore trigger, computes chainHash per event
//   scheduledReview                 — cron: daily 07:00 BRT (annual) + monthly top-5
export {
  risks_createRisk,
  risks_updateRisk,
  risks_softDeleteRisk,
  risks_registrarRevisao,
  onRiskEventCreated,
  scheduledReview,
} from './modules/risks/index';

// ─── qualidade module (ADR 0003 — Não-Conformidade) ─────────────────────────
// Lifecycle management for quality incidents (Não-Conformidades).
// openNaoConformidade: create NC with audit trail
// updateNaoConformidade: progress NC through workflow (aberta → investig → correcao → verif → fechada)
export {
  openNaoConformidade,
  updateNaoConformidade,
  addAcao,
} from './modules/qualidade/naoConformidade';

// ─── procedimentos module (ADR 0004 — POP Versioning & RT Signatures) ────────
// Standard Operating Procedure (POP) versioning with RT cryptographic signatures.
// createPOP: creates new procedure document
// createPOPVersion: creates versioned content with em_revisao status
// assinaturaRT: RT-only signature + approval, marks version as ativa
// Signatures use HMAC-SHA256 server-side (defense-in-depth).
export {
  createPOP,
  createPOPVersion,
  assinaturaRT,
  recordarTreinamentoPOP,
} from './modules/procedimentos/pop';

// ─── bioquimica module (Phase 9 — CIQ Quantitativo) ─────────────────────────
// parseBulaBioquimica: Gemini 2.5 Flash multimodal PDF parsing for control material
// applyBulaToLot: atomic application of parsed bula data to ControlMaterial
// recordRunBioquimica (Plan 09-04): Callable that records CIQ runs server-side
//   - Validates membership, executes Westgard CLSI, calculates chainHash
//   - Returns violations + metadata for UI re-render
// onRunCreated: Firestore trigger that records append-only traceability events
// generateMonthlyReportBioquimica: Scheduled function (1st of month) generating FR-001 reports
export {
  parseBulaBioquimica,
  applyBulaToLot,
  recordRunBioquimica,
  onRunCreated,
  generateMonthlyReportBioquimica,
} from './bioquimica/index';

// ─── liberacao module (Phase 10 — Report Release + Critical Values) ───────────
// criarLaudo: Callable that creates report + runs auto-release engine
//   - Validates membership, detects critical values, classifies exam type
//   - Auto-liberates routine exams without blockers (Westgard, critical, restricted)
//   - Creates LaudoVersion v1 with system signature if auto-released
// liberarLaudo: Callable that releases report manually (RT only)
//   - Validates RT claim, recalculates chainHash server-side
//   - Creates LaudoVersion v(N+1) with RT signature
//   - Transitions status: Pendente/Em Revisão → Liberado
// detectarCriticos: Firestore trigger onCreate on laudos
//   - Detects critical values against configurable thresholds
//   - Flags laudo + dispatches email notification
// enviarComunicacaoEmail: Callable that sends email via Resend
//   - Constructs HTML email with critical results
//   - Creates Comunicacao doc with delivery status
// generateLaudoPDF: Puppeteer-based PDF rendering for liberated laudo versions
//   - 14 RDC 978 Art. 167 fields, QR validation in footer, watermark
//   - Uploads to Cloud Storage + returns signed URL (1h default expiration)
//   - Updates LaudoVersion with pdfUrl + pdfHash
// validarLaudoPublico: HTTPS public endpoint for QR-coded validation
//   - Returns metadata-only (no PII) — hash, RT, version, isCurrent, lab
//   - Rate-limited 60 req/h/IP (Firestore counter)
//   - HTML default + JSON for Accept: application/json
export {
  criarLaudo,
  liberarLaudo,
  detectarCriticos,
  enviarComunicacaoEmail,
  generateLaudoPDF,
  validarLaudoPublico,
} from './liberacao/index';

// ─── auditoria module (ADR 0004 — Internal Audit + Findings → NC Auto-gen) ────
// createAuditoria: create internal audit with scope and scheduled date
// registerAchado: record audit findings (grave/critica trigger NC auto-gen dialog)
// createPlanoAcao: action plan for closure (CAPA workflow)
// closeAuditoria: mark audit as fechada
// installChecklistTemplate: load DICQ template (~115 items) into audit session
// updateChecklistResponses: batch-sync offline checklist responses
// generateAuditReportPDF: Puppeteer server-side PDF generation (Wave 3) with ~115 items, achados, severity, NC links, RT signature
export {
  createAuditoria,
  registerAchado,
  createPlanoAcao,
  closeAuditoria,
  installChecklistTemplate,
  updateChecklistResponses,
  generateAuditReportPDF,
} from './modules/auditoria/index';

// ─── equipamentos module (ADR 0007 — Equipment Calibration Gate) ──────────────
// Equipment qualifications: calibration + maintenance scheduling
// criarEquipamento: create equipment record (admin/RT only)
// registrarCalibracacao: record calibration completion
// validarCalibracaoEquipamento: gate function, blocks CIQ runs if overdue
export {
  criarEquipamento,
  registrarCalibracacao,
  registrarManutencao,
} from './modules/equipamentos/index';

// ─── qualidade module — audit trail + CAPA workflow (ADR-0017 residual) ───────
// auditTrail: tamper-evident audit log (RDC 978 5.3 + DICQ 4.4)
// capaWorkflow: NC investigation → corrective action → effectiveness verification
export {
  logAction,
  getAuditTrail,
  validateChain,
  generateComplianceReport,
} from './modules/qualidade/auditTrail';
export {
  investigarNC,
  executarAcaoCorretiva,
  verificarEficacia,
} from './modules/qualidade/capaWorkflow';

// ─── pessoas module — qualificação de pessoal (RDC 978 Art. 122) ──────────────
export { criarQualificacao } from './modules/pessoas/qualificacao';

// ─── compras module — nota fiscal intake + recebimento ────────────────────────
export {
  criarNotaFiscal,
  confirmarRecebimento,
} from './modules/compras/notaFiscal';

// ─── personnel module (Phase 8 — Cargos + Designações) ────────────────────────
// Job descriptions (Cargos) + organizational designations (GQ/RT/Diretor) with
// LogicalSignature audit trail. DICQ 5.1.3 + 4.1.2.7 compliance.
// signDesignacao: sign-and-write designacao atomically with chain-hash
export { signDesignacao } from './modules/personnel/signDesignacao';

// ─── bioquimica module (Phase 9 — CIQ Bioquímica Foundation) ────────────────
// CIQ quantitativo bioquímica · 17 analitos seed · multi-instrumento ·
// Westgard CLSI subset (1-2s, 1-3s, 2-2s, R-4s).
// seedBioquimicaDefaults: idempotent seed of 17 default analitos for a lab.
// RDC 978/2025 Art. 179, 180, 181 + DICQ 4.3 Bloco F compliance.
export { seedBioquimicaDefaults } from './modules/bioquimica/seedBioquimicaDefaults';

// ─── management-review module (Phase 8 — DICQ 4.15 Annual Direction Analysis) ──
// Management review system with 15 mandatory sections, data aggregation, and signatures.
// generateReviewTemplate: pre-populate review form with live data from 7 collections
// submitReview: validate 15 sections and create signed review
export {
  generateReviewTemplate,
  submitReview,
} from './modules/management-review/index';

// ─── treinamentos module (Phase 2 Batch 2 — Training Registry) ──────────────
// criarTreinamento: schedule training linked to POP + instructor + participants
// registrarPresenca: attendance tracking with signatures
// emitirCertificado: issue certificates with validity tracking
export {
  criarTreinamento,
  registrarPresenca,
  emitirCertificado,
} from './modules/treinamentos/treinamentos';

// ─── pgrss module (Phase 2 Batch 2 — Waste Management RDC 222/2018) ─────────────
// registrarGeracao: record waste generation with type + quantity
// registrarColeta: collection tracking with evidence (PDF)
// validarSegregacao: check segregation rule violations
// gerarRelatorioMensal: monthly compliance report (scheduled)
export {
  registrarGeracao,
  registrarColeta,
  validarSegregacao,
  gerarRelatorioMensal,
} from './modules/pgrss/index';

// ─── kpis module (Phase 2 Batch 2 — Metrics Dashboard) ────────────────────────
// aggregateKPIs: daily scheduled aggregation (00:00 UTC)
//   - Turnaround (creation → release time)
//   - Rework% (repeat runs)
//   - Conformance% (popId + equipId + operadorId)
//   - NC origins (count by module)
//   - SLA compliance tracking + alerts
export { aggregateKPIs } from './modules/kpis/index';

// ─── lgpd module (Phase 2 Batch 2 — Data Privacy + Deletion) ─────────────────
// criarSolicitacao: initiate access/deletion/rectification requests (30-day SLA)
// processarExclusao: anonymization pipeline (hash PII, randomize names, archive, verify)
// gerarDPIA: Data Protection Impact Assessment template generation
// scheduledProcessarSolicitacoesVencidas: cleanup task for expired requests
export {
  criarSolicitacao,
  processarExclusao,
  gerarDPIA,
  scheduledProcessarSolicitacoesVencidas,
} from './modules/lgpd/index';

// ─── analytics module (Phase 3.1 — CIQ Compliance Aggregation) ───────────────
// aggregateAnalytics: scheduled hourly function that aggregates CIQ compliance
// metrics for all labs and caches results in Firestore.
// Cache: /labs/{labId}/analytics/cache/metrics/ciqCompliance
export { aggregateAnalytics } from './modules/analytics/aggregateDaily';

// generateDashboardPDF: callable (Phase 3.3) — Puppeteer snapshot of dashboard
// HTML → PDF → Cloud Storage signed URL. 2GiB / 300s.
export { generateDashboardPDF } from './modules/analytics/generateDashboardPDF';

// ─── export module (Phase 3.1 — Async Data Export) ───────────────────────────
// initiateExport: callable that validates auth, creates an export job in
// Firestore (status='queued'), and publishes to Pub/Sub topic 'exports'.
// exportWorker: Pub/Sub trigger subscribed to 'exports'; processes jobs,
// generates XLSX via SheetJS, uploads to Cloud Storage, returns signed URL.
export { initiateExport } from './modules/export/initiateExport';
export { exportWorker } from './modules/export/exportWorker';
// Phase 3.3 extensions: expanded worker + batch callable + scheduler
export { backgroundWorker } from './modules/export/backgroundWorker';
export { batchExport } from './modules/export/batchExport';
export { scheduledWeeklyExport } from './modules/export/scheduledExport';

// ─── reclamacoes module (Phase 11 — Feedback Loop / DICQ 4.8) ─────────────────
// Multi-channel complaint intake (6 channels), Gemini AI auto-classification,
// 5-Whys RCA workflow, NPS post-resolution, suggestions module.
// RDC 978 Art. 86 + LGPD compliance.
export {
  criarReclamacao,
  classificarReclamacaoIA,
  parseEmailReclamacao,
  criarNCDraft,
  transitarReclamacao,
} from './modules/reclamacoes/index';

// ─── satisfacao module (Phase 11 — NPS surveys) ────────────────────────────────
// NPS post-resolution, quarterly campaigns, response anonymization (LGPD).
export {
  dispararNPSPosResolucao,
  dispararNPSRecurring,
  npsEmailQueueHandler,
  submitNPSResposta,
  anonimizarRespostas,
} from './modules/satisfacao/index';

// ─── sugestoes module (Phase 11 — Improvement suggestions) ──────────────────────
// Internal + public suggestion intake, upvoting, workflow (aberta → analisada → implementada/rejeitada).
export {
  criarSugestao,
  transitarSugestao,
  upvoteSugestao,
} from './modules/sugestoes/index';

// ─── lgpd module (Phase 0 — LGPD Compliance) ────────────────────────────────────
// lgpd_scheduledAnnualReview: Scheduled function (07:00 America/Sao_Paulo) that checks
// for mandatory LGPD documents (POL-LGPD-001, IT-LGPD-DPIA-001) where proximaRevisao <= hoje.
// Creates notifications for upcoming reviews. Idempotent via idempotencyKey.
export { lgpd_scheduledAnnualReview } from './modules/lgpd/scheduledAnnualReview';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Checks custom claim first (fast, no Firestore read).
 * Falls back to Firestore for users created before syncClaims migration.
 */
async function assertSuperAdmin(uid: string, token?: Record<string, unknown>): Promise<void> {
  if (token?.isSuperAdmin === true) return;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.isSuperAdmin !== true) {
    throw new HttpsError(
      'permission-denied',
      'Acesso negado. Apenas Super Admins podem executar esta operação.',
    );
  }
}

/**
 * Checks that the caller is either a SuperAdmin OR an active admin/owner of
 * the given lab. Used to gate lab-scoped operations that lab admins should
 * also be able to perform (e.g. approving pending users).
 */
async function assertLabAdminOrSuperAdmin(
  uid: string,
  labId: string,
  token?: Record<string, unknown>,
): Promise<void> {
  if (token?.isSuperAdmin === true) return;
  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  if (userSnap.data()?.isSuperAdmin === true) return;

  const memberSnap = await admin.firestore().doc(`labs/${labId}/members/${uid}`).get();

  if (!memberSnap.exists || memberSnap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Acesso negado.');
  }
  const role = memberSnap.data()?.role;
  if (role !== 'admin' && role !== 'owner') {
    throw new HttpsError(
      'permission-denied',
      'Apenas administradores do laboratório podem executar esta operação.',
    );
  }
}

// ─── createUser ───────────────────────────────────────────────────────────────
// Creates a Firebase Auth user + Firestore document, optionally adding to a lab.
// Caller must be Super Admin. Current session is NOT disrupted.

const CreateUserInputSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  labId: z.string().optional(),
  role: z.enum(['admin', 'member']).optional(),
});

export const createUser = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = CreateUserInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }

  const { displayName, email, password, labId, role } = parsed.data;

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      // Admin-created accounts are pre-verified — the admin already validated
      // the email by creating the account manually. This avoids a verification
      // hurdle for users who receive their credentials from their lab admin.
      emailVerified: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('email-already-exists')) {
      throw new HttpsError('already-exists', 'Este e-mail já está cadastrado.');
    }
    throw new HttpsError('internal', `Falha ao criar usuário: ${msg}`);
  }

  const uid = userRecord.uid;
  const db = admin.firestore();
  const batch = db.batch();

  batch.set(db.doc(`users/${uid}`), {
    email,
    displayName,
    labIds: labId ? [labId] : [],
    roles: labId && role ? { [labId]: role } : {},
    isSuperAdmin: false,
    activeLabId: null,
    pendingLabId: null,
    disabled: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (labId && role) {
    batch.set(db.doc(`labs/${labId}/members/${uid}`), { role, active: true });
  }

  await batch.commit();

  // Audit — non-blocking
  db.collection('auditLogs')
    .add({
      action: 'CREATE_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      targetEmail: email,
      labId: labId ?? null,
      payload: {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { uid };
});

// ─── setUserDisabled ──────────────────────────────────────────────────────────
// Disables (disabled=true) or enables (disabled=false) a Firebase Auth account.
// Disabling immediately revokes all active sessions via token revocation.

const SetUserDisabledInputSchema = z.object({
  uid: z.string().min(1),
  disabled: z.boolean(),
});

export const setUserDisabled = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = SetUserDisabledInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { uid, disabled } = parsed.data;

  if (uid === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'Você não pode suspender sua própria conta.');
  }

  try {
    await admin.auth().updateUser(uid, { disabled });
    if (disabled) {
      await admin.auth().revokeRefreshTokens(uid);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('internal', `Falha ao atualizar conta: ${msg}`);
  }

  await admin.firestore().doc(`users/${uid}`).update({ disabled });

  admin
    .firestore()
    .collection('auditLogs')
    .add({
      action: disabled ? 'DISABLE_USER' : 'ENABLE_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      payload: { disabled },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── setUserSuperAdmin ────────────────────────────────────────────────────────
// Promotes or demotes a user to/from Super Admin.
// Syncs custom claims so the new privilege is reflected in the next token refresh.

const SetUserSuperAdminSchema = z.object({
  targetUid: z.string().min(1),
  isSuperAdmin: z.boolean(),
});

export const setUserSuperAdmin = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = SetUserSuperAdminSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, isSuperAdmin } = parsed.data;

  if (targetUid === request.auth.uid) {
    throw new HttpsError(
      'invalid-argument',
      'Você não pode alterar seu próprio nível de Super Admin.',
    );
  }

  // Update Firestore + sync custom claim atomically (serially is fine here)
  await admin.firestore().doc(`users/${targetUid}`).update({ isSuperAdmin });
  await syncClaims(targetUid, isSuperAdmin);

  admin
    .firestore()
    .collection('auditLogs')
    .add({
      action: isSuperAdmin ? 'PROMOTE_SUPERADMIN' : 'DEMOTE_SUPERADMIN',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      payload: { isSuperAdmin },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── addUserToLab ─────────────────────────────────────────────────────────────
// Adds a user as a member of a lab. Atomic batch write.

const AddUserToLabSchema = z.object({
  targetUid: z.string().min(1),
  labId: z.string().min(1),
  role: z.enum(['admin', 'member']),
});

export const addUserToLab = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = AddUserToLabSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, labId, role } = parsed.data;
  const db = admin.firestore();
  const batch = db.batch();

  batch.set(db.doc(`labs/${labId}/members/${targetUid}`), { role, active: true });

  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }
  const userData = userSnap.data()!;
  const labIds = (userData.labIds ?? []) as string[];

  batch.update(db.doc(`users/${targetUid}`), {
    labIds: labIds.includes(labId) ? labIds : [...labIds, labId],
    [`roles.${labId}`]: role,
  });

  await batch.commit();

  db.collection('auditLogs')
    .add({
      action: 'ADD_TO_LAB',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload: { role },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── updateUserLabRole ────────────────────────────────────────────────────────
// Changes a lab member's role. Blocks demoting the owner.

const UpdateUserLabRoleSchema = z.object({
  targetUid: z.string().min(1),
  labId: z.string().min(1),
  role: z.enum(['admin', 'member']),
});

export const updateUserLabRole = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = UpdateUserLabRoleSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, labId, role } = parsed.data;
  const db = admin.firestore();

  // Block demoting an owner
  const memberSnap = await db.doc(`labs/${labId}/members/${targetUid}`).get();
  if (memberSnap.exists && memberSnap.data()?.role === 'owner') {
    throw new HttpsError(
      'failed-precondition',
      'Não é possível rebaixar o proprietário do laboratório.',
    );
  }

  const batch = db.batch();
  batch.update(db.doc(`labs/${labId}/members/${targetUid}`), { role });
  batch.update(db.doc(`users/${targetUid}`), { [`roles.${labId}`]: role });
  await batch.commit();

  db.collection('auditLogs')
    .add({
      action: 'CHANGE_ROLE',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload: { role },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── removeUserFromLab ────────────────────────────────────────────────────────
// Removes a user from a lab. Atomic batch write.

const RemoveUserFromLabSchema = z.object({
  targetUid: z.string().min(1),
  labId: z.string().min(1),
});

export const removeUserFromLab = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = RemoveUserFromLabSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid, labId } = parsed.data;
  const db = admin.firestore();

  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  const userData = userSnap.data()!;
  const labIds = ((userData.labIds ?? []) as string[]).filter((id) => id !== labId);
  const roles = { ...(userData.roles ?? {}) };
  delete roles[labId];
  const updates: Record<string, unknown> = { labIds, roles };
  if (userData.activeLabId === labId) updates.activeLabId = null;

  const batch = db.batch();
  batch.delete(db.doc(`labs/${labId}/members/${targetUid}`));
  batch.update(db.doc(`users/${targetUid}`), updates);
  await batch.commit();

  db.collection('auditLogs')
    .add({
      action: 'REMOVE_FROM_LAB',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      labId,
      payload: {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── deleteUser ───────────────────────────────────────────────────────────────
// Permanently deletes a Firebase Auth account + all Firestore data.
// Cascades to lab memberships across all labs.

const DeleteUserSchema = z.object({
  targetUid: z.string().min(1),
});

export const deleteUser = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = DeleteUserSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.');
  }

  const { targetUid } = parsed.data;

  if (targetUid === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'Você não pode deletar sua própria conta.');
  }

  const db = admin.firestore();

  // Read user doc to get lab memberships before deleting
  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }
  const userData = userSnap.data()!;
  const targetEmail = userData.email as string;
  const labIds = (userData.labIds ?? []) as string[];

  // Delete Firebase Auth account first — point of no return
  try {
    await admin.auth().deleteUser(targetUid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('internal', `Falha ao deletar conta de autenticação: ${msg}`);
  }

  // Cascade: delete /labs/{labId}/members/{targetUid} for every lab
  const batch = db.batch();
  for (const labId of labIds) {
    batch.delete(db.doc(`labs/${labId}/members/${targetUid}`));
  }
  // Delete Firestore user document
  batch.delete(db.doc(`users/${targetUid}`));
  await batch.commit();

  // Audit — non-blocking
  db.collection('auditLogs')
    .add({
      action: 'DELETE_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid,
      targetEmail,
      payload: { labsRemoved: labIds },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── setModulesClaims ─────────────────────────────────────────────────────────
// Grants or revokes module access for a user by writing to Firebase Auth custom
// claims. Only Super Admins may call this function.
//
// Claim shape written:  { ...existingClaims, modules: { hematologia: true, ... } }
// Firestore mirror:     users/{uid}.modules  (read-only reference for UI — never
//                       use this for auth enforcement; always read the JWT claim)
//
// After a successful response the client MUST call:
//   await auth.currentUser.getIdToken(true)
// to force-refresh the JWT before attempting module-gated Firestore reads.

const SetModulesClaimsSchema = z.object({
  uid: z.string().min(1),
  modules: z.record(z.string(), z.boolean()),
});

export const setModulesClaims = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  await assertSuperAdmin(request.auth.uid, request.auth.token as Record<string, unknown>);

  const parsed = SetModulesClaimsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }

  const { uid, modules } = parsed.data;

  // Verify the target user actually exists before touching claims
  try {
    await admin.auth().getUser(uid);
  } catch {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  // Mirror in Firestore for UI reference only (dashboard module tiles).
  // Authorization is enforced exclusively through the JWT custom claim.
  await admin.firestore().doc(`users/${uid}`).update({ modules });

  // Merge with existing claims (preserves isSuperAdmin + any future flags)
  await syncModuleClaims(uid, modules);

  admin
    .firestore()
    .collection('auditLogs')
    .add({
      action: 'SET_MODULE_CLAIMS',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      payload: { modules },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── Server-side secrets ──────────────────────────────────────────────────────

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const openRouterApiKey = defineSecret('OPENROUTER_API_KEY');

const GEMINI_DIRECT = 'gemini-3.1-flash-image-preview';

// ─── Descoberta dinâmica de modelos OpenRouter ───────────────────────────────
// Em vez de fixar slugs (que ficam obsoletos quando OpenRouter publica versões
// novas), buscamos o catálogo `/api/v1/models` e ordenamos por preço crescente,
// restrito a famílias com track record de OCR multimodal. Cache em memória
// (1h TTL) evita overhead em cada request — cold start refaz a query.
//
// Whitelist: só famílias com qualidade comprovada em vision/OCR. Adicionar
// nova família aqui é a forma SEGURA de ampliar o pool quando um provedor
// novo (ex: DeepSeek-VL, Pixtral 2) entrar em produção. Ordem dos patterns
// não importa — a ordenação é por preço.
const VISION_MODEL_WHITELIST_PATTERNS: RegExp[] = [
  /^qwen\/qwen.*-vl[-/]/i,           // Qwen VL family (qwen-vl-plus, qwen3-vl-*, etc.)
  /^qwen\/qwen3\.5-plus/i,           // Qwen3.5 Plus (multimodal text+image+video)
  /^qwen\/qwen3\.6.*plus/i,          // Qwen3.6 Plus quando ficar multimodal
  /^google\/gemini-(?:2|2\.5|3)/i,   // Gemini 2.x e 3.x (vision nativo)
  /^anthropic\/claude-(?:3|sonnet|haiku|opus)/i, // Claude 3+ com vision
  /^openai\/gpt-4o/i,                // GPT-4o e variantes
  /^deepseek\/deepseek-vl/i,         // DeepSeek VL (quando disponível)
  /^mistralai\/pixtral-/i,           // Pixtral (Mistral vision)
];

// Limite de sanidade: rejeitar modelos com custo médio > $5/1M tokens
// (= 5e-6 USD/token). Protege contra escolher acidentalmente um modelo
// de "preview" experimental cobrando $50/1M.
const MAX_REASONABLE_AVG_COST_PER_TOKEN = 5e-6;

// Quantos modelos da lista ranked tentar antes de desistir.
const MAX_FALLBACK_ATTEMPTS = 4;

interface ORCatalogModel {
  id?: string;
  name?: string;
  pricing?: { prompt?: string | number; completion?: string | number };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

interface RankedVisionModel {
  id: string;
  promptCost: number;     // USD per token
  completionCost: number; // USD per token
  avgCost: number;
}

interface CatalogCache {
  models: RankedVisionModel[];
  expires: number;
}

const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000; // 1h
let CATALOG_CACHE: CatalogCache | null = null;

function parseCost(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function isVisionCapable(m: ORCatalogModel): boolean {
  const inputs = m.architecture?.input_modalities ?? [];
  if (inputs.some((x) => /image|vision/i.test(x))) return true;
  const modality = m.architecture?.modality ?? '';
  return /image|vision|multimodal/i.test(modality);
}

function isWhitelistedFamily(id: string): boolean {
  return VISION_MODEL_WHITELIST_PATTERNS.some((re) => re.test(id));
}

/** Lista de fallback hardcoded — usada quando catálogo OpenRouter está fora do ar. */
const STATIC_FALLBACK_MODELS: RankedVisionModel[] = [
  { id: 'google/gemini-2.0-flash-001',         promptCost: 1e-7,  completionCost: 4e-7,  avgCost: 2.5e-7 },
  { id: 'qwen/qwen3-vl-235b-a22b-instruct',    promptCost: 2e-7,  completionCost: 8.8e-7, avgCost: 5.4e-7 },
  { id: 'qwen/qwen3.5-plus',                   promptCost: 4e-7,  completionCost: 2.4e-6, avgCost: 1.4e-6 },
];

async function fetchVisionModelsRanked(openRouterKey: string): Promise<RankedVisionModel[]> {
  if (CATALOG_CACHE && CATALOG_CACHE.expires > Date.now()) {
    return CATALOG_CACHE.models;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${openRouterKey}` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { data?: ORCatalogModel[] };
    const all = json.data ?? [];

    const ranked: RankedVisionModel[] = [];
    for (const m of all) {
      if (!m.id) continue;
      if (!isVisionCapable(m)) continue;
      if (!isWhitelistedFamily(m.id)) continue;
      const promptCost = parseCost(m.pricing?.prompt);
      const completionCost = parseCost(m.pricing?.completion);
      // Excluir free tier — queremos pago confiável (free pode ter rate limits agressivos).
      if (promptCost === 0 && completionCost === 0) continue;
      if (!Number.isFinite(promptCost) || !Number.isFinite(completionCost)) continue;
      const avgCost = (promptCost + completionCost) / 2;
      if (avgCost > MAX_REASONABLE_AVG_COST_PER_TOKEN) continue;
      ranked.push({ id: m.id, promptCost, completionCost, avgCost });
    }
    ranked.sort((a, b) => a.avgCost - b.avgCost);

    if (ranked.length === 0) {
      console.warn('⚠️ Catálogo OpenRouter retornou zero modelos elegíveis. Usando fallback estático.');
      CATALOG_CACHE = { models: STATIC_FALLBACK_MODELS, expires: Date.now() + CATALOG_CACHE_TTL_MS };
      return STATIC_FALLBACK_MODELS;
    }

    console.log(
      `📚 Catálogo OpenRouter: ${ranked.length} modelos vision elegíveis. Top 3: ` +
        ranked.slice(0, 3).map((m) => `${m.id} ($${(m.avgCost * 1e6).toFixed(3)}/1M)`).join(', '),
    );
    CATALOG_CACHE = { models: ranked, expires: Date.now() + CATALOG_CACHE_TTL_MS };
    return ranked;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Falha ao buscar catálogo OpenRouter (${msg}). Usando fallback estático.`);
    // Não cacheamos a falha — próxima chamada tenta de novo.
    return STATIC_FALLBACK_MODELS;
  }
}

// ─── AI Service Helper ────────────────────────────────────────────────────────
// Logic for calling Gemini with failover to OpenRouter (Qwen)

/** Multimodal message part accepted by OpenRouter's chat completions endpoint. */
type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

/** Minimal shape of an OpenRouter chat.completions response we consume. */
interface OpenRouterChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

// ─── JSON Hardening ──────────────────────────────────────────────────────────
// LLMs notoriamente devolvem JSON com sujeira: markdown fences, trailing commas,
// truncamento por max-tokens, comentários, aspas inteligentes. Esta camada de
// proteção tenta 3 estratégias antes de desistir, por isso o cliente nunca mais
// vê "Expected ',' or '}' after property value in JSON at position N".
// Incidente original: 2026-04-27 — corrida Yumizen H550 abortou no JSON.parse cru.
function safeParseAIJson(rawText: string): { ok: true; data: unknown } | { ok: false; reason: string; raw: string } {
  if (!rawText || !rawText.trim()) {
    return { ok: false, reason: 'resposta vazia', raw: rawText };
  }

  // 1. Strip de markdown fences e texto ao redor do JSON
  let s = rawText.trim();
  s = s.replace(/^```(?:json|JSON)?\s*/i, '').replace(/\s*```\s*$/i, '');
  // Pega o primeiro { até o último } (descarta lixo antes/depois do bloco JSON)
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  // 2. Tentativa direta após sanitização
  try {
    return { ok: true, data: JSON.parse(s) };
  } catch {
    /* segue para repair */
  }

  // 3. Repair via jsonrepair (resolve trailing commas, aspas faltantes, etc.)
  try {
    const repaired = jsonrepair(s);
    return { ok: true, data: JSON.parse(repaired) };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'repair falhou',
      raw: rawText,
    };
  }
}

// ─── Schemas Gemini-native (Type API) ────────────────────────────────────────
// Quando passados via `responseSchema`, o Gemini garante saída em conformidade
// com o schema — eliminando ~95% dos casos de JSON inválido.

const ANALYTE_KEYS = [
  'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'RDW',
  'PLT', 'MPV', 'PDW', 'PCT',
  'WBC', 'NEU#', 'LYM#', 'MON#', 'EOS#', 'BAS#', 'NLR',
] as const;

function buildOcrResponseSchema() {
  const valuesProps: Record<string, unknown> = {};
  const confProps: Record<string, unknown> = {};
  for (const key of ANALYTE_KEYS) {
    valuesProps[key] = { type: Type.NUMBER, nullable: true };
    confProps[key] = { type: Type.STRING, enum: ['high', 'medium', 'low'] };
  }
  return {
    type: Type.OBJECT,
    properties: {
      sampleId: { type: Type.STRING, nullable: true },
      values: { type: Type.OBJECT, properties: valuesProps },
      fieldConfidence: { type: Type.OBJECT, properties: confProps },
      overallConfidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    },
    required: ['values'],
  };
}

const STRIP_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    resultado: { type: Type.STRING, enum: ['R', 'NR'] },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
  },
  required: ['resultado', 'confidence'],
};

async function callAIWithFallback(params: {
  prompt: string;
  base64: string;
  mimeType: string;
  geminiKey: string;
  openRouterKey: string;
  /** Schema nativo do Gemini para forçar JSON estruturado válido. */
  geminiResponseSchema?: ReturnType<typeof buildOcrResponseSchema> | typeof STRIP_RESPONSE_SCHEMA;
}): Promise<string> {
  const { prompt, base64, mimeType, geminiKey, openRouterKey, geminiResponseSchema } = params;
  const isPdf = mimeType === 'application/pdf';

  // ─── NÍVEL 1: Gemini Direto (GCP) ─────────────────────
  // Mais rápido e custo zero (enquanto houver cota). responseSchema garante
  // que a saída adere à estrutura — elimina truncamento/vírgula faltante.
  try {
    const genAI = new GoogleGenAI({ apiKey: geminiKey });
    const response = await genAI.models.generateContent({
      model: GEMINI_DIRECT,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        ...(geminiResponseSchema ? { responseSchema: geminiResponseSchema } : {}),
        // Limite generoso para 18 analitos × 2 blocos + sampleId (~1.5KB);
        // o default de 8192 é suficiente, fixar evita surpresa.
        maxOutputTokens: 8192,
        temperature: 0.0, // determinístico para OCR
      },
    });
    const text = response.text ?? '';
    if (text.trim()) {
      console.log('✅ Extração bem-sucedida: Nível 1 (Gemini Direto)');
      return text;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Nível 1 falhou: ${msg}. Tentando Nível 2...`);
  }

  // ─── NÍVEIS 2+: Catálogo dinâmico OpenRouter (ordenado por preço) ─────────
  // Em vez de slugs hardcoded, busca o catálogo, filtra por whitelist + vision
  // capability + preço razoável, ordena por custo crescente. Tenta cada modelo
  // em ordem até um responder. Self-updating: quando OpenRouter publica modelo
  // novo (ex: qwen3.7-vl), entra automaticamente no pool sem deploy.
  const ranked = await fetchVisionModelsRanked(openRouterKey);
  const candidates = ranked.slice(0, MAX_FALLBACK_ATTEMPTS);

  if (candidates.length === 0) {
    throw new HttpsError(
      'internal',
      'Nenhum modelo de visão disponível no catálogo OpenRouter (e Gemini direto falhou).',
    );
  }

  let lastError = '';
  for (const model of candidates) {
    try {
      const content: OpenRouterContentPart[] = [{ type: 'text', text: prompt }];
      content.push(
        isPdf
          ? {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: `data:${mimeType};base64,${base64}`,
              },
            }
          : {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
      );

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: 'user', content }],
          plugins: isPdf ? [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }] : [],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const trimmed = errorText.length > 200 ? errorText.slice(0, 200) + '…' : errorText;
        lastError = `${model.id}: HTTP ${response.status} — ${trimmed}`;
        console.warn(`⚠️ ${model.id} retornou ${response.status}. Tentando próximo...`);
        continue;
      }

      const data = (await response.json()) as OpenRouterChatResponse;
      const text = data.choices?.[0]?.message?.content ?? '';
      if (text.trim()) {
        console.log(
          `✅ Extração bem-sucedida: ${model.id} (rank dinâmico — ` +
            `$${(model.avgCost * 1e6).toFixed(3)}/1M tokens médio)`,
        );
        return text;
      }
      lastError = `${model.id}: retorno vazio`;
      console.warn(`⚠️ ${model.id} retornou vazio. Tentando próximo...`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = `${model.id}: ${msg}`;
      console.warn(`⚠️ ${model.id} falhou: ${msg}. Tentando próximo...`);
    }
  }

  throw new HttpsError(
    'internal',
    `Falha crítica em todos os ${candidates.length} modelos tentados. Último erro: ${lastError}`,
  );
}

// ─── extractFromImage ─────────────────────────────────────────────────────────
// Callable function for OCR extraction from hematology analyzer screens.

// New schema: AI returns `values` (number|null per analyte) + `fieldConfidence`
// (categorical). A mapper inside the function converts back to the original
// {value, confidence, reasoning} shape so the frontend contract is unchanged.
const OcrResponseSchema = z.object({
  sampleId: z.string().nullable().optional(),
  values: z.record(z.string(), z.number().nullable()),
  fieldConfidence: z.record(z.string(), z.enum(['high', 'medium', 'low'])).optional(),
  overallConfidence: z.enum(['high', 'medium', 'low']).optional(),
});

const CONFIDENCE_MAP: Record<'high' | 'medium' | 'low', number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

const OCR_PROMPT = `
Você é um especialista em hematologia clínica e leitura de equipamentos automatizados, com foco no analisador Horiba Yumizen H550.

Você faz parte de um sistema profissional de Controle de Qualidade Laboratorial utilizado em rotinas reais de laboratório clínico.

--------------------------------------------------

🎯 OBJETIVO

Extrair com alta precisão os valores laboratoriais de uma imagem da tela do equipamento, retornando um JSON estruturado, confiável e validável.

Os dados serão utilizados para:
- Gráfico de Levey-Jennings
- Regras de Westgard
- Monitoramento de estabilidade analítica

Precisão é mais importante que completude.

--------------------------------------------------

🧭 ESTRUTURA DA TELA DO EQUIPAMENTO

A tela do Yumizen H550 é organizada em blocos fixos:

- TOPO: ID da amostra
- SUPERIOR ESQUERDO: RBC, HGB, HCT, VCM, HCM, CHCM, RDW-CV, RDW-SD
- SUPERIOR DIREITO: PLT, PCT, VPM, PDW
- INFERIOR: WBC + diferencial (NEU, LYM, MON, EOS, BASO)
  Cada linha do diferencial mostra: valor absoluto # | porcentagem %

Use este mapa espacial para desambiguar rótulos parcialmente ocluídos.

--------------------------------------------------

🔤 ALIASES DE RÓTULOS (interface pode estar em português)

A tela pode exibir abreviações portuguesas. Mapeie conforme abaixo:

  VCM   → MCV     (Volume Corpuscular Médio)
  HCM   → MCH     (Hemoglobina Corpuscular Média)
  CHCM  → MCHC    (Concentração de Hemoglobina Corpuscular Média)
  VPM   → MPV     (Volume Plaquetário Médio)
  BASO  → BAS#    (Basófilos — valor absoluto)

--------------------------------------------------

📏 REGRAS DE EXTRAÇÃO

1. FORMATO NUMÉRICO
   - Converter vírgula para ponto: 4,52 → 4.52

2. RDW (CRÍTICO)
   - Extrair SOMENTE RDW-CV (valor em %, primeira linha da dupla RDW)
   - Ignorar RDW-SD (segunda linha, em µm³)
   - Retornar sob a chave "RDW"

3. DIFERENCIAL LEUCOCITÁRIO (CRÍTICO)
   - Extrair SOMENTE os valores absolutos # (×10³/µL), coluna da esquerda
   - Ignorar completamente as porcentagens % (coluna da direita)
   - Se apenas % estiver visível → null
   - Retornar sob as chaves: NEU#, LYM#, MON#, EOS#, BAS#

4. CAMPOS ILEGÍVEIS
   - Retornar null e marcar confiança "low"

5. UNIDADES (não converter valores)
   - RBC → ×10⁶/µL
   - WBC e diferenciais → ×10³/µL

--------------------------------------------------

🚫 IGNORAR COMPLETAMENTE

O sistema utiliza sangue controle sintético.

NÃO extrair nem considerar:
- Flags (H, L, Hx, Lx, *, h*)
- Mensagens de interferência ou alertas clínicos
- Valores percentuais do diferencial
- RDW-SD

--------------------------------------------------

📊 PARÂMETROS A EXTRAIR

Eritrograma:  RBC, HGB, HCT, MCV, MCH, MCHC, RDW
Plaquetas:    PLT, MPV, PDW, PCT
Leucócitos:   WBC
Diferencial:  NEU#, LYM#, MON#, EOS#, BAS#
Outros:       NLR (se presente na tela)

--------------------------------------------------

🧠 AVALIAÇÃO DE QUALIDADE

Para cada campo extraído:
- "high"   → leitura clara e inequívoca
- "medium" → pequena dúvida (reflexo, ângulo, compressão de imagem)
- "low"    → difícil leitura ou incerteza real

--------------------------------------------------

📦 FORMATO DE SAÍDA (OBRIGATÓRIO)

Retorne apenas JSON válido, sem nenhum texto fora do JSON:

{
  "sampleId": "string | null",

  "values": {
    "RBC":  number | null,
    "HGB":  number | null,
    "HCT":  number | null,
    "MCV":  number | null,
    "MCH":  number | null,
    "MCHC": number | null,
    "RDW":  number | null,
    "PLT":  number | null,
    "MPV":  number | null,
    "PDW":  number | null,
    "PCT":  number | null,
    "WBC":  number | null,
    "NEU#": number | null,
    "LYM#": number | null,
    "MON#": number | null,
    "EOS#": number | null,
    "BAS#": number | null,
    "NLR":  number | null
  },

  "fieldConfidence": {
    "RBC":  "high | medium | low",
    "HGB":  "high | medium | low",
    "HCT":  "high | medium | low",
    "MCV":  "high | medium | low",
    "MCH":  "high | medium | low",
    "MCHC": "high | medium | low",
    "RDW":  "high | medium | low",
    "PLT":  "high | medium | low",
    "MPV":  "high | medium | low",
    "PDW":  "high | medium | low",
    "PCT":  "high | medium | low",
    "WBC":  "high | medium | low",
    "NEU#": "high | medium | low",
    "LYM#": "high | medium | low",
    "MON#": "high | medium | low",
    "EOS#": "high | medium | low",
    "BAS#": "high | medium | low",
    "NLR":  "high | medium | low"
  },

  "overallConfidence": "high | medium | low"
}

--------------------------------------------------

🚫 REGRAS PROIBIDAS

- Não misturar valores percentuais com absolutos
- Não inventar valores
- Não inferir dados ausentes
- Não retornar texto fora do JSON

--------------------------------------------------

🎯 FOCO FINAL

Se houver qualquer dúvida sobre um campo → retorne null.

A confiabilidade dos dados é mais importante que preencher todos os campos.
`.trim();

export const extractFromImage = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { base64, mimeType } = request.data as {
      base64: string;
      mimeType: string;
    };

    if (!base64?.trim()) {
      throw new HttpsError('invalid-argument', 'Nenhuma imagem fornecida.');
    }

    const geminiKeyValue = geminiApiKey.value();
    const openRouterKeyValue = openRouterApiKey.value();

    const rawText = await callAIWithFallback({
      prompt: OCR_PROMPT,
      base64,
      mimeType,
      geminiKey: geminiKeyValue,
      openRouterKey: openRouterKeyValue,
      geminiResponseSchema: buildOcrResponseSchema(),
    });

    if (!rawText.trim()) {
      throw new HttpsError(
        'internal',
        'Não consegui ler a foto. Tente uma imagem mais nítida ou outro ângulo.',
      );
    }

    const repaired = safeParseAIJson(rawText);
    if (!repaired.ok) {
      // Log técnico fica no servidor; usuário vê mensagem amigável.
      console.error(
        '❌ extractFromImage: JSON irrecuperável da IA',
        { reason: repaired.reason, rawHead: repaired.raw.slice(0, 600), rawTail: repaired.raw.slice(-200) },
      );
      throw new HttpsError(
        'internal',
        'A leitura automática falhou. Tente outra foto (boa iluminação, tela inteira no enquadramento, sem reflexo).',
      );
    }

    const validation = OcrResponseSchema.safeParse(repaired.data);
    if (!validation.success) {
      console.error('❌ Erro de validação OCR (Zod):', validation.error.format());
      throw new HttpsError(
        'internal',
        'A IA respondeu fora do formato esperado. Tente outra foto.',
      );
    }

    const { data } = validation;

    // Map new AI format → original frontend contract {value, confidence, reasoning}
    const results: Record<string, { value: number; confidence: number; reasoning: string }> = {};
    for (const [analyteId, rawValue] of Object.entries(data.values)) {
      if (rawValue === null) continue;
      const tier = data.fieldConfidence?.[analyteId];
      const overall = data.overallConfidence ?? 'n/a';
      results[analyteId] = {
        value: rawValue,
        confidence: tier ? CONFIDENCE_MAP[tier] : CONFIDENCE_MAP.low,
        reasoning: tier ? `${tier} (overall: ${overall})` : `low (overall: ${overall})`,
      };
    }

    if (Object.keys(results).length === 0) {
      throw new HttpsError('internal', 'Nenhum analito foi reconhecido na imagem.');
    }

    return {
      sampleId: data.sampleId ?? null,
      results,
    };
  },
);

// ─── analyzeImmunoStrip ───────────────────────────────────────────────────────
// Callable: lê foto de strip de imunoensaio e retorna resultado R/NR + confiança.
// A chave Gemini reside exclusivamente no backend — nunca exposta ao frontend.

const STRIP_RESULT_SCHEMA = z.object({
  resultado: z.enum(['R', 'NR']),
  confidence: z.enum(['high', 'medium', 'low']),
});

const ANALYZE_STRIP_INPUT_SCHEMA = z.object({
  base64: z.string().min(1, 'Imagem obrigatória.'),
  mimeType: z.string().min(1, 'mimeType obrigatório.'),
  testType: z.enum([
    'HCG',
    'BhCG',
    'HIV',
    'HBsAg',
    'Anti-HCV',
    'Sifilis',
    'Dengue',
    'COVID',
    'PCR',
    'Troponina',
  ]),
});

export const analyzeImmunoStrip = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    // Valida e tipifica o payload de entrada com Zod
    const inputValidation = ANALYZE_STRIP_INPUT_SCHEMA.safeParse(request.data);
    if (!inputValidation.success) {
      throw new HttpsError(
        'invalid-argument',
        `Payload inválido: ${inputValidation.error.message}`,
      );
    }

    const { base64, mimeType, testType } = inputValidation.data;

    const prompt = `Analise a imagem de um strip de imunoensaio do tipo ${testType}.

INSTRUÇÕES:
- R  = Reagente/Positivo  → duas linhas visíveis (controle + teste)
- NR = Não Reagente/Negativo → apenas uma linha visível (controle)

Avalie a qualidade da imagem para determinar o nível de confiança:
- high   = strip claramente visível, linhas nítidas
- medium = strip legível com pequenas imperfeições
- low    = imagem borrada, mal enquadrada ou strip danificado

Responda APENAS com JSON válido, sem markdown, sem explicações:
{ "resultado": "R" | "NR", "confidence": "high" | "medium" | "low" }`.trim();

    const rawText = await callAIWithFallback({
      prompt,
      base64,
      mimeType,
      geminiKey: geminiApiKey.value(),
      openRouterKey: openRouterApiKey.value(),
      geminiResponseSchema: STRIP_RESPONSE_SCHEMA,
    });

    if (!rawText.trim()) {
      throw new HttpsError(
        'internal',
        'Não consegui ler a foto do strip. Tente uma imagem mais nítida.',
      );
    }

    const repaired = safeParseAIJson(rawText);
    if (!repaired.ok) {
      console.error(
        '❌ analyzeImmunoStrip: JSON irrecuperável da IA',
        { reason: repaired.reason, rawHead: repaired.raw.slice(0, 600), rawTail: repaired.raw.slice(-200) },
      );
      throw new HttpsError(
        'internal',
        'A leitura automática do strip falhou. Tente outra foto.',
      );
    }

    const validation = STRIP_RESULT_SCHEMA.safeParse(repaired.data);
    if (!validation.success) {
      console.error('❌ analyzeImmunoStrip: formato inválido (Zod):', validation.error.format());
      throw new HttpsError(
        'internal',
        'A IA respondeu fora do formato esperado. Tente outra foto.',
      );
    }

    console.log(
      `✅ analyzeImmunoStrip: ${testType} → ${validation.data.resultado} (${validation.data.confidence})`,
    );

    return {
      resultadoObtido: validation.data.resultado,
      confidence: validation.data.confidence,
    };
  },
);

// ─── extractFromBula ──────────────────────────────────────────────────────────
// Callable function for parsing manufacturer stats from PDF bulas.

const ANALYTE_IDS_ALL = [
  'WBC',
  'RBC',
  'HGB',
  'HCT',
  'MCV',
  'MCH',
  'MCHC',
  'PLT',
  'RDW',
  'MPV',
  'PCT',
  'PDW',
  'NEU#',
  'LYM#',
  'MON#',
  'EOS#',
  'BAS#',
].join(', ');

const BULA_PROMPT = `
Você é um especialista em interpretar bulas de controles hematológicos (package inserts).
Analise o documento PDF e extraia os valores esperados (média e desvio-padrão) para TODOS OS TRÊS NÍVEIS
do controle (Nível 1 = Baixo/Normal, Nível 2 = Normal/Elevado, Nível 3 = Alto/Elevado).

Analitos aceitos pelo sistema: ${ANALYTE_IDS_ALL}

Equipamentos — prioridade de extração:
1. PRIMEIRA ESCOLHA: Yumizen H550 ou Horiba ABX (qualquer variante)
2. FALLBACK: Se os valores do Yumizen H550 estiverem ausentes para um analito específico,
   use a coluna do Pentra ES 60, Pentra 60 ou Pentra XL (na ordem de preferência).
   Registre o equipamento de origem no campo "equipmentSource" do analito afetado.

Retorne um JSON com este formato EXATO:
{
  "controlName": "<nome comercial do controle ou null>",
  "expiryDate":  "<data de validade em YYYY-MM-DD ou null>",
  "levels": [
    {
      "level":     <1, 2 ou 3>,
      "lotNumber": "<número do lote deste nível ou null>",
      "analytes": [
        {
          "analyteId":       "<id exato do analito>",
          "mean":            <número>,
          "sd":              <número>,
          "equipmentSource": "<nome exato do equipamento de onde este valor foi lido, ex: 'Yumizen H550' ou 'Pentra 60'>"
        }
      ]
    }
  ]
}

Regras críticas:
- Inclua SEMPRE os três níveis no array "levels" (mesmo que um deles não tenha dados — nesse caso inclua "analytes": []).
- Ordene os níveis como [1, 2, 3].
- Use apenas os IDs exatos listados acima (ex: "WBC", "HGB", "NEU", "NEU#").
- Inclua apenas analitos com mean E sd claramente legíveis.
- Para metadados não encontrados, use null.
- Nunca invente valores. Se incerto, omita o analito do array.
- O campo "equipmentSource" é OBRIGATÓRIO em cada analito — registre sempre qual coluna/equipamento foi lido.
`.trim();

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const BulaAnalyteSchema = z.object({
  analyteId: z.string(),
  mean: z.number().positive(),
  sd: z.number().nonnegative(),
  equipmentSource: z.string().optional(),
});

const BulaLevelSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lotNumber: z.string().nullable().optional(),
  analytes: z.array(BulaAnalyteSchema),
});

const BulaResponseSchema = z.object({
  controlName: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  levels: z.array(BulaLevelSchema).min(1),
});

export const extractFromBula = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { base64, mimeType } = request.data as {
      base64: string;
      mimeType: string;
    };

    if (!base64?.trim()) {
      throw new HttpsError('invalid-argument', 'Nenhum arquivo fornecido.');
    }

    const geminiKeyValue = geminiApiKey.value();
    const openRouterKeyValue = openRouterApiKey.value();

    const rawText = await callAIWithFallback({
      prompt: BULA_PROMPT,
      base64,
      mimeType,
      geminiKey: geminiKeyValue,
      openRouterKey: openRouterKeyValue,
    });

    if (!rawText.trim()) {
      throw new HttpsError(
        'internal',
        'Não consegui ler a bula. Verifique se o PDF é legível e tente de novo.',
      );
    }

    const repaired = safeParseAIJson(rawText);
    if (!repaired.ok) {
      console.error(
        '❌ extractFromBula: JSON irrecuperável da IA',
        { reason: repaired.reason, rawHead: repaired.raw.slice(0, 600), rawTail: repaired.raw.slice(-200) },
      );
      throw new HttpsError(
        'internal',
        'A leitura automática da bula falhou. Tente outro arquivo ou versão do PDF.',
      );
    }

    const validation = BulaResponseSchema.safeParse(repaired.data);
    if (!validation.success) {
      console.error('❌ Erro de validação Bula (Zod):', validation.error.format());
      throw new HttpsError(
        'internal',
        'A IA respondeu fora do formato esperado. Tente outro PDF.',
      );
    }

    return validation.data;
  },
);

// ─── approveUserForLab ────────────────────────────────────────────────────────
// Approves a pending Google OAuth user for a lab.
// Callable by lab admins/owners OR SuperAdmin.
//
// Flow:
//   1. Verify caller is lab admin/owner or SuperAdmin
//   2. Read pending_users/{labId}/users/{uid}
//   3. Create users/{uid} Firestore document
//   4. Set custom claims (role + tenantIds)
//   5. Mark emailVerified: true in Firebase Auth (admin already validated email)
//   6. Add to labs/{labId}/members/{uid}
//   7. Delete pending entry
//   8. Audit log

const ApproveUserInputSchema = z.object({
  labId: z.string().min(1),
  uid: z.string().min(1),
  assignedRole: z.enum(['admin', 'member']),
});

export const approveUserForLab = onCall({}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const parsed = ApproveUserInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }

  const { labId, uid, assignedRole } = parsed.data;

  await assertLabAdminOrSuperAdmin(
    request.auth.uid,
    labId,
    request.auth.token as Record<string, unknown>,
  );

  const db = admin.firestore();

  // 1. Read pending entry
  const pendingRef = db.doc(`pending_users/${labId}/users/${uid}`);
  const pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists) {
    throw new HttpsError('not-found', 'Usuário pendente não encontrado.');
  }

  const pending = pendingSnap.data()!;

  // 2. Check if user doc already exists (idempotency)
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  const batch = db.batch();

  if (!userSnap.exists) {
    batch.set(userRef, {
      email: pending.email ?? '',
      displayName: pending.displayName ?? pending.email ?? 'Usuário',
      labIds: [labId],
      roles: { [labId]: assignedRole },
      isSuperAdmin: false,
      activeLabId: null,
      pendingLabId: null,
      disabled: false,
      // emailVerified is managed on the Auth record below,
      // not stored redundantly in Firestore.
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });
  } else {
    // User doc exists — just add the new lab
    const existing = userSnap.data()!;
    const labIds = (existing.labIds ?? []) as string[];
    batch.update(userRef, {
      labIds: labIds.includes(labId) ? labIds : [...labIds, labId],
      [`roles.${labId}`]: assignedRole,
      pendingLabId: null,
    });
  }

  // 3. Add to lab members
  batch.set(db.doc(`labs/${labId}/members/${uid}`), {
    role: assignedRole,
    active: true,
  });

  // 4. Remove pending entry
  batch.delete(pendingRef);

  await batch.commit();

  // 5. Set custom claims — role + tenantIds array
  let existingClaims: Record<string, unknown> = {};
  try {
    const authUser = await admin.auth().getUser(uid);
    existingClaims = (authUser.customClaims ?? {}) as Record<string, unknown>;
  } catch {
    // User may not have claims yet — start fresh
  }

  const existingTenants = (existingClaims.tenantIds ?? []) as string[];
  await admin.auth().setCustomUserClaims(uid, {
    ...existingClaims,
    role: assignedRole,
    tenantIds: existingTenants.includes(labId) ? existingTenants : [...existingTenants, labId],
  });

  // 6. Mark emailVerified: true — admin validated the email by approving
  await admin.auth().updateUser(uid, { emailVerified: true });

  // 7. Audit log — non-blocking
  db.collection('auditLogs')
    .add({
      action: 'APPROVE_PENDING_USER',
      callerUid: request.auth.uid,
      callerEmail: request.auth.token.email ?? null,
      targetUid: uid,
      targetEmail: pending.email ?? null,
      labId,
      payload: { assignedRole },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return { success: true };
});

// ─── parseUrinaTira ───────────────────────────────────────────────────────────
// Callable: lê foto de tira reagente urinária e retorna os valores de cada
// analito (glicose, cetonas, proteína, nitrito, sangue, leucócitos, pH) com
// confiança individual. Bilirrubina, urobilinogênio e densidade NUNCA são
// processados — contraste ótico insuficiente, sempre manual.

const URO_OCR_RESULT_SCHEMA = z.object({
  glicose: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  cetonas: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  proteina: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  nitrito: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  sangue: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  leucocitos: z.object({ valor: z.string().nullable(), confidence: z.number().min(0).max(1) }),
  ph: z.object({ valor: z.number().nullable(), confidence: z.number().min(0).max(1) }),
});

const PARSE_URINA_INPUT_SCHEMA = z.object({
  base64: z.string().min(1, 'Imagem obrigatória.'),
  mimeType: z.string().min(1, 'mimeType obrigatório.'),
});

export const parseUrinaTira = onCall(
  {
    secrets: [geminiApiKey, openRouterApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const inputValidation = PARSE_URINA_INPUT_SCHEMA.safeParse(request.data);
    if (!inputValidation.success) {
      throw new HttpsError(
        'invalid-argument',
        `Payload inválido: ${inputValidation.error.message}`,
      );
    }

    const { base64, mimeType } = inputValidation.data;

    const prompt =
      `Você é um analista de controle de qualidade laboratorial. Leia a foto da tira reagente urinária comparando com o padrão de cores impresso no frasco/rótulo.

Parâmetros a identificar (7) com valores exatos:
- glicose:    "NEGATIVO" | "1+" | "2+" | "3+" | "4+"
- cetonas:    "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+"
- proteina:   "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+" | "4+"
- nitrito:    "NEGATIVO" | "PRESENTE"
- sangue:     "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+"
- leucocitos: "NEGATIVO" | "TRACOS" | "1+" | "2+" | "3+" | "4+"
- ph:         número entre 5.0 e 8.5 (múltiplo de 0.5)

NÃO processar: bilirrubina, urobilinogênio, densidade (ambíguos oticamente).

confidence: 0.95+ clara · 0.70-0.95 dúvida mínima · <0.70 ambíguo.
Se não puder ler um parâmetro, use { "valor": null, "confidence": 0 }.

Responda APENAS com JSON válido, sem markdown:
{
  "glicose": { "valor": "...", "confidence": 0..1 },
  "cetonas": { "valor": "...", "confidence": 0..1 },
  "proteina": { "valor": "...", "confidence": 0..1 },
  "nitrito": { "valor": "...", "confidence": 0..1 },
  "sangue": { "valor": "...", "confidence": 0..1 },
  "leucocitos": { "valor": "...", "confidence": 0..1 },
  "ph": { "valor": 5.0..8.5, "confidence": 0..1 }
}`.trim();

    const rawText = await callAIWithFallback({
      prompt,
      base64,
      mimeType,
      geminiKey: geminiApiKey.value(),
      openRouterKey: openRouterApiKey.value(),
    });

    if (!rawText.trim()) {
      throw new HttpsError(
        'internal',
        'Não consegui ler a tira. Tente outra foto.',
      );
    }

    const repaired = safeParseAIJson(rawText);
    if (!repaired.ok) {
      console.error(
        '❌ parseUrinaTira: JSON irrecuperável da IA',
        { reason: repaired.reason, rawHead: repaired.raw.slice(0, 600), rawTail: repaired.raw.slice(-200) },
      );
      throw new HttpsError(
        'internal',
        'A leitura automática da tira falhou. Tente outra foto.',
      );
    }

    const validation = URO_OCR_RESULT_SCHEMA.safeParse(repaired.data);
    if (!validation.success) {
      console.error('❌ parseUrinaTira: formato inválido (Zod):', validation.error.format());
      throw new HttpsError(
        'internal',
        'A IA respondeu fora do formato esperado. Tente outra foto.',
      );
    }

    console.log('✅ parseUrinaTira: leitura bem-sucedida');

    return validation.data;
  },
);

// ─── sgq module (Phase 12 — Drive Importer + Classification) ──────────────────
// OAuth callback and Drive import callables for Document Management System
export { transitarVigencia } from './sgq/transitarVigencia';
export { oauthCallbackDrive } from './sgq/oauthCallbackDrive';
export { listarDocsDrive } from './sgq/listarDocsDrive';
export { previewDocDrive } from './sgq/previewDocDrive';
export { classificarDocAuto } from './sgq/classificarDocAuto';
export { aprovarBatchImport } from './sgq/aprovarBatchImport';
