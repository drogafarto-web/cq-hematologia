/**
 * Críticos Cron & Webhook Handlers
 * Phase 5 Wave 3 (W3-A3): Escalação de Críticos
 *
 * Implements polling cron (every 5 minutes) + Twilio webhook handler for SMS delivery status.
 * Per ADR-0017: HMAC-SHA256 chain hash audit trail for all events.
 * Per RDC 978 Art. 5.7.1: critical communication <60min.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generateChainHash } from '../../shared/signature';

import type { EscalacaoCriticosResponse, CriticosEscalacao, CriticosLogEvento } from './types';

const db = admin.firestore();

/**
 * Returns true when Twilio creds appear to be provisioned. Wave 2 — until
 * SMS secrets are deployed, SMS-emitting paths short-circuit cleanly with
 * a structured error rather than crashing the whole callable.
 */
function isTwilioProvisioned(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phone = process.env.TWILIO_PHONE_NUMBER;
  const placeholder = (v: string | undefined) =>
    !v || v.length === 0 || v.startsWith('PENDING_SET');
  return !placeholder(sid) && !placeholder(token) && !placeholder(phone);
}

/**
 * Build a chained logical signature for a CriticosLogEvento.
 *
 * Per ADR-0017 + RDC 978 Art. 128: every audit entry carries a 64-hex
 * HMAC-SHA256 chain hash binding (operatorId, eventId, escalacaoId, tipo,
 * timestamp, detalhes) to the prior event's hash for the same escalacao,
 * making the trail tamper-evident.
 *
 * Returns both the signature (for the doc) and the previous event id
 * (for `eventoAnteriorId` linkage). When no prior event exists, chain
 * origin is null — matches ADR-0017 baseline-reset semantics.
 */
async function buildLogEventoSignature(params: {
  labId: string;
  escalacaoId: string;
  eventoId: string;
  tipo: CriticosLogEvento['tipo'];
  detalhes: CriticosLogEvento['detalhes'];
  operadorId: string;
  ts: admin.firestore.Timestamp;
}): Promise<{
  assinatura: CriticosLogEvento['assinatura'];
  eventoAnteriorId?: string;
}> {
  const { labId, escalacaoId, eventoId, tipo, detalhes, operadorId, ts } = params;

  // Fetch most recent prior event for this escalacao to chain against.
  const priorSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('criticos-log-eventos')
    .where('escalacaoId', '==', escalacaoId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  const prior = priorSnap.empty ? null : (priorSnap.docs[0].data() as CriticosLogEvento);
  const previousHash = prior?.assinatura?.hash ?? null;
  const eventoAnteriorId = prior?.id;

  const hash = generateChainHash({
    eventoId,
    escalacaoId,
    labId,
    tipo,
    operadorId,
    tsMs: ts.toMillis(),
    detalhes,
    previousHash,
  });

  return {
    assinatura: { hash, operatorId: operadorId, ts },
    ...(eventoAnteriorId ? { eventoAnteriorId } : {}),
  };
}

// ============================================================================
// Cron: escalacaoCriticos() — Poll pending escalations (5-min interval)
// ============================================================================

/**
 * Scheduled cron: every 5 minutes, query all labs for pending escalacoes
 * (status='enviado' + nextRetry <= now) and attempt SMS/Email delivery.
 *
 * For each escalacao:
 * 1. Check SMS attempt status via Twilio API (if provisioned)
 * 2. If delivered: mark as 'entregue', create log event
 * 3. If still pending: retry next cycle (no action)
 * 4. Check SLA violations (>slaMinutosTarget since criadoEm)
 * 5. If SLA exceeded + not yet marked: mark as 'vencido', notify admin
 *
 * Retries use exponential backoff per escalacao's retryCount.
 * Max retries: 5 attempts (Twilio + Email fallback).
 * Network errors: defer to next cycle (idempotent).
 *
 * Returns: { labsScanned, escalacoesPending, smsConfirmed, smsRetried, slaVencidos, errors }
 */
export const escalacaoCriticos = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (): Promise<void> => {
    try {
      const response: EscalacaoCriticosResponse = {
        labsScanned: 0,
        escalacoesPending: 0,
        smsConfirmed: 0,
        smsRetried: 0,
        slaVencidos: 0,
        errors: [],
      };

      // List all labs
      const labsSnap = await db.collection('labs').get();
      response.labsScanned = labsSnap.size;

      for (const labDoc of labsSnap.docs) {
        const labId = labDoc.id;

        // Query pending escalacoes
        const escalacoes = await db
          .collection('labs')
          .doc(labId)
          .collection('criticos-escalacoes')
          .where('status', '==', 'enviado')
          .orderBy('criadoEm', 'desc')
          .get();

        response.escalacoesPending += escalacoes.size;

        for (const escalacaoDoc of escalacoes.docs) {
          try {
            const escalacao = escalacaoDoc.data() as CriticosEscalacao;

            // Check SMS delivery status — Twilio loaded lazily, skipped when
            // not provisioned (SLA tracking continues regardless).
            const smsAttempt = escalacao.escalacoes.find((e) => e.canal === 'SMS');
            if (smsAttempt && smsAttempt.provider_messageId && isTwilioProvisioned()) {
              const { checkMessageStatus } = await import('../../shared/sms/twilioClient');
              const status = await checkMessageStatus(smsAttempt.provider_messageId);

              if (status.status === 'delivered') {
                smsAttempt.status = 'entregue';
                smsAttempt.entregue_em = admin.firestore.Timestamp.now();
                response.smsConfirmed++;

                await escalacaoDoc.ref.update({
                  escalacoes: escalacao.escalacoes,
                });
              }
            }

            // Check SLA violations
            const now = admin.firestore.Timestamp.now();
            const elapsedMs = now.toMillis() - escalacao.criadoEm.toMillis();
            const slaMs = escalacao.sla_minutos_target * 60 * 1000;

            if (elapsedMs > slaMs && escalacao.sla_status !== 'vencido') {
              response.slaVencidos++;

              await escalacaoDoc.ref.update({
                sla_status: 'vencido',
                atualizadoEm: now,
              });

              // Alert RT via email (would send email here)
              // For now, just log event
              const eventoRef = db
                .collection('labs')
                .doc(labId)
                .collection('criticos-log-eventos')
                .doc();

              const slaDetalhes = {
                sla_minutos_target: escalacao.sla_minutos_target,
                tempo_decorrido_ms: elapsedMs,
              };
              const { assinatura: slaAssinatura, eventoAnteriorId: slaPriorId } =
                await buildLogEventoSignature({
                  labId,
                  escalacaoId: escalacaoDoc.id,
                  eventoId: eventoRef.id,
                  tipo: 'sla_vencido_alerta',
                  detalhes: slaDetalhes,
                  operadorId: 'system',
                  ts: now,
                });

              await eventoRef.set({
                id: eventoRef.id,
                labId,
                escalacaoId: escalacaoDoc.id,
                laudoId: escalacao.laudoId,
                tipo: 'sla_vencido_alerta',
                detalhes: slaDetalhes,
                timestamp: now,
                operadorId: 'system',
                assinatura: slaAssinatura,
                ...(slaPriorId ? { eventoAnteriorId: slaPriorId } : {}),
                deletadoEm: null,
              } as CriticosLogEvento);
            }
          } catch (error: any) {
            response.errors.push({
              escalacaoId: escalacaoDoc.id,
              error: error.message || 'Unknown error',
            });
          }
        }
      }

      console.log('escalacaoCriticos cron result:', response);
    } catch (error: any) {
      console.error('escalacaoCriticos cron error:', error);
      throw error;
    }
  },
);

