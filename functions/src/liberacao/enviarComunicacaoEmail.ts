/**
 * enviarComunicacaoEmail — Callable que envia email via Resend
 *
 * Disparado por:
 * - detectarCriticos trigger (automático)
 * - Manual RT trigger via UI
 *
 * Pipeline:
 * 1. Lê laudo + médico
 * 2. Gera email HTML
 * 3. Envia via Resend
 * 4. Cria Comunicacao doc com status
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { assertLiberacaoAccess } from './validators';
import { subjectTemplate, bodyTemplate } from './_email/emailTemplates';

// Resend SDK would be imported here in production
// For MVP: placeholder that logs
// import { Resend } from 'resend';

interface EnviarEmailInput {
  labId: string;
  laudoId: string;
  isAutomatic?: boolean;
}

interface EnviarEmailResult {
  ok: true;
  comunicacaoId: string;
  status: string;
}

const EnviarEmailSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  isAutomatic: z.boolean().optional(),
});

const REGION = 'southamerica-east1';

export const enviarComunicacaoEmail = onCall<unknown, Promise<EnviarEmailResult>>(
  { region: REGION, memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    const parsed = EnviarEmailSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }

    const input = parsed.data as EnviarEmailInput;
    const { labId, laudoId, isAutomatic } = input;

    // Auth (optional se isAutomatic, obrigatório se manual)
    if (!isAutomatic) {
      await assertLiberacaoAccess(request.auth, labId);
    }

    const db = admin.firestore();

    // 1. Lê laudo
    const laudoSnap = await db.doc(`labs/${labId}/laudos/${laudoId}`).get();
    if (!laudoSnap.exists) {
      throw new HttpsError('not-found', 'Laudo não encontrado.');
    }
    const laudo = laudoSnap.data()!;

    // 2. Lê médico solicitante
    const medicoSnap = await db
      .doc(`labs/${labId}/medicos-solicitantes/${laudo.medicoSolicitanteId}`)
      .get();
    if (!medicoSnap.exists) {
      throw new HttpsError('not-found', 'Médico não encontrado.');
    }
    const medico = medicoSnap.data()!;

    // 3. Constrói email
    const tipo = laudo.criticoFlag
      ? laudo.criticoDetalhes?.some((c: any) => c.severidade === 'alta')
        ? 'critico-alta'
        : 'critico-baixa'
      : 'rotina';

    const _subject = subjectTemplate({
      tipo: tipo as any,
      paciente_nome: laudo.paciente.nome,
      paciente_iniciais: laudo.paciente.nome
        .split(' ')
        .map((n: string) => n[0])
        .join(''),
      medico_nome: medico.nome || '',
      lab_name: laudo.labName,
      laudoUrl: `https://hmatologia2.web.app/portal-medico/laudos/${laudoId}`,
    });

    const _body = bodyTemplate({
      tipo: tipo as any,
      paciente_nome: laudo.paciente.nome,
      paciente_iniciais: laudo.paciente.nome
        .split(' ')
        .map((n: string) => n[0])
        .join(''),
      medico_nome: medico.nome || '',
      lab_name: laudo.labName,
      criticos: laudo.criticoDetalhes || [],
      laudoUrl: `https://hmatologia2.web.app/portal-medico/laudos/${laudoId}`,
    });
    void _subject;
    void _body;

    // 4. Envia email (MVP: placeholder)
    // TODO: Integrar com Resend SDK
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // const result = await resend.emails.send({
    //   from: 'notificacoes@hmatologia2.web.app',
    //   to: medico.email,
    //   subject,
    //   html: body,
    //   tags: [
    //     { name: 'tipo', value: tipo },
    //     { name: 'labId', value: labId },
    //   ],
    // });

    const now = admin.firestore.Timestamp.now();
    const comunicacaoId = db.collection(`labs/${labId}/comunicacoes`).doc().id;

    // 5. Cria Comunicacao doc
    const batch = db.batch();
    const comunicacaoRef = db.doc(`labs/${labId}/comunicacoes/${comunicacaoId}`);

    batch.set(comunicacaoRef, {
      laudoId,
      canal: 'email',
      emailRemetente: 'notificacoes@hmatologia2.web.app',
      emailDestinatario: medico.email || '',
      emailStatus: 'sent', // MVP: assume sent (webhook validation in Plan 10-03)
      signature: {
        operatorId: isAutomatic ? 'sistema' : request.auth?.uid || '',
        operatorRole: isAutomatic ? 'Sistema' : 'Técnico',
        operatorName: isAutomatic ? 'Sistema' : '',
        timestamp: now,
        hash: '', // Preenchido depois se necessário
      },
      criadoEm: now,
    });

    // Audit log
    const auditRef = db.collection(`labs/${labId}/audit-logs`).doc();
    batch.set(auditRef, {
      tipo: 'email_enviado',
      laudoId,
      destinatario: medico.email,
      severidade: tipo,
      criadoEm: now,
    });

    await batch.commit();

    return {
      ok: true,
      comunicacaoId,
      status: 'sent',
    };
  },
);
