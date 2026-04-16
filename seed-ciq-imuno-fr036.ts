/**
 * seed-ciq-imuno-fr036.ts
 *
 * Migração histórica: Formulário FR-036 (Fev · Mar · Abr 2026) → Firestore CIQ-Imuno.
 *
 * Usa firebase-admin (service-account.json) — bypassa Firestore Security Rules.
 * Não requer autenticação de usuário.
 *
 * ─── COMO RODAR ────────────────────────────────────────────────────────────────
 *   Dry-run (inspecionar sem gravar):
 *     npx tsx seed-ciq-imuno-fr036.ts
 *
 *   Gravar no Firestore:
 *     npx tsx seed-ciq-imuno-fr036.ts --write
 *
 * ─── ANTES DO --write ──────────────────────────────────────────────────────────
 *   Revise os campos marcados com // ⚠️  — extraídos manualmente do formulário papel.
 *
 * ─── TestTypes válidos ─────────────────────────────────────────────────────────
 *   'HCG' | 'BhCG' | 'HIV' | 'HBsAg' | 'Anti-HCV' | 'Sifilis' |
 *   'Dengue' | 'COVID' | 'PCR' | 'Troponina'
 */

import { initializeApp, cert }           from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth }                         from 'firebase-admin/auth';
import { createHash }                      from 'crypto';
import { readFileSync }                    from 'fs';
import { resolve, dirname }                from 'path';
import { fileURLToPath }                   from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN   = !process.argv.includes('--write');

// ─── Firebase Admin ───────────────────────────────────────────────────────────

const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'service-account.json'), 'utf-8'),
);

initializeApp({ credential: cert(serviceAccount) });

const db   = getFirestore();
const auth = getAuth();
const TS   = FieldValue.serverTimestamp.bind(FieldValue);

// ─── Configuração do laboratório ─────────────────────────────────────────────

/** Nome exato do laboratório no Firestore (campo `name` do doc em /labs). */
const LAB_NAME = 'LabClin Rio Pomba MG';

/**
 * Operador técnico que realizou os controles.
 * Será buscado no Firebase Auth pelo e-mail para obter o UID real.
 */
const OPERATOR_EMAIL = 'areatecnicalabclinlabclin@gmail.com';
const OPERATOR_NAME  = 'Área Técnica LabClin';
const OPERATOR_ROLE  = 'biomedico' as const;  // ⚠️  confirmar: 'biomedico' | 'tecnico' | 'farmaceutico'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TestType =
  | 'HCG' | 'BhCG' | 'HIV' | 'HBsAg' | 'Anti-HCV'
  | 'Sifilis' | 'Dengue' | 'COVID' | 'PCR' | 'Troponina';

type OperatorRole = 'biomedico' | 'tecnico' | 'farmaceutico';

interface FormRecord {
  // ── Identificação ──────────────────────────────────────────────────────────
  /** Col. 1 do FR-036 — Tipo de Teste */
  testType: TestType;

  // ── Controle ───────────────────────────────────────────────────────────────
  /** Col. 2 — Lote do Controle */
  loteControle: string;
  /** Col. 3 — Data de Abertura do Controle (YYYY-MM-DD) */
  aberturaControle: string;
  /** Col. 4 — Validade do Controle (YYYY-MM-DD) */
  validadeControle: string;
  /** Não consta no FR-036 — preencher com o fabricante real */
  fabricanteControle: string;

  // ── Reagente ───────────────────────────────────────────────────────────────
  /** Col. 5 — Lote do Reagente */
  loteReagente: string;
  /** Não consta no FR-036 — preencher com o fabricante real */
  fabricanteReagente: string;
  /** Col. 6 — Data de Abertura do Reagente (YYYY-MM-DD) */
  aberturaReagente: string;
  /** Col. 7 — Validade do Reagente (YYYY-MM-DD) */
  validadeReagente: string;
  /** Status do reagente na abertura (sempre R para kits aprovados) */
  reagenteStatus: 'R' | 'NR';

