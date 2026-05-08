/**
 * contractTemplate.ts
 *
 * Gerador de minuta de contrato com laboratório de apoio.
 *
 * RDC 978/2025 — Arts. 36–39 (Terceirização de Ensaios) exige 6 cláusulas
 * obrigatórias. Esta função consolida os dados do `Contrato` em um documento
 * estruturado pronto para renderização em PDF (puppeteer/HTML) ou exibição
 * em UI.
 *
 * Cláusulas mandatórias:
 *   1. IDENTIFICAÇÃO — partes contratantes (razão social, CNPJ, endereço, RT)
 *   2. OBJETO — escopo de exames terceirizados (lista, codigos, TAT)
 *   3. AVS — verificação da Autorização Anvisa do contratado
 *   4. RESPONSABILIDADE TÉCNICA — RT do laboratório de apoio + obrigações
 *   5. VIGÊNCIA E RESCISÃO — termo, prorrogação automática, hipóteses de rescisão
 *   6. AVALIAÇÃO ANUAL — periodicidade obrigatória, indicadores, plano de ação
 *
 * DICQ 4.14.8 mapping: cada cláusula referencia um requisito.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { assertLabApoioAccess, labApoioCollection } from './validators';

// ─── Schema ──────────────────────────────────────────────────────────────────

export const GenerateContractTemplateInputSchema = z.object({
  labId: z.string().min(1),
  contratoId: z.string().min(1),
  /** Snapshot do laboratório contratante (lab principal) */
  contratante: z.object({
    razaoSocial: z.string().min(1),
    cnpj: z.string().min(1),
    endereco: z.string().min(1),
    rtNome: z.string().min(1),
    rtRegistro: z.string().min(1),
  }),
  /** Formato de saída: 'json' (default) ou 'html' (para puppeteer) */
  format: z.enum(['json', 'html']).default('json'),
});

export type GenerateContractTemplateInput = z.infer<
  typeof GenerateContractTemplateInputSchema
>;

// ─── Tipos do template ────────────────────────────────────────────────────────

export interface ContractClause {
  numero: number;
  titulo: string;
  rdcRef: string;
  dicqRef?: string;
  conteudo: string;
}

export interface ContractTemplate {
  contratoId: string;
  labId: string;
  geradoEm: string; // ISO
  geradoPor: string; // uid
  clausulas: ContractClause[];
  /** Hash sha256 do conteúdo (para auditoria) */
  contentHash: string;
}

// ─── Builders por cláusula ────────────────────────────────────────────────────

interface ContractData {
  contratante: GenerateContractTemplateInput['contratante'];
  contratado: {
    nome: string;
    razaoSocial: string;
    cnpj: string;
    habilitacaoAnvisa: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
    };
    contatos: Array<{ nome: string; funcao: string; email: string; telefone?: string }>;
    certificacoes: Array<{ nome: string; ativo: boolean }>;
    exames: Array<{ codigo: string; descricao: string; tat: number }>;
    vigenciaInicio: string;
    vigenciaFim: string;
    criticidade: 'baixa' | 'media' | 'alta';
  };
}

function formatEndereco(e: ContractData['contratado']['endereco']): string {
  const compl = e.complemento ? `, ${e.complemento}` : '';
  return `${e.logradouro}, ${e.numero}${compl} — ${e.bairro}, ${e.cidade}/${e.estado}, CEP ${e.cep}`;
}

function clauseIdentificacao(d: ContractData): ContractClause {
  return {
    numero: 1,
    titulo: 'IDENTIFICAÇÃO DAS PARTES',
    rdcRef: 'RDC 978/2025 — Art. 36, §1º',
    dicqRef: 'DICQ 4.14.8 (a)',
    conteudo: [
      `CONTRATANTE: ${d.contratante.razaoSocial} (CNPJ ${d.contratante.cnpj}), com sede em ${d.contratante.endereco}, neste ato representada por seu Responsável Técnico ${d.contratante.rtNome} (registro profissional ${d.contratante.rtRegistro}).`,
      ``,
      `CONTRATADO: ${d.contratado.razaoSocial} (CNPJ ${d.contratado.cnpj}), com sede em ${formatEndereco(d.contratado.endereco)}, doravante denominado LABORATÓRIO DE APOIO.`,
      ``,
      `Contatos do contratado: ${d.contratado.contatos.map((c) => `${c.nome} (${c.funcao}) — ${c.email}${c.telefone ? ` / ${c.telefone}` : ''}`).join('; ') || '— não informado'}.`,
    ].join('\n'),
  };
}

