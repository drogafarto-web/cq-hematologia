/**
 * parsePNCQReport + confirmCEQResults — Cloud Functions callables
 *
 * Flow:
 * 1. Client uploads PDF(s) to Storage at labs/{labId}/ceq-uploads/{ts}/
 * 2. Client calls parsePNCQReport({ labId, storagePaths }) → returns parsed results for preview
 * 3. Client calls confirmCEQResults({ labId, results }) → writes to Firestore + auto-NC
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (!getApps().length) initializeApp();

const db = getFirestore();

// ─── PDF Parsing Logic (same as seed script) ─────────────────────────────────

interface QuantResult {
  type: 'quantitativo';
  constituinte: string;
  metodo: string;
  unidade: string;
  valorLab: number;
  media: number;
  dp: number;
  conceito: string;
}

interface QualResult {
  type: 'qualitativo';
  constituinte: string;
  determinacaoLab: string;
  resultadoCoordenadoria: string;
  conceito: string;
}

type PNCQResult = QuantResult | QualResult;

export interface ParsedPNCQReport {
  fileName: string;
  especialidade: string;
  mesAno: string;
  loteProEx: string;
  resultados: PNCQResult[];
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(buffer);
  return result.text;
}

function deriveEspecialidade(fileName: string): string {
  const name = fileName.replace('.pdf', '');
  if (name.includes('Hematologia')) return 'hematologia-basica';
  if (name.includes('oagula')) return 'coagulacao';
  if (name.includes('VHS')) return 'vhs';
  if (name.includes('Virtual')) return 'urinalise-virtual';
  if (name.includes('rin')) return 'urinalise';
  if (name.includes('Parasit')) return 'parasitologia';
  if (name.includes('Dengue')) return 'dengue-ns1';
  if (name.includes('COVID')) return 'covid-19-antigeno';
  if (name.includes('Gram')) return 'microbiologia-gram';
  if (name.includes('Baar')) return 'microbiologia-baar';
  if (name.includes('munologia') || name.includes('PCR')) return 'imunologia-pcr-qualitativo';
  return name.toLowerCase().replace(/\s+/g, '-');
}

function isQuantitativoEspecialidade(esp: string): boolean {
  return ['hematologia-basica', 'coagulacao', 'vhs'].includes(esp);
}

function parseQuantFromText(text: string): QuantResult[] {
  const results: QuantResult[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/([\d,]+)\s+([\d,]+)\s+(-?[\d,]+)\s+([\d,]+)\s+[\d,]+\s+\d+\s+\d+\s+([BAI])\s*$/);
    if (!m) continue;
    const valorLab = parseFloat(m[1].replace(',', '.'));
    const media = parseFloat(m[2].replace(',', '.'));
    const dp = parseFloat(m[4].replace(',', '.'));
    const conceito = m[5];
    if (isNaN(valorLab) || isNaN(media) || dp === 0) continue;
    const prefix = line.substring(0, m.index || 0).trim();
    const constituinte = extractConstituinte(prefix);
    if (!constituinte) continue;
    results.push({
      type: 'quantitativo', constituinte,
      metodo: extractMetodo(prefix), unidade: extractUnidade(prefix),
      valorLab, media, dp, conceito,
    });
  }
  return results;
}

function extractConstituinte(prefix: string): string {
  const known = [
    'LEUCOCITOS', 'HEMACIAS', 'HEMOGLOBINA', 'HEMATOCRITO',
    'VGM', 'HGM', 'CHGM', 'RDW', 'PLAQUETAS',
    'TEMPO DE PROTROMBINA', 'ATIVIDADE', 'INR',
    'TEMPO DE TROMBOPLASTINA', 'VHS', 'VELOCIDADE',
  ];
  const upper = prefix.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const k of known) {
    if (upper.includes(k)) return k;
  }
  const parts = prefix.split(/\s{2,}/);
  return parts[0]?.substring(0, 40) || '';
}

function extractMetodo(prefix: string): string {
  if (prefix.includes('YUMIZEN')) return 'YUMIZEN H500/H550-HORIBA';
  if (prefix.includes('WAMA')) return 'WAMA';
  if (prefix.includes('CLOTIMER')) return 'CLOTIMER';
  return '';
}

function extractUnidade(prefix: string): string {
  const m = prefix.match(/(10[^\s]*\/μL|g\/dl|vol\.%|fl|pg|%|segund\w*|mm\/h)/i);
  return m ? m[1] : '';
}

function parseQualFromText(text: string): QualResult[] {
  const results: QualResult[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.includes('Pagina') || line.includes('Participante:') || line.includes('MC=')) continue;
    const dengue = line.match(/AMOSTRA\s+(\d+)\s+.+?\s+((?:N.{1,3}O\s+)?REAGENTE|POSITIVO|NEGATIVO)\s+((?:N.{1,3}O\s+)?REAGENTE|POSITIVO|NEGATIVO)\s+\d+\s+([BAI])/i);
    if (dengue) {
      results.push({ type: 'qualitativo', constituinte: `Amostra ${dengue[1]}`, determinacaoLab: dengue[2], resultadoCoordenadoria: dengue[3], conceito: dengue[4] });
      continue;
    }
    const endMatch = line.match(/(\d+)\s+([BAI])\s*$/);
    if (endMatch && !line.includes('PRO-EX') && !line.includes('Vers') && line.length > 20) {
      const content = line.substring(0, endMatch.index || 0).trim();
      if (content.length > 5) {
        results.push({ type: 'qualitativo', constituinte: content.substring(0, 80), determinacaoLab: '', resultadoCoordenadoria: '', conceito: endMatch[2] });
      }
    }
  }
  return results;
}

function conceitoToInterpretacao(c: string): 'satisfatoria' | 'questionavel' | 'insatisfatoria' {
  if (c === 'B') return 'satisfatoria';
  if (c === 'A') return 'satisfatoria'; // PNCQ "Aceitável" = resultado dentro do esperado
  return 'insatisfatoria';
}

// ─── parsePNCQReport callable ────────────────────────────────────────────────

export const parsePNCQReport = onCall(
  { memory: '512MiB', timeoutSeconds: 120, region: 'southamerica-east1' },
  async (request): Promise<{ reports: ParsedPNCQReport[] }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login obrigatório.');

    const { labId, storagePaths } = request.data as { labId: string; storagePaths: string[] };
    if (!labId || !storagePaths?.length) {
      throw new HttpsError('invalid-argument', 'labId e storagePaths obrigatórios.');
    }

    // Fix #1: Multi-tenant guard — verify caller is active member of this lab
    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'Sem acesso a este laboratório.');
    }

    // Fix #2: Storage path validation — prevent cross-tenant traversal
    const expectedPrefix = `labs/${labId}/ceq-uploads/`;
    for (const p of storagePaths) {
      if (!p.startsWith(expectedPrefix)) {
        throw new HttpsError('invalid-argument', `Path inválido: deve iniciar com ${expectedPrefix}`);
      }
    }

    const bucket = getStorage().bucket();
    const reports: ParsedPNCQReport[] = [];

    for (const storagePath of storagePaths) {
      try {
        const file = bucket.file(storagePath);
        const [buffer] = await file.download();
        const text = await extractPdfText(buffer);

        const fileName = storagePath.split('/').pop() || 'unknown.pdf';
        const especialidade = deriveEspecialidade(fileName);
        const isQuant = isQuantitativoEspecialidade(especialidade);
        const resultados = isQuant ? parseQuantFromText(text) : parseQualFromText(text);

        const loteMatch = text.match(/Lote PRO-EX:\s*(\d+)/);
        const mesMatch = text.match(/AVALIAÇÃO\s+(.+?)[\n\r]/);

        reports.push({
          fileName,
          especialidade,
          mesAno: mesMatch?.[1]?.trim() || 'Desconhecido',
          loteProEx: loteMatch?.[1] || '0000',
          resultados,
        });
      } catch (e: any) {
        console.error(`Error parsing ${storagePath}:`, e.message);
        // Continue with other files
      }
    }

    return { reports };
  },
);

// ─── confirmCEQResults callable ──────────────────────────────────────────────

interface ConfirmInput {
  labId: string;
  reports: ParsedPNCQReport[];
  rodada: number;
  ano: number;
}

export const confirmCEQResults = onCall(
  { memory: '512MiB', timeoutSeconds: 300, region: 'southamerica-east1' },
  async (request): Promise<{ amostras: number; resultados: number; ncsGeradas: number }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login obrigatório.');

    const { labId, reports, rodada, ano } = request.data as ConfirmInput;
    if (!labId || !reports?.length) {
      throw new HttpsError('invalid-argument', 'labId e reports obrigatórios.');
    }

    // Fix #1: Multi-tenant guard — verify caller is active member of this lab
    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'Sem acesso a este laboratório.');
    }

    const uid = request.auth.uid;
    const now = Timestamp.now();
    let totalAmostras = 0;
    let totalResultados = 0;
    let ncsGeradas = 0;

    for (const report of reports) {
      if (report.resultados.length === 0) continue;

      // Find or create participacao for this especialidade
      const participSnap = await db.collection(`labs/${labId}/ceq-participacoes`)
        .where('esquema', '==', report.especialidade)
        .where('ativo', '==', true)
        .where('deletadoEm', '==', null)
        .limit(1)
        .get();

      let participacaoId: string;
      if (participSnap.empty) {
        // Create new participacao
        const pRef = db.collection(`labs/${labId}/ceq-participacoes`).doc();
        await pRef.set({
          labId, provedorId: 'pncq', provedorNome: 'PNCQ - Programa Nacional de Controle de Qualidade',
          esquema: report.especialidade, dataInicio: now, frequencia: 'mensal',
          analitosParticipados: report.resultados.map(r => r.constituinte),
          ativo: true, criadoEm: now, criadoPor: uid, deletadoEm: null,
        });
        participacaoId = pRef.id;
      } else {
        participacaoId = participSnap.docs[0].id;
      }

      // Create amostra
      const amostraRef = db.collection(`labs/${labId}/ceq-amostras`).doc();
      await amostraRef.set({
        labId, ceqParticipacaoId: participacaoId, rodada, ano,
        dataRecepcao: now, provedorRodadaId: report.loteProEx,
        status: 'processada', criadoEm: now, criadoPor: uid, deletadoEm: null,
      });
      totalAmostras++;

      // Create resultados
      for (const res of report.resultados) {
        const rRef = db.collection(`labs/${labId}/ceq-resultados`).doc();

        if (res.type === 'quantitativo') {
          const zScore = res.dp > 0 ? (res.valorLab - res.media) / res.dp : 0;
          const interpretacao = conceitoToInterpretacao(res.conceito);

          const resultadoDoc: Record<string, any> = {
            labId, ceqAmostraId: amostraRef.id, ceqParticipacaoId: participacaoId,
            analyteId: res.constituinte.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, ''),
            analyteName: res.constituinte, valorObtido: res.valorLab,
            unidade: res.unidade || 'N/A', valorReferencia: res.media, desvioEstimado: res.dp,
            zScore: Math.round(zScore * 1000) / 1000, interpretacao,
            status: 'validado', criadoEm: now, criadoPor: uid, deletadoEm: null,
          };

          // Auto-NC for insatisfatório
          if (interpretacao === 'insatisfatoria') {
            const nc = await criarNCFromCEQ(labId, res.constituinte, zScore, amostraRef.id, uid);
            if (nc) {
              resultadoDoc.ncAutomaticaCriadaId = nc.ncId;
              resultadoDoc.temNCGrave = true;
              ncsGeradas++;
            }
          }

          await rRef.set(resultadoDoc);
        } else {
          const acertou = res.conceito === 'B' || res.conceito === 'A';
          await rRef.set({
            labId, ceqAmostraId: amostraRef.id, ceqParticipacaoId: participacaoId,
            analyteId: res.constituinte.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, ''),
            analyteName: res.constituinte, valorObtido: acertou ? 1 : 0,
            unidade: 'qualitativo', valorReferencia: 1, desvioEstimado: 0.5,
            zScore: acertou ? 0 : 2, interpretacao: conceitoToInterpretacao(res.conceito),
            status: 'validado', criadoEm: now, criadoPor: uid, deletadoEm: null,
          });
        }
        totalResultados++;
      }
    }

    return { amostras: totalAmostras, resultados: totalResultados, ncsGeradas };
  },
);

// ─── NC creation helper ──────────────────────────────────────────────────────

async function criarNCFromCEQ(
  labId: string,
  analyteName: string,
  zScore: number,
  amostraId: string,
  uid: string,
): Promise<{ ncId: string; ncNumero: string } | null> {
  try {
    const seqRef = db.doc(`labs/${labId}/nc-sequencia/_counter`);
    const seqSnap = await seqRef.get();
    const nextSeq = ((seqSnap.data()?.count as number) || 0) + 1;
    await seqRef.set({ count: nextSeq }, { merge: true });

    const ano = new Date().getFullYear();
    const ncNumero = `NC-${ano}-${String(nextSeq).padStart(4, '0')}`;

    const ncRef = db.collection(`labs/${labId}/naoConformidades`).doc();
    await ncRef.set({
      id: ncRef.id,
      labId,
      codigo: ncNumero,
      titulo: `CEQ Insatisfatória: ${analyteName} (Z=${zScore.toFixed(2)})`,
      descricao: `Resultado insatisfatório no Controle de Qualidade Externo.\n\nAnalito: ${analyteName}\nZ-Score: ${zScore.toFixed(2)}\nAmostra: ${amostraId}`,
      severidade: Math.abs(zScore) >= 4 ? 'critica' : 'grave',
      origem: 'modulo',
      moduloOrigem: 'ceq',
      auditoriaId: null,
      bloqueiaOperacoes: true,
      modulosBloqueados: ['ceq'],
      capaStatus: 'nao_iniciada',
      capaHistorico: [{
        status: 'nao_iniciada',
        timestamp: Timestamp.now(),
        realizadoPor: 'system',
        realizadoPorName: 'Sistema CEQ',
        descricao: `NC auto-criada: resultado CEQ insatisfatório (|Z| ≥ 3). DICQ 4.5 / ISO 17043.`,
        evidencias: [],
      }],
      abertaEm: Timestamp.now(),
      abertaPor: uid,
      prazoClosure: Timestamp.fromMillis(Date.now() + 15 * 24 * 60 * 60 * 1000),
      fechadaEm: null,
      fechadaPor: null,
      deletadoEm: null,
    });

    return { ncId: ncRef.id, ncNumero };
  } catch (e) {
    console.error('Erro ao criar NC CEQ:', e);
    return null;
  }
}