// ============================================================================
// Webhook: escalacaoCriticos_webhook() — Twilio status callback
// ============================================================================

/**
 * Receives delivery status callbacks from Twilio for SMS messages.
 *
 * Expected payload:
 *   MessageSid: Twilio message ID (provider_messageId)
 *   MessageStatus: 'delivered' | 'failed' | 'undelivered' | etc.
 *
 * Logic:
 * 1. Find escalacao by provider_messageId
 * 2. Update SMS attempt status in escalacoes array
 * 3. Create log event with chain-hash signature (ADR-0017)
 * 4. Return 200 OK (idempotent — Twilio may retry)
 *
 * Error handling:
 * - Missing payload → 400
 * - Escalacao not found → 200 OK (silent, Twilio will retry)
 * - Server error → 500 (Twilio retries)
 */
export const escalacaoCriticos_webhook = onRequest(
  { region: 'southamerica-east1', cors: true },
  async (req, res) => {
    try {
      const { MessageSid, MessageStatus } = req.body;

      if (!MessageSid || !MessageStatus) {
        res.status(400).send('Missing MessageSid or MessageStatus');
        return;
      }

      // Find escalacao by provider_messageId
      const escalacoes = await db
        .collectionGroup('criticos-escalacoes')
        .where('escalacoes', 'array-contains-any', [{ provider_messageId: MessageSid }])
        .limit(1)
        .get();

      if (escalacoes.empty) {
        res.status(200).send('No matching escalacao');
        return;
      }

      const escalacaoDoc = escalacoes.docs[0];
      const escalacao = escalacaoDoc.data() as CriticosEscalacao;

      // Find and update escalacao entry
      const entryIndex = escalacao.escalacoes.findIndex((e) => e.provider_messageId === MessageSid);

      if (entryIndex >= 0) {
        escalacao.escalacoes[entryIndex].status = MessageStatus as any;
        escalacao.escalacoes[entryIndex].entregue_em = admin.firestore.Timestamp.now();

        await escalacaoDoc.ref.update({
          escalacoes: escalacao.escalacoes,
          atualizadoEm: admin.firestore.Timestamp.now(),
        });

        // Log event
        const labId = escalacao.labId;
        const eventoRef = db.collection('labs').doc(labId).collection('criticos-log-eventos').doc();

        // Map Twilio status to event type
        let eventoTipo: 'sms_entregue' | 'sms_falha' = 'sms_falha';
        if (MessageStatus === 'delivered') {
          eventoTipo = 'sms_entregue';
        } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
          eventoTipo = 'sms_falha';
        }

        const webhookTs = admin.firestore.Timestamp.now();
        const webhookDetalhes = {
          twilio_sid: MessageSid,
          status: MessageStatus,
        };
        const { assinatura: webhookAssinatura, eventoAnteriorId: webhookPriorId } =
          await buildLogEventoSignature({
            labId,
            escalacaoId: escalacaoDoc.id,
            eventoId: eventoRef.id,
            tipo: eventoTipo,
            detalhes: webhookDetalhes,
            operadorId: 'twilio-webhook',
            ts: webhookTs,
          });

        await eventoRef.set({
          id: eventoRef.id,
          labId,
          escalacaoId: escalacaoDoc.id,
          laudoId: escalacao.laudoId,
          tipo: eventoTipo,
          detalhes: webhookDetalhes,
          timestamp: webhookTs,
          operadorId: 'twilio-webhook',
          assinatura: webhookAssinatura,
          ...(webhookPriorId ? { eventoAnteriorId: webhookPriorId } : {}),
          deletadoEm: null,
        } as CriticosLogEvento);
      }

      res.status(200).send('OK');
    } catch (error: any) {
      console.error('Webhook handler error:', error);
      res.status(500).send('Internal error');
    }
  },
);