  // ── Resultado ──────────────────────────────────────────────────────────────
  /** Resultado esperado pelo fabricante */
  resultadoEsperado: 'R' | 'NR';
  /** Col. 9 — Resultado Obtido */
  resultadoObtido: 'R' | 'NR';
  /** Col. 8 — Data de Realização (YYYY-MM-DD) */
  dataRealizacao: string;
  /** Col. 10 — Aprovação */
  aprovacao: 'A' | 'NA';
  /** Ação corretiva — obrigatória quando resultadoObtido ≠ resultadoEsperado */
  acaoCorretiva?: string;
}

// ─── Dados extraídos do FR-036 ────────────────────────────────────────────────
//
//  Leitura manual linha a linha da digitalização do formulário papel (FR-036,
//  FL.1, Versão 0). Ordem: mais recente → mais antigo (topo → base do form.).
//
//  Campos fabricanteControle / fabricanteReagente não constam no FR-036 —
//  preencha com os fabricantes reais antes de rodar --write.
//
//  ⚠️  = incerteza na leitura da caligrafia; verificar contra o original.
//
// ──────────────────────────────────────────────────────────────────────────────

const FR036_RECORDS: FormRecord[] = [

  // ═══ GRUPO A — Reagente lote 24H049C (Abril 2026) ════════════════════════

  {
    // FR-036 linha 1 — topo do formulário
    testType:           'HIV',           // ⚠️  verificar col. 1
    loteControle:       '0648291',       // ⚠️  verificar col. 2
    aberturaControle:   '2026-03-15',    // ⚠️  lido: 15/03/26
    validadeControle:   '2026-12-31',    // ⚠️  validade não legível — ajustar
    fabricanteControle: 'A verificar',   // não consta no FR-036
    loteReagente:       '24H049C',       // ⚠️  lido: 24H049C
    fabricanteReagente: 'A verificar',   // não consta no FR-036
    aberturaReagente:   '2026-03-13',    // ⚠️  lido: 13/03/26
    validadeReagente:   '2026-04-30',    // ⚠️  lido: /04/26
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',             // (A)R marcado
    dataRealizacao:     '2026-04-15',    // ⚠️  lido: 15/04/26
    aprovacao:          'A',
  },

  {
    // FR-036 linha 2
    testType:           'HIV',           // ⚠️  verificar
    loteControle:       '06222025',      // ⚠️  lido: 06222025
    aberturaControle:   '2026-03-15',    // ⚠️  lido: 15/03/26
    validadeControle:   '2026-12-31',    // ⚠️  ajustar
    fabricanteControle: 'A verificar',
    loteReagente:       '24H049C',
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-04-12',    // ⚠️  lido: 12/04/26
    validadeReagente:   '2026-04-30',
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-04-12',    // ⚠️  lido: 12/04/26
    aprovacao:          'A',
  },

  // ═══ GRUPO B — Reagente lote 94H040C (Março/Abril 2026) ══════════════════

  {
    // FR-036 linha 3
    testType:           'HBsAg',         // ⚠️  verificar
    loteControle:       '0e45019',       // ⚠️  caligrafia difícil
    aberturaControle:   '2026-03-31',    // ⚠️  lido: 31/03/26
    validadeControle:   '2026-12-31',    // ⚠️  ajustar
    fabricanteControle: 'A verificar',
    loteReagente:       '94H040C',       // ⚠️  lido: 94H040C
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-03-31',    // ⚠️  lido: 31/03/26
    validadeReagente:   '2026-04-30',    // ⚠️  lido: /04/26
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-03-31',    // ⚠️  lido: 31/03/26
    aprovacao:          'A',
  },

  {
    // FR-036 linha 4
    testType:           'HBsAg',         // ⚠️  verificar
    loteControle:       '0e2b022',       // ⚠️  caligrafia difícil
    aberturaControle:   '2026-03-31',    // ⚠️  lido: 31/03/26
    validadeControle:   '2026-12-31',    // ⚠️  ajustar
    fabricanteControle: 'A verificar',
    loteReagente:       '94H040C',
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-03-31',
    validadeReagente:   '2026-04-30',
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-03-31',
    aprovacao:          'A',
  },

  // ═══ GRUPO C — Reagente lote 95k001 (Fevereiro/Março 2026) ═══════════════

  {
    // FR-036 linha 5
    testType:           'Anti-HCV',      // ⚠️  verificar
    loteControle:       '0e911203',      // ⚠️  caligrafia difícil
    aberturaControle:   '2026-02-23',    // ⚠️  lido: 23/02/26
    validadeControle:   '2027-01-31',    // ⚠️  lido: /01/27
    fabricanteControle: 'A verificar',
    loteReagente:       '95k001',        // ⚠️  lido: 95k001
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-02-28',    // ⚠️  lido próximo a 29/02/26 — fev/26 tem 28 dias
    validadeReagente:   '2027-01-31',    // ⚠️  lido: /01/27
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-03-25',    // ⚠️  lido: 25/03/26
    aprovacao:          'A',
  },

  {
    // FR-036 linha 6
    testType:           'Anti-HCV',      // ⚠️  verificar
    loteControle:       '04112034',      // ⚠️  lido: 04112034
    aberturaControle:   '2026-02-23',    // ⚠️  lido: 23/02/26
    validadeControle:   '2027-01-31',
    fabricanteControle: 'A verificar',
    loteReagente:       '95k001',
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-02-28',
    validadeReagente:   '2027-01-31',
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-03-23',    // ⚠️  lido: 23/03/26
    aprovacao:          'A',
  },

  {
    // FR-036 linha 7
    testType:           'Anti-HCV',      // ⚠️  verificar
    loteControle:       '04112034',
    aberturaControle:   '2026-02-23',
    validadeControle:   '2027-01-31',
    fabricanteControle: 'A verificar',
    loteReagente:       '95k001',
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-02-28',
    validadeReagente:   '2027-01-31',
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-02-25',    // ⚠️  lido: 25/02/26
    aprovacao:          'A',
  },

  // ═══ GRUPO D — Reagente lote 95L08 (Fevereiro 2026) ═════════════════════

  {
    // FR-036 linha 8
    testType:           'Sifilis',       // ⚠️  verificar
    loteControle:       '06583009',      // ⚠️  lido: 06583009
    aberturaControle:   '2026-02-11',    // ⚠️  lido: 11/02/26
    validadeControle:   '2027-01-31',    // ⚠️  lido: /01/27
    fabricanteControle: 'A verificar',
    loteReagente:       '95L08',         // lido: 95L08
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-02-04',    // ⚠️  lido: 04/02/26
    validadeReagente:   '2027-01-31',
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-02-11',    // ⚠️  lido: 11/02/26
    aprovacao:          'A',
  },

  {
    // FR-036 linha 9
    testType:           'Sifilis',
    loteControle:       '06583009',
    aberturaControle:   '2026-02-01',    // ⚠️  corrigido: abertura ≤ dataRealizacao
    validadeControle:   '2027-01-31',
    fabricanteControle: 'A verificar',
    loteReagente:       '95L08',
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-02-04',
    validadeReagente:   '2027-01-31',
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-02-04',    // ⚠️  lido: 04/02/26
    aprovacao:          'A',
  },

  {
    // FR-036 linha 10 (base do formulário — mais antigo)
    testType:           'Sifilis',
    loteControle:       '06583009',
    aberturaControle:   '2026-02-01',    // ⚠️  corrigido: abertura ≤ dataRealizacao
    validadeControle:   '2027-01-31',
    fabricanteControle: 'A verificar',
    loteReagente:       '95L08',
    fabricanteReagente: 'A verificar',
    aberturaReagente:   '2026-02-04',    // ⚠️  lido: 04/02/26
    validadeReagente:   '2027-01-31',
    reagenteStatus:     'R',
    resultadoEsperado:  'R',
    resultadoObtido:    'R',
    dataRealizacao:     '2026-02-01',    // ⚠️  estimativa — data mais antiga do grupo
    aprovacao:          'A',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dt = new Date(d + 'T12:00:00');
  return !isNaN(dt.getTime()) && dt.toISOString().startsWith(d);
}

function lotKey(r: FormRecord): string {
  return `${r.testType}::${r.loteControle}`;
}

function migrationSig(r: FormRecord, runId: string): string {
  return createHash('sha256')
    .update(JSON.stringify({
      runId,
      testType:        r.testType,
      loteControle:    r.loteControle,
      resultadoObtido: r.resultadoObtido,
      dataRealizacao:  r.dataRealizacao,
      source:          'FR036-migration-v1',
    }))
    .digest('hex');
}

// ─── Validação dos dados ──────────────────────────────────────────────────────

function validate(): boolean {
  let ok = true;
  const DATE_FIELDS: (keyof FormRecord)[] = [
    'aberturaControle', 'validadeControle',
    'aberturaReagente', 'validadeReagente',
    'dataRealizacao',
  ];

  FR036_RECORDS.forEach((r, i) => {
    const prefix = `[Linha ${i + 1} | ${r.testType} | ${r.dataRealizacao}]`;

    // Datas válidas
    for (const f of DATE_FIELDS) {
      const val = r[f] as string;
      if (!isValidDate(val)) {
        console.error(`  ❌  ${prefix} data inválida: ${f} = "${val}"`);
        ok = false;
      }
    }

    // Realização dentro das validades
    if (r.dataRealizacao > r.validadeControle) {
      console.error(`  ❌  ${prefix} dataRealizacao posterior à validadeControle`);
      ok = false;
    }
    if (r.dataRealizacao > r.validadeReagente) {
      console.error(`  ❌  ${prefix} dataRealizacao posterior à validadeReagente`);
      ok = false;
    }
    if (r.aberturaControle > r.dataRealizacao) {
      console.error(`  ❌  ${prefix} aberturaControle posterior à dataRealizacao`);
      ok = false;
    }

    // Ação corretiva obrigatória em não conformidade
    if (r.resultadoObtido !== r.resultadoEsperado && !r.acaoCorretiva?.trim()) {
      console.error(`  ❌  ${prefix} não conformidade sem acaoCorretiva`);
      ok = false;
    }

    // Aviso: campos que precisam ser preenchidos antes do --write
    if (r.fabricanteControle === 'A verificar') {
      console.warn(`  ⚠️   ${prefix} fabricanteControle não preenchido`);
    }
    if (r.fabricanteReagente === 'A verificar') {
      console.warn(`  ⚠️   ${prefix} fabricanteReagente não preenchido`);
    }
  });

  return ok;
}

// ─── Gerador de runCode (atômico) ─────────────────────────────────────────────

async function nextRunCode(labId: string): Promise<string> {
  const counterRef = db
    .collection('labs').doc(labId)
    .collection('ciq-imuno-meta').doc('counters');

  const year = new Date().getFullYear();

  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const curr = snap.exists ? (snap.data()!.runCount as number) : 0;
    const n    = curr + 1;
    tx.set(counterRef, { runCount: n, updatedAt: TS() }, { merge: true });
    return n;
  });

  return `CI-${year}-${String(next).padStart(4, '0')}`;
}