function clauseObjeto(d: ContractData): ContractClause {
  const examesList = d.contratado.exames
    .map((e) => `  • ${e.codigo} — ${e.descricao} (TAT ${e.tat}h)`)
    .join('\n');
  return {
    numero: 2,
    titulo: 'OBJETO E ESCOPO DOS SERVIÇOS',
    rdcRef: 'RDC 978/2025 — Art. 36 caput',
    dicqRef: 'DICQ 4.14.8 (b)',
    conteudo: [
      `O presente contrato tem por objeto a prestação, pelo CONTRATADO, de serviços de análises clínicas terceirizadas para o CONTRATANTE, na modalidade de envio de amostras biológicas, observada a classificação de criticidade ${d.contratado.criticidade.toUpperCase()}.`,
      ``,
      `Lista de exames terceirizados (codificação TUSS/CBPO):`,
      examesList || '  • (a definir em aditivo contratual)',
      ``,
      `Os tempos de turnaround (TAT) acima são metas contratuais; descumprimento sistemático autoriza revisão ou rescisão (cláusula 5).`,
    ].join('\n'),
  };
}

function clauseAVS(d: ContractData): ContractClause {
  return {
    numero: 3,
    titulo: 'VERIFICAÇÃO DA AUTORIZAÇÃO SANITÁRIA (AVS)',
    rdcRef: 'RDC 978/2025 — Art. 37',
    dicqRef: 'DICQ 4.14.8 (c)',
    conteudo: [
      `O CONTRATADO declara possuir Autorização de Funcionamento Sanitário (AVS) Anvisa nº ${d.contratado.habilitacaoAnvisa}, vigente e em situação regular junto à autoridade sanitária local.`,
      ``,
      `O CONTRATADO obriga-se a manter sua AVS atualizada durante toda a vigência deste contrato e a comunicar imediatamente ao CONTRATANTE qualquer interdição, suspensão ou cancelamento, sob pena de rescisão automática.`,
      ``,
      `Certificações adicionais informadas: ${d.contratado.certificacoes.filter((c) => c.ativo).map((c) => c.nome).join(', ') || '— nenhuma certificação ativa declarada —'}.`,
    ].join('\n'),
  };
}

function clauseResponsabilidadeTecnica(d: ContractData): ContractClause {
  return {
    numero: 4,
    titulo: 'RESPONSABILIDADE TÉCNICA',
    rdcRef: 'RDC 978/2025 — Art. 38',
    dicqRef: 'DICQ 4.14.8 (d)',
    conteudo: [
      `O CONTRATADO mantém Responsável Técnico (RT) habilitado e registrado em Conselho Profissional competente, que responderá tecnicamente pelos laudos emitidos para amostras encaminhadas pelo CONTRATANTE.`,
      ``,
      `São obrigações do CONTRATADO:`,
      `  a) Emitir laudos com identificação completa do RT, conforme RDC 978/2025 Art. 167;`,
      `  b) Garantir rastreabilidade da amostra (RDC 978 Art. 128) em todas as fases (pré-analítica, analítica, pós-analítica);`,
      `  c) Participar de Programa de Controle Externo da Qualidade (CEQ) para os exames objeto deste contrato (RDC 978 Art. 99);`,
      `  d) Disponibilizar, mediante solicitação, evidências de Controle Interno da Qualidade (CIQ);`,
      `  e) Comunicar não-conformidades que afetem amostras do CONTRATANTE em até 24h.`,
    ].join('\n'),
  };
}

function clauseVigenciaRescisao(d: ContractData): ContractClause {
  return {
    numero: 5,
    titulo: 'VIGÊNCIA, PRORROGAÇÃO E RESCISÃO',
    rdcRef: 'RDC 978/2025 — Art. 36, §2º',
    dicqRef: 'DICQ 4.14.8 (e)',
    conteudo: [
      `O presente contrato vigora de ${d.contratado.vigenciaInicio} a ${d.contratado.vigenciaFim}, podendo ser prorrogado por igual período mediante termo aditivo, condicionado à aprovação na avaliação anual (cláusula 6).`,
      ``,
      `Hipóteses de rescisão imediata:`,
      `  a) Suspensão, cancelamento ou interdição da AVS do CONTRATADO;`,
      `  b) Reprovação em duas avaliações anuais consecutivas;`,
      `  c) Descumprimento reiterado dos TATs contratados;`,
      `  d) Violação de sigilo de dados de pacientes (LGPD Art. 7º, §4º);`,
      `  e) Detecção de não-conformidade crítica não sanada em 30 dias.`,
    ].join('\n'),
  };
}

function clauseAvaliacaoAnual(d: ContractData): ContractClause {
  return {
    numero: 6,
    titulo: 'AVALIAÇÃO ANUAL',
    rdcRef: 'RDC 978/2025 — Art. 39',
    dicqRef: 'DICQ 4.14.8 (f)',
    conteudo: [
      `O CONTRATANTE realizará, no mínimo anualmente, avaliação documentada do CONTRATADO, abrangendo:`,
      `  a) Conformidade dos laudos com requisitos do CONTRATANTE;`,
      `  b) Cumprimento dos TATs (turnaround time);`,
      `  c) Resultados de CEQ disponibilizados pelo CONTRATADO;`,
      `  d) Adequação da AVS e certificações;`,
      `  e) Tratamento de não-conformidades.`,
      ``,
      `O resultado pode ser: APROVADO · APROVADO COM RESSALVA · REPROVADO. Avaliações com ressalva geram plano de ação com prazo máximo de 90 dias. Reprovação enseja rescisão na forma da cláusula 5.`,
      ``,
      `O registro da avaliação anual é mantido em sistema com trilha de auditoria imutável (RDC 978 Art. 204).`,
    ].join('\n'),
  };
}

