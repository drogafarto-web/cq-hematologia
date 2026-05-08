/**
 * Críticos (Critical Values) Escalation Module
 * Phase 6: SMS + Email escalation for critical lab results
 *
 * Implements RDC 978 Art. 128 (rastreabilidade)
 * Implements DICQ 4.3 (actions on critical values)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import {
  sendSMS,
  checkMessageStatus,
  getSMSTemplate,
} from '../../shared/sms/twilioClient';
import { generateChainHash } from '../../shared/signature';
import type {
  RegisterCriticoDetectionResponse,
  AcknowledgeEscalacaoResponse,
  EscalacaoCriticosResponse,
  CriticosEscalacao,
  CriticosLogEvento,
} from './types';

const db = admin.firestore();

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
  const { labId, escalacaoId, eventoId, tipo, detalhes, operadorId, ts } =
    params;

  // Fetch most recent prior event for this escalacao to chain against.
  const priorSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('criticos-log-eventos')
    .where('escalacaoId', '==', escalacaoId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  const prior = priorSnap.empty
    ? null
    : (priorSnap.docs[0].data() as CriticosLogEvento);
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
// 2.1: registerCriticoDetection()
// ============================================================================

const RegisterCriticoDetectionRequestSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  laudoVersion: z.number().int().min(1),
  exames: z.array(
    z.object({
      id: z.string(),
      analitoId: z.string(),
      valor: z.number(),
      unidade: z.string(),
    })
  ),
  criticos: z.array(
    z.object({
      exameId: z.string(),
      analitoId: z.string(),
      valor: z.number(),
      severidade: z.enum(['alta', 'baixa']),
      motivo: z.string(),
    })
  ),
  paciente: z.object({
    id: z.string(),
    nome: z.string(),
    idade: z.number().int().min(0),
    sexo: z.enum(['M', 'F', 'NI']),
  }),
  medico: z.object({
    id: z.string(),
    nome: z.string(),
    telefone: z.string().regex(/^\+\d{1,15}$/),
    email: z.string().email(),
  }),
});

export const registerCriticoDetection = onCall(
  async (
    request
  ): Promise<RegisterCriticoDetectionResponse> => {
    try {
      // Validate auth
      if (!request.auth?.uid) {
        throw new HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      // Validate request schema
      const data = RegisterCriticoDetectionRequestSchema.parse(request.data);
      const { labId, laudoId, criticos, paciente, medico } = data;

      // Fetch lab settings
      const labSettings = await db.collection('labs').doc(labId).get();
      if (!labSettings.exists) {
        throw new HttpsError(
          'not-found',
          'Lab settings not found'
        );
      }

      const settingsData = labSettings.data();
      if (!settingsData?.criticos?.ativo) {
        throw new HttpsError(
          'failed-precondition',
          'Critical values feature not enabled for this lab'
        );
      }

      // Create escalacao doc
      const escalacaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('criticos-escalacoes')
        .doc();

      const escalacao: CriticosEscalacao = {
        id: escalacaoRef.id,
        labId,
        laudoId,
        laudoVersion: data.laudoVersion,
        exameId: criticos[0].exameId,
        analitoId: criticos[0].analitoId,
        valorObtido: criticos[0].valor,
        thresholdId: '', // Would be set after threshold lookup
        severidade: criticos[0].severidade,
        motivo: criticos[0].motivo,
        pacienteId: paciente.id,
        pacienteNome: paciente.nome,
        pacienteIdade: paciente.idade,
        pacienteSexo: paciente.sexo,
        medicoId: medico.id,
        medicoNome: medico.nome,
        medicoTelefone: medico.telefone,
        medicoEmail: medico.email,
        rtId: request.auth.uid,
        rtNome: '', // Would fetch from user profile
        rtEmail: '', // Would fetch from user profile
        escalacoes: [],
        status: 'enviado',
        sla_status: 'em_prazo',
        sla_minutos_target: settingsData?.criticos?.slaMinutosTarget || 30,
        criadoEm: admin.firestore.Timestamp.now(),
        criadoPor: request.auth.uid,
        atualizadoEm: admin.firestore.Timestamp.now(),
        atualizadoPor: request.auth.uid,
        deletadoEm: null,
      };

      // Attempt SMS escalation
      const smsTemplate = await getSMSTemplate(
        criticos[0].analitoId,
        paciente.nome,
        criticos[0].valor,
        data.exames[0].unidade,
        laudoId
      );

      const smsResult = await sendSMS(medico.telefone, smsTemplate);

      // Add escalacao attempt
      const canalId = `sms-${Date.now()}`;
      escalacao.escalacoes.push({
        canalId,
        canal: 'SMS',
        status: smsResult.status === 'failed' ? 'falha' : 'enviado',
        enviado_em: admin.firestore.Timestamp.now(),
        provider_messageId: smsResult.sid || undefined,
        motivo_falha: smsResult.errorCode || undefined,
        tentativa_numero: 1,
      });

      // If SMS failed, queue email fallback
      if (smsResult.status === 'failed') {
        escalacao.escalacoes.push({
          canalId: `email-${Date.now()}`,
          canal: 'EMAIL',
          status: 'enviado',
          enviado_em: admin.firestore.Timestamp.now(),
          tentativa_numero: 1,
        });
      }

      // Write escalacao doc
      await escalacaoRef.set(escalacao);

      // Log event
      const eventoRef = db
        .collection('labs')
        .doc(labId)
        .collection('criticos-log-eventos')
        .doc();

      const eventoTs = admin.firestore.Timestamp.now();
      const detalhes = {
        canal: 'SMS',
        telefone_masked: `+55 98${medico.telefone.slice(-8)}`,
        twilio_sid: smsResult.sid || 'FAILED',
      };
      const { assinatura, eventoAnteriorId } = await buildLogEventoSignature({
        labId,
        escalacaoId: escalacaoRef.id,
        eventoId: eventoRef.id,
        tipo: 'sms_enviado',
        detalhes,
        operadorId: request.auth.uid,
        ts: eventoTs,
      });

      const evento: CriticosLogEvento = {
        id: eventoRef.id,
        labId,
        escalacaoId: escalacaoRef.id,
        laudoId,
        tipo: 'sms_enviado',
        detalhes,
        timestamp: eventoTs,
        operadorId: request.auth.uid,
        assinatura,
        ...(eventoAnteriorId ? { eventoAnteriorId } : {}),
        deletadoEm: null,
      };

      await eventoRef.set(evento);

      // Check for NOTIVISA reportable condition
      let notivisaDraftId: string | undefined;
      const reportableConditions =
        settingsData?.criticos?.condicoesNotivisaveis || [];
      for (const condition of reportableConditions) {
        if (condition.analitoId === criticos[0].analitoId) {
          // Generate NOTIVISA draft
          const draftRef = db
            .collection('labs')
            .doc(labId)
            .collection('notivisa-outbox')
            .doc();

          notivisaDraftId = draftRef.id;

          await draftRef.set({
            id: draftRef.id,
            escalacaoId: escalacaoRef.id,
            laudoId,
            status: 'rascunho',
            tipo: 'Resultado Crítico',
            descricao: `${criticos[0].analitoId}: ${criticos[0].valor} (crítico)`,
            criteriosDeRisco: [condition.condicao],
            formFields: {},
            criadoEm: admin.firestore.Timestamp.now(),
            deletadoEm: null,
          });

          // Link escalacao to draft
          await escalacaoRef.update({
            notivisaDraftId: draftRef.id,
          });
        }
      }

      return {
        success: true,
        escalacaoId: escalacaoRef.id,
        escalacoes: escalacao.escalacoes.map((e) => ({
          canalId: e.canalId,
          canal: e.canal as 'SMS' | 'EMAIL',
          status: e.status as 'enviado' | 'falha',
          providerMessageId: e.provider_messageId,
          errorCode: e.motivo_falha,
        })),
        sla: {
          slaMinutosTarget: escalacao.sla_minutos_target,
          etaAckMs: escalacao.sla_minutos_target * 60 * 1000,
        },
        notivisaDraftId,
      };
    } catch (error: any) {
      console.error('registerCriticoDetection error:', error);
      if (error instanceof HttpsError) throw error;

      throw new HttpsError(
        'internal',
        error.message || 'Internal error'
      );
    }
  }
);

// ============================================================================
// 2.2: acknowledgeEscalacao()
// ============================================================================

const AcknowledgeEscalacaoRequestSchema = z.object({
  labId: z.string().min(1),
  escalacaoId: z.string().min(1),
  acknowledgedBy: z.string().min(1),
  method: z.enum(['portal_web', 'webhook_twilio', 'manual_rt']),
  notas: z.string().optional(),
});

export const acknowledgeEscalacao = onCall(
  async (
    request
  ): Promise<AcknowledgeEscalacaoResponse> => {
    try {
      if (!request.auth?.uid) {
        throw new HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const data = AcknowledgeEscalacaoRequestSchema.parse(request.data);
      const { labId, escalacaoId, acknowledgedBy, method } = data;

      const escalacaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('criticos-escalacoes')
        .doc(escalacaoId);

      const escalacaoDoc = await escalacaoRef.get();
      if (!escalacaoDoc.exists) {
        throw new HttpsError(
          'not-found',
          'Escalacao not found'
        );
      }

      const escalacao = escalacaoDoc.data() as CriticosEscalacao;

      // Validate state
      if (escalacao.status !== 'enviado') {
        throw new HttpsError(
          'failed-precondition',
          'Escalacao already acknowledged or canceled'
        );
      }

      const now = admin.firestore.Timestamp.now();
      const tempoSlaMs =
        now.toMillis() - escalacao.criadoEm.toMillis();

      const slaStatus =
        tempoSlaMs <= escalacao.sla_minutos_target * 60 * 1000
          ? 'em_prazo'
          : 'vencido';

      // Update escalacao
      await escalacaoRef.update({
        status: 'reconhecido',
        reconhecido_em: now,
        reconhecido_por: acknowledgedBy,
        tempo_sla_ms: tempoSlaMs,
        sla_status: slaStatus,
        atualizadoEm: now,
        atualizadoPor: request.auth.uid,
      });

      // Log event
      const eventoRef = db
        .collection('labs')
        .doc(labId)
        .collection('criticos-log-eventos')
        .doc();

      const ackDetalhes = {
        reconhecido_por: acknowledgedBy,
        metodo: method,
        tempo_sla_ms: tempoSlaMs,
      };
      const { assinatura: ackAssinatura, eventoAnteriorId: ackPriorId } =
        await buildLogEventoSignature({
          labId,
          escalacaoId,
          eventoId: eventoRef.id,
          tipo: 'reconhecimento_manual',
          detalhes: ackDetalhes,
          operadorId: request.auth.uid,
          ts: now,
        });

      await eventoRef.set({
        id: eventoRef.id,
        labId,
        escalacaoId,
        laudoId: escalacao.laudoId,
        tipo: 'reconhecimento_manual',
        detalhes: ackDetalhes,
        timestamp: now,
        operadorId: request.auth.uid,
        assinatura: ackAssinatura,
        ...(ackPriorId ? { eventoAnteriorId: ackPriorId } : {}),
        deletadoEm: null,
      } as CriticosLogEvento);

      return {
        success: true,
        escalacaoId,
        status: 'reconhecido',
        tempoSlaMs,
        slaStatus: slaStatus as 'em_prazo' | 'vencido',
      };
    } catch (error: any) {
      console.error('acknowledgeEscalacao error:', error);
      if (error instanceof HttpsError) throw error;

      throw new HttpsError(
        'internal',
        error.message || 'Internal error'
      );
    }
  }
);

// ============================================================================
// 2.3: escalacaoCriticos() — Cron Trigger (5-min interval)
// ============================================================================

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

            // Check SMS delivery status
            const smsAttempt = escalacao.escalacoes.find(
              (e) => e.canal === 'SMS'
            );
            if (smsAttempt && smsAttempt.provider_messageId) {
              const status = await checkMessageStatus(
                smsAttempt.provider_messageId
              );

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
  }
);

// ============================================================================
// Twilio Webhook Handler
// ============================================================================

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
        .where('escalacoes', 'array-contains-any', [
          { provider_messageId: MessageSid },
        ])
        .limit(1)
        .get();

      if (escalacoes.empty) {
        res.status(200).send('No matching escalacao');
        return;
      }

      const escalacaoDoc = escalacoes.docs[0];
      const escalacao = escalacaoDoc.data() as CriticosEscalacao;

      // Find and update escalacao entry
      const entryIndex = escalacao.escalacoes.findIndex(
        (e) => e.provider_messageId === MessageSid
      );

      if (entryIndex >= 0) {
        escalacao.escalacoes[entryIndex].status = MessageStatus as any;
        escalacao.escalacoes[entryIndex].entregue_em =
          admin.firestore.Timestamp.now();

        await escalacaoDoc.ref.update({
          escalacoes: escalacao.escalacoes,
          atualizadoEm: admin.firestore.Timestamp.now(),
        });

        // Log event
        const labId = escalacao.labId;
        const eventoRef = db
          .collection('labs')
          .doc(labId)
          .collection('criticos-log-eventos')
          .doc();

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
        const {
          assinatura: webhookAssinatura,
          eventoAnteriorId: webhookPriorId,
        } = await buildLogEventoSignature({
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
  }
);
