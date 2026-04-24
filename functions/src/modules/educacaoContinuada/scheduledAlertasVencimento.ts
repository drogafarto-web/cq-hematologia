/**
 * ec_scheduledAlertasVencimento — Fase 9 scheduled (08:00 America/Sao_Paulo).
 *
 * Varre `configAlertas` via collectionGroup — cada lab com configuração ativa.
 * Para cada lab: encontra alertas de vencimento que entram na janela (pendente
 * OR notificado) e cujo vencimento está a ≤ diasAntecedenciaVencimento dias.
 * Dispara email via Resend (wrapper minimal) para responsáveis e/ou
 * colaboradores conforme config. Marca alerta como `notificado` para evitar
 * re-envio diário.
 *
 * Se `RESEND_API_KEY` não estiver disponível em runtime, a CF loga o alerta
 * em `auditLogs` (action `EC_ALERTA_EMAIL_SKIPPED`) e não bloqueia. Permite
 * que scheduled continue rodando sem quebrar caso secret tenha sido revogado.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

const resendApiKey = defineSecret('RESEND_API_KEY');

const FROM_EMAIL = 'alertas@app.labclinmg.com.br';
const FROM_NAME = 'HC Quality — Educação Continuada';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const ec_scheduledAlertasVencimento = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'America/Sao_Paulo',
    secrets: [resendApiKey],
    retryCount: 2,
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();

    let apiKey: string | null = null;
    try {
      apiKey = resendApiKey.value();
    } catch {
      apiKey = null;
    }
    const resend = apiKey ? new Resend(apiKey) : null;

    // Itera labs com config ativa via collectionGroup
    const configsSnap = await db.collectionGroup('configAlertas').get();

    let totalProcessados = 0;
    let totalEnviados = 0;

    for (const configDoc of configsSnap.docs) {
      const cfg = configDoc.data();
      const labId = cfg['labId'] as string | undefined;
      if (!labId) continue;
      if (!cfg['emailResponsavel'] && !cfg['emailColaborador']) continue;
      const dias = (cfg['diasAntecedenciaVencimento'] as number | undefined) ?? 30;
      const emailsCopia = (cfg['emailsCopia'] as string[] | undefined) ?? [];

      // Busca alertas pendente/notificado cujo vencimento está dentro da janela
      const limite = now + dias * MS_POR_DIA;
      const alertasSnap = await db
        .collection(`educacaoContinuada/${labId}/alertasVencimento`)
        .where('status', 'in', ['pendente', 'notificado'])
        .get();

      for (const alertaDoc of alertasSnap.docs) {
        const a = alertaDoc.data();
        const vencMillis = (a['dataVencimento'] as admin.firestore.Timestamp).toMillis();
        if (vencMillis > limite) continue; // fora da janela
        totalProcessados++;

        const treinamentoId = a['treinamentoId'] as string;
        const treinSnap = await db
          .doc(`educacaoContinuada/${labId}/treinamentos/${treinamentoId}`)
          .get();
        const titulo = (treinSnap.data()?.['titulo'] as string | undefined) ?? 'Treinamento';
        const responsavel = (treinSnap.data()?.['responsavel'] as string | undefined) ?? '';

        const diasRestantes = Math.ceil((vencMillis - now) / MS_POR_DIA);
        const subject = diasRestantes < 0
          ? `[VENCIDO] ${titulo}`
          : `Vencimento em ${diasRestantes} dia(s): ${titulo}`;

        const recipients: string[] = [];
        // emailResponsavel: busca email do usuário criador (simplificado — usa emailsCopia)
        if (cfg['emailResponsavel']) {
          recipients.push(...emailsCopia);
        }
        // emailColaborador: pra MVP, inclui emailsCopia também — lista de colaboradores
        // por treinamento não existe no schema atual. Futuro: tabela de assinaturas.
        if (cfg['emailColaborador']) {
          recipients.push(...emailsCopia);
        }
        const recipientsUnicos = Array.from(new Set(recipients));

        if (recipientsUnicos.length === 0 || !resend) {
          // Sem destinatários ou sem Resend — loga e pula
          db.collection('auditLogs')
            .add({
              action: resend ? 'EC_ALERTA_EMAIL_NO_RECIPIENT' : 'EC_ALERTA_EMAIL_SKIPPED',
              labId,
              payload: {
                alertaId: alertaDoc.id,
                treinamentoId,
                diasRestantes,
                motivo: resend ? 'sem destinatários configurados' : 'RESEND_API_KEY não disponível',
              },
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            })
            .catch(() => {});
          continue;
        }

        try {
          await resend.emails.send({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: recipientsUnicos,
            subject,
            html: buildEmailHtml({
              titulo,
              diasRestantes,
              responsavel,
              dataVencimento: new Date(vencMillis).toLocaleDateString('pt-BR'),
            }),
          });
          totalEnviados++;

          // Marca como notificado
          await alertaDoc.ref.update({ status: 'notificado' });

          db.collection('auditLogs')
            .add({
              action: 'EC_ALERTA_EMAIL_ENVIADO',
              labId,
              payload: {
                alertaId: alertaDoc.id,
                treinamentoId,
                diasRestantes,
                recipientCount: recipientsUnicos.length,
              },
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            })
            .catch(() => {});
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          db.collection('auditLogs')
            .add({
              action: 'EC_ALERTA_EMAIL_ERROR',
              labId,
              payload: { alertaId: alertaDoc.id, error: msg },
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            })
            .catch(() => {});
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[ec_scheduledAlertasVencimento] processados=${totalProcessados} enviados=${totalEnviados}`,
    );
  },
);

function buildEmailHtml(p: {
  titulo: string;
  diasRestantes: number;
  responsavel: string;
  dataVencimento: string;
}): string {
  const urgenciaCls = p.diasRestantes < 0 ? '#991b1b' : p.diasRestantes <= 7 ? '#ea580c' : '#0369a1';
  const urgenciaTexto = p.diasRestantes < 0
    ? `Vencido há ${Math.abs(p.diasRestantes)} dia(s)`
    : `Vence em ${p.diasRestantes} dia(s)`;
  return `<!doctype html>
<html><body style="margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;background:#f1f5f9;color:#0f172a;">
  <div style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-radius:12px;">
    <p style="margin:0 0 4px;font-size:12px;color:#64748b;">Educação Continuada · HC Quality</p>
    <h1 style="margin:0 0 16px;font-size:22px;">${p.titulo}</h1>
    <p style="display:inline-block;padding:6px 14px;border-radius:999px;background:${urgenciaCls}15;color:${urgenciaCls};font-weight:600;font-size:13px;">${urgenciaTexto}</p>
    <p style="margin:16px 0 8px;color:#334155;">Data de vencimento: <strong>${p.dataVencimento}</strong></p>
    ${p.responsavel ? `<p style="margin:0;color:#334155;">Responsável: <strong>${p.responsavel}</strong></p>` : ''}
    <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;" />
    <p style="margin:0;color:#64748b;font-size:13px;">Este alerta foi enviado automaticamente. Para desativar, ajuste a configuração de alertas no módulo.</p>
  </div>
</body></html>`;
}