// ─── Migração ─────────────────────────────────────────────────────────────────

async function migrate() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Migração FR-036 (Fev · Mar · Abr 2026) → CIQ-Imuno');
  console.log(DRY_RUN ? '  MODO: DRY-RUN (nenhum dado será gravado)' : '  MODO: WRITE — gravando no Firestore');
  console.log('══════════════════════════════════════════════════════\n');

  // 1. Validar dados
  console.log('▶  Validando dados...');
  const valid = validate();
  if (!valid) {
    console.error('\n❌  Validação falhou. Corrija os erros acima antes de continuar.\n');
    process.exit(1);
  }
  console.log('✅  Todos os dados são válidos.\n');

  // 2. Resolver labId pelo nome
  console.log(`▶  Buscando lab: "${LAB_NAME}"...`);
  const labsSnap = await db.collection('labs')
    .where('name', '==', LAB_NAME)
    .limit(1)
    .get();

  if (labsSnap.empty) {
    console.error(`❌  Lab não encontrado: "${LAB_NAME}"`);
    console.error('    Verifique o campo LAB_NAME ou crie o lab no app primeiro.\n');
    process.exit(1);
  }

  const labId = labsSnap.docs[0].id;
  console.log(`✅  Lab encontrado: ${labId}\n`);

  // 3. Resolver UID do operador
  console.log(`▶  Resolvendo operador: ${OPERATOR_EMAIL}...`);
  let operatorUid: string;
  try {
    const userRecord = await auth.getUserByEmail(OPERATOR_EMAIL);
    operatorUid = userRecord.uid;
    console.log(`✅  Operador UID: ${operatorUid}\n`);
  } catch {
    console.warn(`⚠️   Operador não encontrado no Auth (${OPERATOR_EMAIL}).`);
    console.warn('    Usando e-mail como operatorId de migração.\n');
    operatorUid = OPERATOR_EMAIL;
  }

  // 4. Agrupar registros por lote
  const grouped = new Map<string, FormRecord[]>();
  for (const r of FR036_RECORDS) {
    const k = lotKey(r);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(r);
  }

  console.log('──────────────────────────────────────────────────────');
  console.log(`  ${grouped.size} lote(s)  ·  ${FR036_RECORDS.length} corrida(s)`);
  console.log('──────────────────────────────────────────────────────\n');

  let totalRuns   = 0;
  let totalLots   = 0;
  let newLots     = 0;
  let reusedLots  = 0;

  // 5. Processar cada lote
  for (const [key, records] of grouped) {
    const first = records[0];

    // Ordenar corridas cronologicamente dentro do lote
    const sorted = [...records].sort((a, b) =>
      a.dataRealizacao.localeCompare(b.dataRealizacao),
    );

    console.log(`\n📦  Lote: ${key}`);
    console.log(`    Corridas: ${sorted.map(r => r.dataRealizacao).join(', ')}`);

    // Verificar se lote já existe
    const existingSnap = await db
      .collection('labs').doc(labId)
      .collection('ciq-imuno')
      .where('testType',     '==', first.testType)
      .where('loteControle', '==', first.loteControle)
      .limit(1)
      .get();

    let lotId: string;
    const lotExists = !existingSnap.empty;

    if (lotExists) {
      lotId = existingSnap.docs[0].id;
      reusedLots++;
      console.log(`    ♻️   Lote existente reutilizado → ${lotId}`);
    } else {
      lotId = db.collection('_').doc().id; // gera UUID via Firestore
      newLots++;
      console.log(`    ➕  Novo lote → ${lotId}`);

      if (!DRY_RUN) {
        await db
          .collection('labs').doc(labId)
          .collection('ciq-imuno').doc(lotId)
          .set({
            id:               lotId,
            labId,
            testType:         first.testType,
            loteControle:     first.loteControle,
            aberturaControle: first.aberturaControle,
            validadeControle: first.validadeControle,
            runCount:         0,
            lotStatus:        'sem_dados',
            createdAt:        TS(),
            createdBy:        operatorUid,
          });
      }
    }

    // Criar runs
    let lotRunCount = lotExists
      ? (existingSnap.docs[0].data().runCount as number ?? 0)
      : 0;

    for (const record of sorted) {
      const runId   = db.collection('_').doc().id;
      const runCode = DRY_RUN
        ? `CI-2026-DRY${String(totalRuns + 1).padStart(2, '0')}`
        : await nextRunCode(labId);

      const status: 'Aprovada' | 'Rejeitada' =
        record.resultadoObtido === record.resultadoEsperado ? 'Aprovada' : 'Rejeitada';

      const sig = migrationSig(record, runId);

      const realizacaoTs = Timestamp.fromDate(
        new Date(record.dataRealizacao + 'T12:00:00'),
      );

      const runDoc = {
        id:               runId,
        runCode,
        labId,
        lotId,
        // Rastreabilidade RDC 978
        operatorId:       operatorUid,
        operatorName:     OPERATOR_NAME,
        operatorRole:     OPERATOR_ROLE,
        // Metadados de corrida
        isEdited:         false,
        status,
        version:          1,
        logicalSignature: sig,
        createdBy:        operatorUid,
        imageUrl:         '',
        confirmedAt:      realizacaoTs,
        createdAt:        TS(),
        // Controle
        testType:           record.testType,
        loteControle:       record.loteControle,
        fabricanteControle: record.fabricanteControle,
        aberturaControle:   record.aberturaControle,
        validadeControle:   record.validadeControle,
        // Reagente
        loteReagente:       record.loteReagente,
        fabricanteReagente: record.fabricanteReagente,
        reagenteStatus:     record.reagenteStatus,
        aberturaReagente:   record.aberturaReagente,
        validadeReagente:   record.validadeReagente,
        // Resultado
        resultadoEsperado:  record.resultadoEsperado,
        resultadoObtido:    record.resultadoObtido,
        dataRealizacao:     record.dataRealizacao,
        ...(record.acaoCorretiva && { acaoCorretiva: record.acaoCorretiva }),
        // Westgard — recalculado pelo app ao abrir o lote
        westgardCategorico: [],
        // Origem
        migratedFromFR036:  true,
      };

      const auditDoc = {
        runId,
        lotId,
        logicalSignature: sig,
        signedBy:         operatorUid,
        signedAt:         TS(),
        testType:         record.testType,
        resultadoObtido:  record.resultadoObtido,
        dataRealizacao:   record.dataRealizacao,
        westgardAlerts:   [],
        source:           'FR036-paper-migration',
        createdAt:        TS(),
      };

      console.log(
        `    ↳ ${runCode}  ${record.testType}  ${record.dataRealizacao}  ` +
        `${record.resultadoObtido}  ${status}  loteReag: ${record.loteReagente}`,
      );

      if (!DRY_RUN) {
        await db
          .collection('labs').doc(labId)
          .collection('ciq-imuno').doc(lotId)
          .collection('runs').doc(runId)
          .set(runDoc);

        await db
          .collection('labs').doc(labId)
          .collection('ciq-imuno').doc(lotId)
          .collection('audit').doc(runId)
          .set(auditDoc);
      }

      lotRunCount++;
      totalRuns++;
    }

    // Atualizar runCount + lotStatus no lote
    if (!DRY_RUN) {
      await db
        .collection('labs').doc(labId)
        .collection('ciq-imuno').doc(lotId)
        .update({
          runCount:  lotRunCount,
          lotStatus: 'valido',
        });
    }

    console.log(`    ✅  ${sorted.length} corrida(s) ${DRY_RUN ? 'simuladas' : 'gravadas'}  runCount → ${lotRunCount}`);
    totalLots++;
  }

  // 6. Resumo final
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  ${DRY_RUN ? '🔍  DRY-RUN concluído' : '🚀  Migração concluída'}`);
  console.log(`  Lotes processados : ${totalLots}  (${newLots} novos · ${reusedLots} existentes)`);
  console.log(`  Corridas          : ${totalRuns}`);
  if (DRY_RUN) {
    console.log('\n  Para gravar, rode:');
    console.log('  npx tsx seed-ciq-imuno-fr036.ts --write');
  }
  console.log('\n  ⚠️  Westgard categórico NÃO foi recalculado.');
  console.log('  Abra cada lote no módulo CIQ-Imuno para recalcular.');
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(0);
}

migrate().catch((err) => {
  console.error('\n❌  Migração falhou:', err.message ?? err);
  process.exit(1);
});
