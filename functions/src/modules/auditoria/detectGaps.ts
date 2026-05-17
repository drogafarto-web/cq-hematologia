/**
 * detectGaps — Cloud Function (onCall)
 *
 * Scans multiple modules looking for compliance gaps before audit.
 * Returns structured gap detections with severity and recommendations.
 *
 * Checks:
 * - Fornecedores without evaluation in 12 months
 * - Equipment with expired calibration
 * - Missing training records for current year
 * - Documents past revision date
 * - Risk map not reviewed in 12 months
 * - NCs open for more than 30 days without treatment
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const db = getFirestore();

// ──────────────────────────────────────────────────────────────────────────
// Input validation
// ──────────────────────────────────────────────────────────────────────────

const DetectGapsInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
});

type DetectGapsInputType = z.infer<typeof DetectGapsInput>;

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

interface GapDetection {
  moduloOrigem: string;
  descricao: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa';
  recomendacao: string;
  indicadorRelacionado: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────────────────────────

function monthsSince(date: Date): number {
  const now = new Date();
  return (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
}

function daysSince(date: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ──────────────────────────────────────────────────────────────────────────
// Gap detection functions
// ──────────────────────────────────────────────────────────────────────────

async function detectFornecedorGaps(labId: string): Promise<GapDetection[]> {
  const gaps: GapDetection[] = [];

  const snap = await db
    .collection(`labs/${labId}/fornecedores`)
    .where('deletadoEm', '==', null)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const ultimaAvaliacao = data.ultimaAvaliacao?.toDate?.() ?? data.dataAvaliacao?.toDate?.();

    if (!ultimaAvaliacao) {
      gaps.push({
        moduloOrigem: 'fornecedores',
        descricao: `Fornecedor "${data.nome || doc.id}" nunca foi avaliado.`,
        severidade: 'alta',
        recomendacao: 'Realizar avaliação inicial do fornecedor conforme procedimento de qualificação.',
        indicadorRelacionado: 'fornecedor.avaliacao',
      });
    } else if (monthsSince(ultimaAvaliacao) > 12) {
      gaps.push({
        moduloOrigem: 'fornecedores',
        descricao: `Fornecedor "${data.nome || doc.id}" com avaliação vencida (${monthsSince(ultimaAvaliacao)} meses).`,
        severidade: 'media',
        recomendacao: 'Programar reavaliação do fornecedor. Prazo máximo: 12 meses entre avaliações.',
        indicadorRelacionado: 'fornecedor.avaliacao',
      });
    }
  }

  return gaps;
}

async function detectEquipamentoGaps(labId: string): Promise<GapDetection[]> {
  const gaps: GapDetection[] = [];
  const now = new Date();

  // Check calibration certificates
  const certSnap = await db
    .collection(`labs/${labId}/certificados-calibracao`)
    .where('deletadoEm', '==', null)
    .get();

  for (const doc of certSnap.docs) {
    const data = doc.data();
    const validade = data.validade?.toDate?.() ?? data.dataValidade?.toDate?.();

    if (validade && validade < now) {
      gaps.push({
        moduloOrigem: 'equipamentos',
        descricao: `Certificado de calibração "${data.numero || doc.id}" vencido desde ${validade.toLocaleDateString('pt-BR')}.`,
        severidade: 'critica',
        recomendacao: 'Equipamento com calibração vencida não deve ser utilizado. Providenciar recalibração imediata.',
        indicadorRelacionado: 'calibracao.validade',
      });
    }
  }

  // Check maintenance schedule
  const equipSnap = await db
    .collection(`labs/${labId}/equipamentos`)
    .where('deletadoEm', '==', null)
    .get();

  for (const doc of equipSnap.docs) {
    const data = doc.data();
    const proximaManutencao = data.proximaManutencao?.toDate?.()
      ?? data.dataProximaManutencao?.toDate?.();

    if (proximaManutencao && proximaManutencao < now) {
      gaps.push({
        moduloOrigem: 'equipamentos',
        descricao: `Equipamento "${data.nome || doc.id}" com manutenção atrasada desde ${proximaManutencao.toLocaleDateString('pt-BR')}.`,
        severidade: 'alta',
        recomendacao: 'Realizar manutenção preventiva conforme calendário. Avaliar impacto nos resultados.',
        indicadorRelacionado: 'equipamento.manutencao',
      });
    }
  }

  return gaps;
}

async function detectTreinamentoGaps(labId: string): Promise<GapDetection[]> {
  const gaps: GapDetection[] = [];
  const currentYear = new Date().getFullYear();

  // Check for training plan
  const planoSnap = await db
    .collection(`labs/${labId}/planos-treinamento`)
    .where('ano', '==', currentYear)
    .where('deletadoEm', '==', null)
    .limit(1)
    .get();

  if (planoSnap.empty) {
    gaps.push({
      moduloOrigem: 'treinamentos',
      descricao: `Plano de treinamento para ${currentYear} não encontrado.`,
      severidade: 'alta',
      recomendacao: 'Elaborar plano anual de treinamento com base nas necessidades identificadas.',
      indicadorRelacionado: 'treinamento.plano',
    });
  }

  // Check for training records in current year
  const treinSnap = await db
    .collection(`labs/${labId}/treinamentos`)
    .where('deletadoEm', '==', null)
    .get();

  const currentYearRecords = treinSnap.docs.filter((doc) => {
    const data = doc.data();
    const dataRealizacao = data.dataRealizacao?.toDate?.() ?? data.data?.toDate?.();
    return dataRealizacao && dataRealizacao.getFullYear() === currentYear;
  });

  if (currentYearRecords.length === 0 && new Date().getMonth() >= 3) {
    // Only flag if we're past Q1
    gaps.push({
      moduloOrigem: 'treinamentos',
      descricao: `Nenhum treinamento registrado para ${currentYear} (já no ${new Date().getMonth() + 1}º mês).`,
      severidade: 'media',
      recomendacao: 'Registrar treinamentos realizados e programar pendentes conforme plano anual.',
      indicadorRelacionado: 'treinamento.execucao',
    });
  }

  return gaps;
}

async function detectDocumentoGaps(labId: string): Promise<GapDetection[]> {
  const gaps: GapDetection[] = [];
  const now = new Date();

  const docSnap = await db
    .collection(`labs/${labId}/documentos`)
    .where('deletadoEm', '==', null)
    .get();

  for (const doc of docSnap.docs) {
    const data = doc.data();
    const proximaRevisao = data.proximaRevisao?.toDate?.()
      ?? data.dataProximaRevisao?.toDate?.();

    if (proximaRevisao && proximaRevisao < now) {
      const mesesAtraso = monthsSince(proximaRevisao);
      gaps.push({
        moduloOrigem: 'documentos',
        descricao: `Documento "${data.titulo || doc.id}" com revisão vencida há ${mesesAtraso} mês(es).`,
        severidade: mesesAtraso > 6 ? 'alta' : 'media',
        recomendacao: 'Revisar documento conforme ciclo estabelecido. Verificar se versão em uso está atualizada.',
        indicadorRelacionado: 'documento.revisao',
      });
    }
  }

  return gaps;
}

async function detectRiscoGaps(labId: string): Promise<GapDetection[]> {
  const gaps: GapDetection[] = [];

  const riscoSnap = await db
    .collection(`labs/${labId}/mapa-riscos`)
    .where('deletadoEm', '==', null)
    .limit(1)
    .get();

  if (riscoSnap.empty) {
    gaps.push({
      moduloOrigem: 'riscos',
      descricao: 'Mapa de riscos não encontrado no sistema.',
      severidade: 'critica',
      recomendacao: 'Elaborar mapa de riscos conforme requisitos da norma. Item obrigatório para acreditação.',
      indicadorRelacionado: 'risco.mapa',
    });
    return gaps;
  }

  const riscoData = riscoSnap.docs[0].data();
  const ultimaRevisao = riscoData.ultimaRevisao?.toDate?.()
    ?? riscoData.dataRevisao?.toDate?.();

  if (!ultimaRevisao) {
    gaps.push({
      moduloOrigem: 'riscos',
      descricao: 'Mapa de riscos sem data de revisão registrada.',
      severidade: 'alta',
      recomendacao: 'Registrar data de revisão do mapa de riscos e programar revisões periódicas.',
      indicadorRelacionado: 'risco.revisao',
    });
  } else if (monthsSince(ultimaRevisao) > 12) {
    gaps.push({
      moduloOrigem: 'riscos',
      descricao: `Mapa de riscos não revisado há ${monthsSince(ultimaRevisao)} meses (limite: 12 meses).`,
      severidade: 'alta',
      recomendacao: 'Revisar mapa de riscos. Periodicidade máxima recomendada: 12 meses.',
      indicadorRelacionado: 'risco.revisao',
    });
  }

  return gaps;
}

async function detectNCGaps(labId: string): Promise<GapDetection[]> {
  const gaps: GapDetection[] = [];

  const ncSnap = await db
    .collection(`labs/${labId}/naoConformidades`)
    .where('status', '==', 'aberta')
    .where('deletadoEm', '==', null)
    .get();

  for (const doc of ncSnap.docs) {
    const data = doc.data();
    const criadoEm = data.criadoEm?.toDate?.();

    if (criadoEm && daysSince(criadoEm) > 30) {
      const dias = daysSince(criadoEm);
      gaps.push({
        moduloOrigem: 'naoConformidades',
        descricao: `NC "${data.titulo || doc.id}" aberta há ${dias} dias sem tratamento.`,
        severidade: dias > 90 ? 'critica' : dias > 60 ? 'alta' : 'media',
        recomendacao: 'Tratar não conformidade com análise de causa raiz e ação corretiva. Prazo máximo recomendado: 30 dias.',
        indicadorRelacionado: 'nc.tratamento',
      });
    }
  }

  return gaps;
}

// ──────────────────────────────────────────────────────────────────────────
// Cloud Function export
// ──────────────────────────────────────────────────────────────────────────

export const detectGaps = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<DetectGapsInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
    }

    let input: DetectGapsInputType;
    try {
      input = DetectGapsInput.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message);
    }

    // Verify lab membership
    const userLabRef = db
      .collection('users')
      .doc(request.auth.uid)
      .collection('labs')
      .doc(input.labId);
    const userLabSnap = await userLabRef.get();
    if (!userLabSnap.exists || userLabSnap.data()?.ativo !== true) {
      throw new HttpsError('permission-denied', 'Usuário não é membro ativo do laboratório');
    }

    try {
      // Run all gap detections in parallel
      const [
        fornecedorGaps,
        equipamentoGaps,
        treinamentoGaps,
        documentoGaps,
        riscoGaps,
        ncGaps,
      ] = await Promise.all([
        detectFornecedorGaps(input.labId),
        detectEquipamentoGaps(input.labId),
        detectTreinamentoGaps(input.labId),
        detectDocumentoGaps(input.labId),
        detectRiscoGaps(input.labId),
        detectNCGaps(input.labId),
      ]);

      const allGaps: GapDetection[] = [
        ...fornecedorGaps,
        ...equipamentoGaps,
        ...treinamentoGaps,
        ...documentoGaps,
        ...riscoGaps,
        ...ncGaps,
      ];

      // Sort by severity: critica > alta > media > baixa
      const severityOrder: Record<string, number> = {
        critica: 0,
        alta: 1,
        media: 2,
        baixa: 3,
      };
      allGaps.sort((a, b) => severityOrder[a.severidade] - severityOrder[b.severidade]);

      return { gaps: allGaps };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao detectar gaps');
    }
  }
);