// ─── Orquestrador ────────────────────────────────────────────────────────────

export function buildContractClauses(d: ContractData): ContractClause[] {
  return [
    clauseIdentificacao(d),
    clauseObjeto(d),
    clauseAVS(d),
    clauseResponsabilidadeTecnica(d),
    clauseVigenciaRescisao(d),
    clauseAvaliacaoAnual(d),
  ];
}

export function clausesToHtml(
  clausulas: ContractClause[],
  meta: { contratoId: string; labId: string; geradoEm: string },
): string {
  const body = clausulas
    .map(
      (c) => `
    <section class="clause">
      <h2>CLÁUSULA ${c.numero}ª — ${c.titulo}</h2>
      <p class="ref">${c.rdcRef}${c.dicqRef ? ` · ${c.dicqRef}` : ''}</p>
      <pre>${c.conteudo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </section>`,
    )
    .join('\n');
  return `<!doctype html><html lang="pt-BR"><head>
    <meta charset="utf-8"/>
    <title>Contrato Lab Apoio — ${meta.contratoId}</title>
    <style>
      body { font-family: 'Times New Roman', serif; max-width: 720px; margin: 40px auto; color: #111; }
      h1 { font-size: 18pt; text-align: center; }
      h2 { font-size: 12pt; margin-top: 24px; }
      .ref { color: #555; font-size: 9pt; font-style: italic; margin-top: -6px; }
      pre { white-space: pre-wrap; font-family: inherit; font-size: 11pt; line-height: 1.6; }
      footer { font-size: 8pt; color: #888; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 8px; }
    </style></head><body>
    <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ANÁLISES CLÍNICAS — LABORATÓRIO DE APOIO</h1>
    ${body}
    <footer>Contrato ID: ${meta.contratoId} · Lab: ${meta.labId} · Gerado em ${meta.geradoEm} · Conforme RDC 978/2025 Arts. 36–39 e DICQ 4.14.8</footer>
  </body></html>`;
}

function sha256(s: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(s).digest('hex');
}

// ─── Callable ────────────────────────────────────────────────────────────────

export const labApoio_generateContractTemplate = onCall<unknown, Promise<{
  ok: true;
  template: ContractTemplate;
  html?: string;
}>>({}, async (request) => {
  const parsed = GenerateContractTemplateInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }
  const input = parsed.data;

  await assertLabApoioAccess(request.auth, input.labId);
  const uid = request.auth!.uid;
  const db = admin.firestore();

  const contratoRef = labApoioCollection(db, input.labId).doc(input.contratoId);
  const snap = await contratoRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Contrato não encontrado.');
  }
  const c = snap.data()!;
  if (c.deletadoEm !== null && c.deletadoEm !== undefined) {
    throw new HttpsError('failed-precondition', 'Contrato deletado — minuta não disponível.');
  }

  const data: ContractData = {
    contratante: input.contratante,
    contratado: {
      nome: c.nome,
      razaoSocial: c.razaoSocial,
      cnpj: c.cnpj,
      habilitacaoAnvisa: c.habilitacaoAnvisa,
      endereco: c.endereco,
      contatos: c.contatos ?? [],
      certificacoes: c.certificacoes ?? [],
      exames: c.exames ?? [],
      vigenciaInicio: c.vigenciaInicio,
      vigenciaFim: c.vigenciaFim,
      criticidade: c.criticidade,
    },
  };

  const clausulas = buildContractClauses(data);
  const geradoEm = new Date().toISOString();
  const meta = { contratoId: input.contratoId, labId: input.labId, geradoEm };
  const fullText = clausulas.map((cl) => `${cl.numero}|${cl.titulo}|${cl.conteudo}`).join('\n---\n');
  const contentHash = sha256(fullText);

  const template: ContractTemplate = {
    contratoId: input.contratoId,
    labId: input.labId,
    geradoEm,
    geradoPor: uid,
    clausulas,
    contentHash,
  };

  // Audit event (template generation is auditable per RDC Art. 204)
  const auditRef = contratoRef.collection('events').doc();
  await auditRef.set({
    tipo: 'updated',
    operadorId: uid,
    timestamp: admin.firestore.Timestamp.now(),
    mudancas: [
      {
        campo: 'contractTemplate',
        anterior: null,
        novo: `template-${contentHash.substring(0, 8)}`,
      },
    ],
    chainHash: '',
    chainHashAnterior: null,
  });

  if (input.format === 'html') {
    return { ok: true, template, html: clausesToHtml(clausulas, meta) };
  }
  return { ok: true, template };
});
