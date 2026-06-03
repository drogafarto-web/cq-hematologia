/**
 * generateAISuggestion — Cloud Function (onCall)
 *
 * Deterministic rule-based analysis of module data to suggest conformity levels
 * for audit checklist items. No external AI API — purely data-driven scoring.
 *
 * Mapping logic:
 * - calibracao indicators: check certificate validity dates
 * - fornecedores: check evaluation existence and recency (< 12 months)
 * - treinamentos: check training records for current year
 * - equipamentos: check maintenance calendar compliance
 * - riscos: check risk map existence and review date (< 12 months)
 * - documentos: check document revision within cycle
 * - pessoal: check qualification registration and validity
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const db = getFirestore();

// ──────────────────────────────────────────────────────────────────────────
// Input validation
// ──────────────────────────────────────────────────────────────────────────

const GenerateAISuggestionInput = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  indicadorId: z.string().min(1, 'indicadorId é obrigatório'),
});

type GenerateAISuggestionInputType = z.infer<typeof GenerateAISuggestionInput>;

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

interface AISuggestion {
  indicadorId: string;
  nivelSugerido: number;
  confianca: 'alta' | 'media' | 'baixa';
  justificativa: string;
  dadosAnalisados: string[];
  gaps: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Module mapping: indicador prefix -> analysis function
// ──────────────────────────────────────────────────────────────────────────

type AnalysisFn = (labId: string, indicadorId: string) => Promise<AISuggestion>;

const MODULE_ANALYZERS: Record<string, AnalysisFn> = {
  calibracao: analyzeCalibracao,
  fornecedor: analyzeFornecedores,
  treinamento: analyzeTreinamentos,
  equipamento: analyzeEquipamentos,
  risco: analyzeRiscos,
  documento: analyzeDocumentos,
  pessoal: analyzePessoal,
};

function getModuleFromIndicador(indicadorId: string): string | null {
  const prefix = indicadorId.split('.')[0]?.toLowerCase() ?? '';
  for (const key of Object.keys(MODULE_ANALYZERS)) {
    if (prefix.includes(key)) {
      return key;
    }
  }
  // Fallback: try matching by DICQ bloco patterns
  const blocoMap: Record<string, string> = {
    a: 'pessoal',
    b: 'documento',
    c: 'equipamento',
    d: 'calibracao',
    e: 'risco',
    f: 'fornecedor',
    g: 'treinamento',
  };
  const bloco = indicadorId.charAt(0)?.toLowerCase();
  return blocoMap[bloco] ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// Helper: calculate months since a date
// ──────────────────────────────────────────────────────────────────────────

function monthsSince(date: Date): number {
  const now = new Date();
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

function scoreToLevel(score: number): number {
  // score 0-100 mapped to level 1-5
  if (score >= 90) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

function scoreToConfianca(dataPoints: number): 'alta' | 'media' | 'baixa' {
  if (dataPoints >= 5) return 'alta';
  if (dataPoints >= 2) return 'media';
  return 'baixa';
}

// ──────────────────────────────────────────────────────────────────────────
// Analysis functions per module
// ──────────────────────────────────────────────────────────────────────────

async function analyzeCalibracao(labId: string, indicadorId: string): Promise<AISuggestion> {
  const dadosAnalisados: string[] = [];
  const gaps: string[] = [];

  const certSnap = await db
    .collection(`labs/${labId}/certificados-calibracao`)
    .where('deletadoEm', '==', null)
    .get();

  dadosAnalisados.push(`${certSnap.size} certificado(s) de calibração encontrado(s)`);

  if (certSnap.empty) {
    return {
      indicadorId,
      nivelSugerido: 1,
      confianca: 'alta',
      justificativa: 'Nenhum certificado de calibração registrado no sistema.',
      dadosAnalisados,
      gaps: ['Ausência total de certificados de calibração'],
    };
  }

  let validCount = 0;
  let expiredCount = 0;
  const now = new Date();

  for (const doc of certSnap.docs) {
    const data = doc.data();
    const validade = data.validade?.toDate?.() ?? data.dataValidade?.toDate?.();
    if (validade && validade > now) {
      validCount++;
    } else {
      expiredCount++;
      gaps.push(`Certificado ${data.numero || doc.id} vencido`);
    }
  }

  dadosAnalisados.push(`${validCount} válido(s), ${expiredCount} vencido(s)`);

  const total = certSnap.size;
  const score = total > 0 ? (validCount / total) * 100 : 0;

  const justificativa =
    expiredCount === 0
      ? 'Todos os certificados de calibração estão dentro da validade.'
      : `${expiredCount} de ${total} certificado(s) com validade expirada. Necessário providenciar recalibração.`;

  return {
    indicadorId,
    nivelSugerido: scoreToLevel(score),
    confianca: scoreToConfianca(total),
    justificativa,
    dadosAnalisados,
    gaps: gaps.slice(0, 10), // limit gap list
  };
}

async function analyzeFornecedores(labId: string, indicadorId: string): Promise<AISuggestion> {
  const dadosAnalisados: string[] = [];
  const gaps: string[] = [];

  const fornSnap = await db
    .collection(`labs/${labId}/fornecedores`)
    .where('deletadoEm', '==', null)
    .get();

  dadosAnalisados.push(`${fornSnap.size} fornecedor(es) registrado(s)`);

  if (fornSnap.empty) {
    return {
      indicadorId,
      nivelSugerido: 1,
      confianca: 'media',
      justificativa: 'Nenhum fornecedor registrado no sistema.',
      dadosAnalisados,
      gaps: ['Ausência de registro de fornecedores'],
    };
  }

  let evaluatedRecently = 0;
  let withoutEvaluation = 0;

  for (const doc of fornSnap.docs) {
    const data = doc.data();
    const ultimaAvaliacao = data.ultimaAvaliacao?.toDate?.() ?? data.dataAvaliacao?.toDate?.();

    if (!ultimaAvaliacao) {
      withoutEvaluation++;
      gaps.push(`Fornecedor "${data.nome || doc.id}" sem avaliação registrada`);
    } else if (monthsSince(ultimaAvaliacao) <= 12) {
      evaluatedRecently++;
    } else {
      gaps.push(`Fornecedor "${data.nome || doc.id}" com avaliação há mais de 12 meses`);
    }
  }

  dadosAnalisados.push(
    `${evaluatedRecently} avaliado(s) nos últimos 12 meses, ${withoutEvaluation} sem avaliação`,
  );

  const total = fornSnap.size;
  const score = total > 0 ? (evaluatedRecently / total) * 100 : 0;

  const justificativa =
    withoutEvaluation === 0 && evaluatedRecently === total
      ? 'Todos os fornecedores possuem avaliação atualizada (< 12 meses).'
      : `${total - evaluatedRecently} fornecedor(es) necessitam avaliação ou reavaliação.`;

  return {
    indicadorId,
    nivelSugerido: scoreToLevel(score),
    confianca: scoreToConfianca(total),
    justificativa,
    dadosAnalisados,
    gaps: gaps.slice(0, 10),
  };
}

async function analyzeTreinamentos(labId: string, indicadorId: string): Promise<AISuggestion> {
  const dadosAnalisados: string[] = [];
  const gaps: string[] = [];
  const currentYear = new Date().getFullYear();

  const treinSnap = await db
    .collection(`labs/${labId}/treinamentos`)
    .where('deletadoEm', '==', null)
    .get();

  dadosAnalisados.push(`${treinSnap.size} registro(s) de treinamento total`);

  const currentYearRecords = treinSnap.docs.filter((doc) => {
    const data = doc.data();
    const dataRealizacao = data.dataRealizacao?.toDate?.() ?? data.data?.toDate?.();
    return dataRealizacao && dataRealizacao.getFullYear() === currentYear;
  });

  dadosAnalisados.push(
    `${currentYearRecords.length} treinamento(s) no ano corrente (${currentYear})`,
  );

  if (currentYearRecords.length === 0) {
    gaps.push(`Nenhum treinamento registrado para o ano ${currentYear}`);
  }

  // Check if there's a training plan
  const planoSnap = await db
    .collection(`labs/${labId}/planos-treinamento`)
    .where('ano', '==', currentYear)
    .where('deletadoEm', '==', null)
    .limit(1)
    .get();

  if (planoSnap.empty) {
    gaps.push(`Plano de treinamento para ${currentYear} não encontrado`);
    dadosAnalisados.push('Plano de treinamento anual: não encontrado');
  } else {
    dadosAnalisados.push('Plano de treinamento anual: encontrado');
  }

  // Score based on existence of records and plan
  let score = 0;
  if (!planoSnap.empty) score += 40;
  if (currentYearRecords.length > 0) score += 30;
  if (currentYearRecords.length >= 3) score += 30;

  const justificativa =
    gaps.length === 0
      ? `Treinamentos registrados para ${currentYear} com plano anual vigente.`
      : `Identificadas ${gaps.length} pendência(s) em treinamentos: ${gaps[0]}.`;

  return {
    indicadorId,
    nivelSugerido: scoreToLevel(score),
    confianca: scoreToConfianca(currentYearRecords.length + (planoSnap.empty ? 0 : 1)),
    justificativa,
    dadosAnalisados,
    gaps: gaps.slice(0, 10),
  };
}

async function analyzeEquipamentos(labId: string, indicadorId: string): Promise<AISuggestion> {
  const dadosAnalisados: string[] = [];
  const gaps: string[] = [];

  const equipSnap = await db
    .collection(`labs/${labId}/equipamentos`)
    .where('deletadoEm', '==', null)
    .get();

  dadosAnalisados.push(`${equipSnap.size} equipamento(s) registrado(s)`);

  if (equipSnap.empty) {
    return {
      indicadorId,
      nivelSugerido: 1,
      confianca: 'media',
      justificativa: 'Nenhum equipamento registrado no sistema.',
      dadosAnalisados,
      gaps: ['Ausência de registro de equipamentos'],
    };
  }

  let compliant = 0;
  const now = new Date();

  for (const doc of equipSnap.docs) {
    const data = doc.data();
    const proximaManutencao =
      data.proximaManutencao?.toDate?.() ?? data.dataProximaManutencao?.toDate?.();

    if (!proximaManutencao) {
      gaps.push(`Equipamento "${data.nome || doc.id}" sem manutenção programada`);
    } else if (proximaManutencao >= now) {
      compliant++;
    } else {
      gaps.push(`Equipamento "${data.nome || doc.id}" com manutenção atrasada`);
    }
  }

  dadosAnalisados.push(
    `${compliant} com manutenção em dia, ${equipSnap.size - compliant} pendente(s)`,
  );

  const score = equipSnap.size > 0 ? (compliant / equipSnap.size) * 100 : 0;

  const justificativa =
    compliant === equipSnap.size
      ? 'Todos os equipamentos possuem manutenção em dia conforme calendário.'
      : `${equipSnap.size - compliant} equipamento(s) com manutenção atrasada ou não programada.`;

  return {
    indicadorId,
    nivelSugerido: scoreToLevel(score),
    confianca: scoreToConfianca(equipSnap.size),
    justificativa,
    dadosAnalisados,
    gaps: gaps.slice(0, 10),
  };
}

async function analyzeRiscos(labId: string, indicadorId: string): Promise<AISuggestion> {
  const dadosAnalisados: string[] = [];
  const gaps: string[] = [];

  const riscoSnap = await db
    .collection(`labs/${labId}/mapa-riscos`)
    .where('deletadoEm', '==', null)
    .limit(1)
    .get();

  if (riscoSnap.empty) {
    return {
      indicadorId,
      nivelSugerido: 1,
      confianca: 'alta',
      justificativa: 'Mapa de riscos não encontrado no sistema.',
      dadosAnalisados: ['Mapa de riscos: não encontrado'],
      gaps: ['Ausência de mapa de riscos'],
    };
  }

  const riscoData = riscoSnap.docs[0].data();
  const ultimaRevisao = riscoData.ultimaRevisao?.toDate?.() ?? riscoData.dataRevisao?.toDate?.();

  dadosAnalisados.push('Mapa de riscos: encontrado');

  if (!ultimaRevisao) {
    gaps.push('Mapa de riscos sem data de revisão registrada');
    dadosAnalisados.push('Última revisão: não registrada');
    return {
      indicadorId,
      nivelSugerido: 2,
      confianca: 'baixa',
      justificativa: 'Mapa de riscos existe mas não possui data de revisão registrada.',
      dadosAnalisados,
      gaps,
    };
  }

  const mesesDesdeRevisao = monthsSince(ultimaRevisao);
  dadosAnalisados.push(`Última revisão: ${mesesDesdeRevisao} mês(es) atrás`);

  let score: number;
  if (mesesDesdeRevisao <= 6) {
    score = 100;
  } else if (mesesDesdeRevisao <= 12) {
    score = 70;
  } else {
    score = 20;
    gaps.push(`Mapa de riscos não revisado há ${mesesDesdeRevisao} meses (> 12 meses)`);
  }

  const justificativa =
    mesesDesdeRevisao <= 12
      ? `Mapa de riscos revisado há ${mesesDesdeRevisao} mês(es), dentro do prazo.`
      : `Mapa de riscos não revisado há ${mesesDesdeRevisao} meses. Necessária revisão urgente.`;

  return {
    indicadorId,
    nivelSugerido: scoreToLevel(score),
    confianca: 'alta',
    justificativa,
    dadosAnalisados,
    gaps,
  };
}

async function analyzeDocumentos(labId: string, indicadorId: string): Promise<AISuggestion> {
  const dadosAnalisados: string[] = [];
  const gaps: string[] = [];

  const docSnap = await db
    .collection(`labs/${labId}/documentos`)
    .where('deletadoEm', '==', null)
    .get();

  dadosAnalisados.push(`${docSnap.size} documento(s) registrado(s)`);

  if (docSnap.empty) {
    return {
      indicadorId,
      nivelSugerido: 1,
      confianca: 'media',
      justificativa: 'Nenhum documento controlado registrado no sistema.',
      dadosAnalisados,
      gaps: ['Ausência de documentos controlados'],
    };
  }

  let revisedOnTime = 0;
  const now = new Date();

  for (const doc of docSnap.docs) {
    const data = doc.data();
    const proximaRevisao = data.proximaRevisao?.toDate?.() ?? data.dataProximaRevisao?.toDate?.();

    if (!proximaRevisao) {
      gaps.push(`Documento "${data.titulo || doc.id}" sem data de próxima revisão`);
    } else if (proximaRevisao >= now) {
      revisedOnTime++;
    } else {
      gaps.push(`Documento "${data.titulo || doc.id}" com revisão vencida`);
    }
  }

  dadosAnalisados.push(`${revisedOnTime} em dia, ${docSnap.size - revisedOnTime} pendente(s)`);

  const score = docSnap.size > 0 ? (revisedOnTime / docSnap.size) * 100 : 0;

  const justificativa =
    revisedOnTime === docSnap.size
      ? 'Todos os documentos estão dentro do ciclo de revisão.'
      : `${docSnap.size - revisedOnTime} documento(s) com revisão vencida ou sem data programada.`;

  return {
    indicadorId,
    nivelSugerido: scoreToLevel(score),
    confianca: scoreToConfianca(docSnap.size),
    justificativa,
    dadosAnalisados,
    gaps: gaps.slice(0, 10),
  };
}

async function analyzePessoal(labId: string, indicadorId: string): Promise<AISuggestion> {
  const dadosAnalisados: string[] = [];
  const gaps: string[] = [];

  const pessoalSnap = await db
    .collection(`labs/${labId}/pessoal`)
    .where('deletadoEm', '==', null)
    .get();

  dadosAnalisados.push(`${pessoalSnap.size} registro(s) de pessoal`);

  if (pessoalSnap.empty) {
    // Try alternative collection name
    const membrosSnap = await db
      .collection(`labs/${labId}/membros`)
      .where('ativo', '==', true)
      .get();

    if (membrosSnap.empty) {
      return {
        indicadorId,
        nivelSugerido: 2,
        confianca: 'baixa',
        justificativa: 'Registros de pessoal/qualificações não encontrados.',
        dadosAnalisados: ['Registros de pessoal: não encontrados'],
        gaps: ['Ausência de registros de qualificação de pessoal'],
      };
    }

    dadosAnalisados.push(`${membrosSnap.size} membro(s) ativo(s) encontrado(s)`);
  }

  let qualified = 0;
  const docs = pessoalSnap.empty ? [] : pessoalSnap.docs;

  for (const doc of docs) {
    const data = doc.data();
    const hasQualificacao = data.qualificacoes && data.qualificacoes.length > 0;
    const validade = data.validadeQualificacao?.toDate?.();

    if (!hasQualificacao) {
      gaps.push(`Colaborador "${data.nome || doc.id}" sem qualificação registrada`);
    } else if (validade && validade < new Date()) {
      gaps.push(`Colaborador "${data.nome || doc.id}" com qualificação vencida`);
    } else {
      qualified++;
    }
  }

  const total = docs.length || 1;
  dadosAnalisados.push(`${qualified} com qualificação válida`);

  const score = (qualified / total) * 100;

  const justificativa =
    gaps.length === 0
      ? 'Todos os colaboradores possuem qualificações registradas e válidas.'
      : `${gaps.length} colaborador(es) com pendências em qualificação.`;

  return {
    indicadorId,
    nivelSugerido: scoreToLevel(score),
    confianca: scoreToConfianca(total),
    justificativa,
    dadosAnalisados,
    gaps: gaps.slice(0, 10),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Cloud Function export
// ──────────────────────────────────────────────────────────────────────────

export const generateAISuggestion = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<GenerateAISuggestionInputType>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
    }

    let input: GenerateAISuggestionInputType;
    try {
      input = GenerateAISuggestionInput.parse(request.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpsError('invalid-argument', message);
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
      const modulo = getModuleFromIndicador(input.indicadorId);

      if (!modulo || !MODULE_ANALYZERS[modulo]) {
        // Fallback: return low-confidence generic suggestion
        return {
          indicadorId: input.indicadorId,
          nivelSugerido: 3,
          confianca: 'baixa',
          justificativa: `Módulo não identificado para o indicador "${input.indicadorId}". Sugestão genérica baseada em dados insuficientes.`,
          dadosAnalisados: ['Mapeamento de módulo não encontrado'],
          gaps: [],
        } satisfies AISuggestion;
      }

      const suggestion = await MODULE_ANALYZERS[modulo](input.labId, input.indicadorId);
      return suggestion;
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao gerar sugestão');
    }
  },
);
