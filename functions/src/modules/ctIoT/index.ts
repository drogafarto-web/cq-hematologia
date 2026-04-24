/**
 * modules/ctIoT/index.ts
 *
 * HTTP endpoint que recebe leituras do ESP32 + jobs agendados do módulo
 * Controle de Temperatura.
 *
 * Fluxo do endpoint (registrarLeituraIoT):
 *   1. Lê `X-Device-Token` do header e calcula SHA-256 → procura dispositivo
 *      com `tokenAcesso === hash` na collectionGroup `dispositivos-iot`.
 *   2. Rejeita (401) token inexistente, desativado ou deletado logicamente.
 *   3. Resolve equipamento vinculado + limites → avalia foraDosLimites.
 *   4. writeBatch atômico:
 *        - cria leitura (origem: 'automatica_iot', status: 'realizada')
 *        - se fora dos limites, cria NC sombra com status 'aberta'
 *        - atualiza `ultimaTransmissao` do dispositivo
 *        - marca `LeituraPrevista` mais próxima (janela ±30 min) como realizada
 *   5. Retorna { ok, leituraId, ncId }.
 *
 * Scheduled jobs:
 *   - scheduledGenerateLeiturasPrevistas (01:00 São Paulo) — gera as previsões
 *     do dia seguinte para cada equipamento ativo (RN-03).
 *   - scheduledMarcarLeiturasPerdidas (a cada 30 min) — marca previsões
 *     pendentes com mais de 1h de atraso como 'perdida' (RN-04).
 *
 * ⚠️ Todas as operações usam Admin SDK — rules não se aplicam. A legitimidade
 * é garantida exclusivamente pelo token + contexto de lab do dispositivo.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

const REGION = 'southamerica-east1';

interface IoTPayload {
  temperatura: number;
  umidade?: number;
  temperaturaMax?: number;
  temperaturaMin?: number;
}

interface DispositivoLookup {
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
  labId: string;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function extractLabId(ref: FirebaseFirestore.DocumentReference): string | null {
  // Path esperado: controleTemperatura/{labId}/dispositivos-iot/{id}
  const parts = ref.path.split('/');
  return parts.length >= 2 && parts[0] === 'controleTemperatura' ? parts[1] : null;
}

async function findDispositivoByTokenHash(
  hash: string,
): Promise<DispositivoLookup | null> {
  const snap = await admin
    .firestore()
    .collectionGroup('dispositivos-iot')
    .where('tokenAcesso', '==', hash)
    .where('ativo', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const labId = extractLabId(doc.ref);
  if (!labId) return null;
  const data = doc.data();
  if (data.deletadoEm !== null && data.deletadoEm !== undefined) return null;
  return { ref: doc.ref, data, labId };
}

function avaliarForaDosLimites(
  temperatura: number,
  umidade: number | undefined,
  limites: {
    temperaturaMin: number;
    temperaturaMax: number;
    umidadeMin?: number;
    umidadeMax?: number;
  },
): { fora: boolean; violado: 'max' | 'min' | 'umidade' | null } {
  if (temperatura > limites.temperaturaMax) return { fora: true, violado: 'max' };
  if (temperatura < limites.temperaturaMin) return { fora: true, violado: 'min' };
  if (
    umidade !== undefined &&
    ((limites.umidadeMax !== undefined && umidade > limites.umidadeMax) ||
      (limites.umidadeMin !== undefined && umidade < limites.umidadeMin))
  ) {
    return { fora: true, violado: 'umidade' };
  }
  return { fora: false, violado: null };
}

function assinaturaServerSide(dispositivoId: string, labId: string, ts: FirebaseFirestore.Timestamp): {
  hash: string;
  operatorId: string;
  ts: FirebaseFirestore.Timestamp;
} {
  const operatorId = `iot:${dispositivoId}`;
  const hash = sha256Hex(`${operatorId}|${labId}|${ts.toMillis()}`);
  return { hash, operatorId, ts };
}

const TURNO_IOT = 'automatica' as const;

export const registrarLeituraIoT = onRequest(
  { region: REGION, cors: true, memory: '256MiB', timeoutSeconds: 20 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido.' });
      return;
    }

    const tokenPlain = req.get('x-device-token') ?? '';
    if (!tokenPlain || tokenPlain.length < 32) {
      res.status(401).json({ error: 'Token ausente ou inválido.' });
      return;
    }

    const hash = sha256Hex(tokenPlain);
    const lookup = await findDispositivoByTokenHash(hash);
    if (!lookup) {
      res.status(401).json({ error: 'Token não autorizado.' });
      return;
    }

    const body = req.body as Partial<IoTPayload> | undefined;
    const temperatura = Number(body?.temperatura);
    if (!Number.isFinite(temperatura)) {
      res.status(400).json({ error: 'Campo `temperatura` obrigatório e numérico.' });
      return;
    }
    const umidade = body?.umidade !== undefined ? Number(body.umidade) : undefined;
    const tMax =
      body?.temperaturaMax !== undefined ? Number(body.temperaturaMax) : temperatura;
    const tMin =
      body?.temperaturaMin !== undefined ? Number(body.temperaturaMin) : temperatura;

    const { labId, data: dispData, ref: dispRef } = lookup;
    const equipamentoId = dispData.equipamentoId as string;
    if (!equipamentoId) {
      res.status(409).json({ error: 'Dispositivo sem equipamento vinculado.' });
      return;
    }

    const db = admin.firestore();
    const equipRef = db
      .collection('controleTemperatura')
      .doc(labId)
      .collection('equipamentos')
      .doc(equipamentoId);
    const equipSnap = await equipRef.get();
    if (!equipSnap.exists) {
      res.status(409).json({ error: 'Equipamento não encontrado.' });
      return;
    }
    const equip = equipSnap.data() as FirebaseFirestore.DocumentData;
    const limites = equip.limites as {
      temperaturaMin: number;
      temperaturaMax: number;
      umidadeMin?: number;
      umidadeMax?: number;
    };
    const avaliacao = avaliarForaDosLimites(temperatura, umidade, limites);
    const agora = admin.firestore.Timestamp.now();

    // Janela ±30min pra linkar a LeituraPrevista mais próxima.
    const janelaMs = 30 * 60 * 1000;
    const previstasSnap = await db
      .collection('controleTemperatura')
      .doc(labId)
      .collection('leituras-previstas')
      .where('equipamentoId', '==', equipamentoId)
      .where('status', '==', 'pendente')
      .where('dataHoraPrevista', '>=', admin.firestore.Timestamp.fromMillis(agora.toMillis() - janelaMs))
      .where('dataHoraPrevista', '<=', admin.firestore.Timestamp.fromMillis(agora.toMillis() + janelaMs))
      .limit(1)
      .get();
    const previstaRef = previstasSnap.empty ? null : previstasSnap.docs[0].ref;

    const leiturasCol = db
      .collection('controleTemperatura')
      .doc(labId)
      .collection('leituras');
    const leituraRef = leiturasCol.doc();

    const assinatura = assinaturaServerSide(dispRef.id, labId, agora);
    const batch = db.batch();
    batch.set(leituraRef, {
      labId,
      equipamentoId,
      dataHora: agora,
      turno: TURNO_IOT,
      temperaturaAtual: temperatura,
      umidade: umidade ?? null,
      temperaturaMax: tMax,
      temperaturaMin: tMin,
      foraDosLimites: avaliacao.fora,
      origem: 'automatica_iot',
      dispositivoIoTId: dispRef.id,
      status: 'realizada',
      justificativaPerdida: null,
      assinatura,
      observacao: null,
      deletadoEm: null,
    });

    let ncId: string | null = null;
    if (avaliacao.fora && avaliacao.violado !== null) {
      const ncRef = db
        .collection('controleTemperatura')
        .doc(labId)
        .collection('ncs')
        .doc();
      ncId = ncRef.id;
      batch.set(ncRef, {
        labId,
        leituraId: leituraRef.id,
        equipamentoId,
        temperaturaRegistrada: temperatura,
        limiteViolado: avaliacao.violado,
        descricao: `Leitura automática fora dos limites (${avaliacao.violado}). Valor: ${temperatura.toFixed(2)}.`,
        acaoImediata: 'Ação imediata pendente de registro pelo responsável.',
        acaoCorretiva: null,
        responsavelAcao: `iot:${dispRef.id}`,
        dataAbertura: agora,
        dataResolucao: null,
        status: 'aberta',
        assinatura,
        deletadoEm: null,
      });
    }

    batch.update(dispRef, {
      ultimaTransmissao: agora,
      online: true,
    });

    if (previstaRef) {
      batch.update(previstaRef, {
        status: 'realizada',
        leituraId: leituraRef.id,
      });
    }

    await batch.commit();

    res.status(200).json({
      ok: true,
      leituraId: leituraRef.id,
      ncId,
      foraDosLimites: avaliacao.fora,
      violado: avaliacao.violado,
    });
  },
);

// ─── Scheduled: geração de previsões do dia seguinte (RN-03) ─────────────────

interface DiaCalendario {
  obrigatorio: boolean;
  horarios: string[];
}

interface CalendarioConfig {
  diasUteis: DiaCalendario;
  sabado: DiaCalendario;
  domingo: DiaCalendario;
  feriados: DiaCalendario;
}

function diaDoCalendarioPara(d: Date, cal: CalendarioConfig): DiaCalendario {
  const w = d.getDay(); // 0=dom, 6=sab
  if (w === 0) return cal.domingo;
  if (w === 6) return cal.sabado;
  return cal.diasUteis;
  // Feriados exigiriam lookup externo — pendente (débito CT-03).
}

function turnoFromHour(hour: number): 'manha' | 'tarde' | 'noite' {
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
}

export const scheduledGenerateLeiturasPrevistas = onSchedule(
  { region: REGION, schedule: '0 1 * * *', timeZone: 'America/Sao_Paulo', memory: '256MiB' },
  async () => {
    const db = admin.firestore();
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 0, 0);

    const tenants = await db.collection('controleTemperatura').listDocuments();
    let total = 0;
    for (const tenantRef of tenants) {
      const labId = tenantRef.id;
      const equipSnap = await tenantRef
        .collection('equipamentos')
        .where('status', '==', 'ativo')
        .get();
      if (equipSnap.empty) continue;

      const batch = db.batch();
      for (const eqDoc of equipSnap.docs) {
        const eq = eqDoc.data();
        if (eq.deletadoEm) continue;
        const cal = eq.calendario as CalendarioConfig | undefined;
        if (!cal) continue;
        const dia = diaDoCalendarioPara(amanha, cal);
        if (!dia.obrigatorio || dia.horarios.length === 0) continue;

        for (const horaStr of dia.horarios) {
          const [h, m] = horaStr.split(':').map((s) => Number(s));
          if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
          const d = new Date(amanha);
          d.setHours(h, m, 0, 0);
          const previstaRef = tenantRef.collection('leituras-previstas').doc();
          batch.set(previstaRef, {
            labId,
            equipamentoId: eqDoc.id,
            dataHoraPrevista: admin.firestore.Timestamp.fromDate(d),
            turno: turnoFromHour(h),
            status: 'pendente',
            leituraId: null,
          });
          total += 1;
        }
      }
      if (total > 0) await batch.commit();
    }
    console.info(`[ctIoT] Previsões geradas para amanhã: ${total}`);
  },
);

// ─── Scheduled: marcar leituras perdidas (RN-04) ─────────────────────────────

export const scheduledMarcarLeiturasPerdidas = onSchedule(
  { region: REGION, schedule: 'every 30 minutes', timeZone: 'America/Sao_Paulo', memory: '256MiB' },
  async () => {
    const db = admin.firestore();
    const agora = admin.firestore.Timestamp.now();
    const limiar = admin.firestore.Timestamp.fromMillis(agora.toMillis() - 60 * 60 * 1000);

    const tenants = await db.collection('controleTemperatura').listDocuments();
    let marcadas = 0;
    for (const tenantRef of tenants) {
      const snap = await tenantRef
        .collection('leituras-previstas')
        .where('status', '==', 'pendente')
        .where('dataHoraPrevista', '<=', limiar)
        .limit(500)
        .get();
      if (snap.empty) continue;
      const batch = db.batch();
      for (const d of snap.docs) batch.update(d.ref, { status: 'perdida' });
      await batch.commit();
      marcadas += snap.size;
    }
    console.info(`[ctIoT] Previsões marcadas como perdidas: ${marcadas}`);
  },
);
