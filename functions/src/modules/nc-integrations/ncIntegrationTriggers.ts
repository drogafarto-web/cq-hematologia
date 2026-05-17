/**
 * ncIntegrationTriggers.ts
 *
 * Triggers automáticos que criam NCs a partir de eventos em outros módulos.
 * Cada trigger roda como scheduled function (cron) ou Firestore trigger.
 *
 * Integrações:
 * 1. Equipamentos — calibração/manutenção vencida → NC
 * 2. Controle Temperatura — excursão térmica → NC
 * 3. Insumos — uso de insumo vencido → NC
 * 4. Reclamações — reclamação procedente → NC
 * 5. Valores Críticos — SLA estourado → NC
 * 6. Treinamentos — treinamento vencido > 30 dias → NC
 *
 * RDC 978/2025 + DICQ 4.9 + ISO 15189:2022 Cláusula 8.7
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { criarNCIntegracao, ncJaExisteParaOrigem } from '../../shared/criarNCIntegracao';

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'southamerica-east1';

// ─── 1. Equipamentos: calibração/manutenção vencida → NC ─────────────────────

export const nc_equipamentosVencidos = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '512MiB',
  },
  async () => {
    const nowMs = Date.now();
    const labsSnap = await db.collection('labs').get();
    let ncsGeradas = 0;

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;
      const equipSnap = await db.collection(`labs/${labId}/equipamentos`).get();

      for (const equipDoc of equipSnap.docs) {
        const equip = equipDoc.data();
        const equipId = equipDoc.id;
        const nomeEquip = equip.nome || equip.modelo || equipId;

        // Verificar calibração vencida
        if (equip.proximaCalibracao) {
          const calMs = equip.proximaCalibracao.toMillis?.() ?? new Date(equip.proximaCalibracao).getTime();
          if (calMs < nowMs) {
            const jaExiste = await ncJaExisteParaOrigem(labId, 'equipamentos', `cal_${equipId}`);
            if (!jaExiste) {
              await criarNCIntegracao({
                labId,
                titulo: `Calibração vencida: ${nomeEquip}`,
                descricao: `O equipamento "${nomeEquip}" (ID: ${equipId}) está com calibração vencida desde ${new Date(calMs).toLocaleDateString('pt-BR')}.\n\nAção necessária: recalibrar ou retirar de uso conforme DICQ 5.3.1.4.`,
                severidade: 'grave',
                moduloOrigem: 'equipamentos',
                origemRef: `cal_${equipId}`,
                bloqueiaOperacoes: true,
                modulosBloqueados: ['equipamentos'],
                criadoPor: 'system',
              });
              ncsGeradas++;
            }
          }
        }

        // Verificar manutenção preventiva vencida
        const manSnap = await db
          .collection(`labs/${labId}/equipamentos/${equipId}/manutencoes`)
          .where('status', '==', 'agendada')
          .get();

        for (const manDoc of manSnap.docs) {
          const man = manDoc.data();
          const dpMs = man.dataPrevista?.toMillis?.() ?? (man.dataPrevista ? new Date(man.dataPrevista).getTime() : null);
          if (!dpMs || dpMs >= nowMs) continue;

          const jaExiste = await ncJaExisteParaOrigem(labId, 'equipamentos', `man_${manDoc.id}`);
          if (!jaExiste) {
            const tipo = man.tipo || 'preventiva';
            await criarNCIntegracao({
              labId,
              titulo: `Manutenção ${tipo} vencida: ${nomeEquip}`,
              descricao: `Manutenção ${tipo} do equipamento "${nomeEquip}" venceu em ${new Date(dpMs).toLocaleDateString('pt-BR')}.\n\nDICQ 5.3.1.5 — manutenção preventiva deve ser realizada conforme cronograma.`,
              severidade: 'moderada',
              moduloOrigem: 'equipamentos',
              origemRef: `man_${manDoc.id}`,
              bloqueiaOperacoes: false,
              criadoPor: 'system',
            });
            ncsGeradas++;
          }
        }
      }
    }

    console.info(`[nc_equipamentosVencidos] NCs geradas: ${ncsGeradas}`);
  },
);

// ─── 2. Controle de Temperatura: excursão térmica → NC ───────────────────────

export const nc_temperaturaForaFaixa = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '256MiB',
  },
  async () => {
    const labsSnap = await db.collection('labs').get();
    let ncsGeradas = 0;

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;

      // Buscar leituras fora da faixa nas últimas 2 horas (sem NC já criada)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const leiturasSnap = await db
        .collection(`labs/${labId}/leituras-temperatura`)
        .where('foraFaixa', '==', true)
        .where('ncCriada', '==', false)
        .where('timestamp', '>=', twoHoursAgo)
        .get();

      for (const leitDoc of leiturasSnap.docs) {
        const leit = leitDoc.data();
        const sensorNome = leit.sensorNome || leit.sensorId || 'Sensor';
        const temp = leit.temperatura ?? leit.valor ?? '?';
        const faixaMin = leit.faixaMin ?? '?';
        const faixaMax = leit.faixaMax ?? '?';

        const jaExiste = await ncJaExisteParaOrigem(labId, 'controle-temperatura', leitDoc.id);
        if (jaExiste) continue;

        await criarNCIntegracao({
          labId,
          titulo: `Excursão térmica: ${sensorNome} (${temp}°C)`,
          descricao: `Temperatura fora da faixa aceitável.\n\nSensor: ${sensorNome}\nTemperatura registrada: ${temp}°C\nFaixa aceitável: ${faixaMin}°C a ${faixaMax}°C\n\nDICQ 5.2.6 / RDC 978 Art. 186 — monitoramento ambiental obrigatório.`,
          severidade: 'grave',
          moduloOrigem: 'controle-temperatura',
          origemRef: leitDoc.id,
          bloqueiaOperacoes: false,
          modulosBloqueados: [],
          criadoPor: 'system',
        });

        // Marcar leitura como NC criada
        await leitDoc.ref.update({ ncCriada: true });
        ncsGeradas++;
      }
    }

    console.info(`[nc_temperaturaForaFaixa] NCs geradas: ${ncsGeradas}`);
  },
);

// ─── 3. Insumos: uso de insumo vencido → NC ─────────────────────────────────

export const nc_insumoVencido = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '512MiB',
  },
  async () => {
    const nowMs = Date.now();
    const labsSnap = await db.collection('labs').get();
    let ncsGeradas = 0;

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;

      // Buscar insumos com status 'em_uso' e validade vencida
      const insumosSnap = await db
        .collection(`labs/${labId}/insumos`)
        .where('status', '==', 'em_uso')
        .where('deletadoEm', '==', null)
        .get();

      for (const insDoc of insumosSnap.docs) {
        const ins = insDoc.data();
        const validadeMs = ins.validade?.toMillis?.() ?? (ins.validade ? new Date(ins.validade).getTime() : null);
        if (!validadeMs || validadeMs >= nowMs) continue;

        const jaExiste = await ncJaExisteParaOrigem(labId, 'insumos', insDoc.id);
        if (jaExiste) continue;

        const nomeInsumo = ins.nome || ins.produto || insDoc.id;
        const lote = ins.lote || 'N/A';

        await criarNCIntegracao({
          labId,
          titulo: `Insumo vencido em uso: ${nomeInsumo}`,
          descricao: `O insumo "${nomeInsumo}" (Lote: ${lote}) está vencido desde ${new Date(validadeMs).toLocaleDateString('pt-BR')} e continua com status "em uso".\n\nAção imediata: retirar de uso e verificar resultados emitidos com este lote.\n\nDICQ 5.3.2 / RDC 978 Art. 191.`,
          severidade: 'critica',
          moduloOrigem: 'insumos',
          origemRef: insDoc.id,
          bloqueiaOperacoes: true,
          modulosBloqueados: ['insumos'],
          criadoPor: 'system',
        });
        ncsGeradas++;
      }
    }

    console.info(`[nc_insumoVencido] NCs geradas: ${ncsGeradas}`);
  },
);

// ─── 4. Reclamações: reclamação procedente → NC ──────────────────────────────

export const nc_reclamacaoProcedente = onDocumentUpdated(
  {
    document: 'labs/{labId}/reclamacoes/{reclamacaoId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Detectar transição para "procedente"
    if (before.procedente !== true && after.procedente === true) {
      const { labId, reclamacaoId } = event.params;

      const jaExiste = await ncJaExisteParaOrigem(labId, 'reclamacoes', reclamacaoId);
      if (jaExiste) return;

      const assunto = after.assunto || after.titulo || 'Reclamação';
      const descricaoRec = after.descricao || '';

      await criarNCIntegracao({
        labId,
        titulo: `Reclamação procedente: ${assunto.substring(0, 60)}`,
        descricao: `Reclamação classificada como procedente.\n\nAssunto: ${assunto}\nDescrição: ${descricaoRec.substring(0, 200)}\nReclamante: ${after.reclamante || 'Não informado'}\n\nDICQ 4.8 — toda reclamação procedente deve gerar ação corretiva.`,
        severidade: 'moderada',
        moduloOrigem: 'reclamacoes',
        origemRef: reclamacaoId,
        bloqueiaOperacoes: false,
        criadoPor: after.atualizadoPor || 'system',
      });
    }
  },
);

// ─── 5. Valores Críticos: SLA estourado → NC ────────────────────────────────

export const nc_criticoSLAVencido = onDocumentUpdated(
  {
    document: 'labs/{labId}/criticos-escalacoes/{escalacaoId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Detectar transição de SLA para "vencido"
    if (before.sla_status !== 'vencido' && after.sla_status === 'vencido') {
      const { labId, escalacaoId } = event.params;

      const jaExiste = await ncJaExisteParaOrigem(labId, 'criticos', escalacaoId);
      if (jaExiste) return;

      const paciente = after.pacienteNome || after.pacienteId || 'Não identificado';
      const analito = after.analito || after.exame || 'Valor crítico';
      const slaMinutos = after.sla_minutos_target || 30;

      await criarNCIntegracao({
        labId,
        titulo: `SLA vencido: valor crítico não comunicado (${analito})`,
        descricao: `Valor crítico não foi comunicado dentro do prazo SLA de ${slaMinutos} minutos.\n\nPaciente: ${paciente}\nAnalito: ${analito}\nSLA target: ${slaMinutos} min\n\nDICQ 5.7.2 — comunicação de valores críticos é obrigatória com registro de tempo.`,
        severidade: 'critica',
        moduloOrigem: 'criticos',
        origemRef: escalacaoId,
        bloqueiaOperacoes: false,
        criadoPor: 'system',
      });
    }
  },
);

// ─── 6. Treinamentos: vencido > 30 dias → NC ────────────────────────────────

export const nc_treinamentoVencido = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '512MiB',
  },
  async () => {
    const nowMs = Date.now();
    const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
    const labsSnap = await db.collection('labs').get();
    let ncsGeradas = 0;

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;

      // Buscar treinamentos obrigatórios vencidos
      const treinSnap = await db
        .collection(`labs/${labId}/treinamentos`)
        .where('obrigatorio', '==', true)
        .where('status', '==', 'vencido')
        .where('deletadoEm', '==', null)
        .get();

      for (const treinDoc of treinSnap.docs) {
        const trein = treinDoc.data();
        const vencidoEm = trein.vencidoEm?.toMillis?.() ?? trein.dataVencimento?.toMillis?.() ?? null;
        if (!vencidoEm) continue;

        // Só gera NC se vencido há mais de 30 dias
        if (nowMs - vencidoEm < TRINTA_DIAS_MS) continue;

        const jaExiste = await ncJaExisteParaOrigem(labId, 'treinamentos', treinDoc.id);
        if (jaExiste) continue;

        const nomeTrein = trein.titulo || trein.nome || 'Treinamento';
        const colaborador = trein.colaboradorNome || trein.colaboradorId || 'Colaborador';

        await criarNCIntegracao({
          labId,
          titulo: `Treinamento obrigatório vencido: ${nomeTrein}`,
          descricao: `O treinamento obrigatório "${nomeTrein}" do colaborador ${colaborador} está vencido há mais de 30 dias (desde ${new Date(vencidoEm).toLocaleDateString('pt-BR')}).\n\nDICQ 5.1.5 / RDC 978 Art. 124 — treinamento contínuo é obrigatório.`,
          severidade: 'moderada',
          moduloOrigem: 'treinamentos',
          origemRef: treinDoc.id,
          bloqueiaOperacoes: false,
          criadoPor: 'system',
        });
        ncsGeradas++;
      }
    }

    console.info(`[nc_treinamentoVencido] NCs geradas: ${ncsGeradas}`);
  },
);
