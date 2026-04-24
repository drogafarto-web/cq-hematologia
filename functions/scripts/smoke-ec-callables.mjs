#!/usr/bin/env node
/**
 * smoke-ec-callables.mjs — exercita as 6 callables do módulo Educação
 * Continuada contra o Firebase Functions Emulator + Firestore Emulator.
 *
 * Pré-requisitos (em outro terminal):
 *   firebase emulators:start --only auth,firestore,functions
 *
 * Uso:
 *   cd functions
 *   npm run build           # compila TS
 *   node scripts/smoke-ec-callables.mjs
 *
 * O script:
 *   1. Inicializa Admin SDK contra emulator (FIRESTORE_EMULATOR_HOST,
 *      FIREBASE_AUTH_EMULATOR_HOST, FUNCTIONS_EMULATOR=true)
 *   2. Cria 1 user de teste com claim `modules['educacao-continuada']: true`
 *      e o adiciona como member ativo de um lab fictício
 *   3. Faz seed de 1 treinamento + 2 colaboradores
 *   4. Invoca cada callable via HTTP request (formato Firebase callable v2)
 *   5. Cobre happy-path + 4 cenários de falha (RN-02, RN-03, ISO 15189, claim ausente)
 *
 * Saída:
 *   - log estruturado por cenário com PASS/FAIL
 *   - exit 0 se todos PASS, exit 1 se qualquer FAIL
 */

import admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';

// ─── Setup emulator env (deve vir antes do initializeApp) ────────────────────
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST ?? 'localhost:5001';
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'hmatologia2';
const REGION = 'southamerica-east1';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();

// ─── Helpers ────────────────────────────────────────────────────────────────

function ts(millis) {
  return admin.firestore.Timestamp.fromMillis(millis);
}

const results = { pass: 0, fail: 0, scenarios: [] };

function record(name, ok, detail = '') {
  results.scenarios.push({ name, ok, detail });
  if (ok) {
    results.pass++;
    console.log(`✅ ${name}`);
  } else {
    results.fail++;
    console.error(`❌ ${name}: ${detail}`);
  }
}

async function callCallable(name, idToken, data) {
  const url = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/${name}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  const json = await resp.json();
  return { status: resp.status, json };
}

async function expectError(call, expectedCode, scenario) {
  const { json } = await call;
  if (json.error?.status === expectedCode) {
    record(scenario, true, `code=${expectedCode}`);
  } else {
    record(
      scenario,
      false,
      `expected error code=${expectedCode}, got ${JSON.stringify(json)}`,
    );
  }
}

async function expectOk(call, scenario) {
  const { json } = await call;
  if (json.result?.ok === true || json.result?.signatures || json.result?.execucaoId || json.result?.avaliacaoId || json.result?.novaExecucaoId) {
    record(scenario, true);
    return json.result;
  }
  record(scenario, false, JSON.stringify(json));
  return null;
}

// Mint custom token usando Admin SDK + troca por idToken via REST do Auth Emulator
async function mintIdToken(uid, additionalClaims = {}) {
  const customToken = await auth.createCustomToken(uid, additionalClaims);
  const url = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const json = await resp.json();
  if (!json.idToken) {
    throw new Error(`Failed to mint idToken: ${JSON.stringify(json)}`);
  }
  return json.idToken;
}

// ─── Seed de dados ──────────────────────────────────────────────────────────

const LAB_ID = `lab-smoke-${randomUUID().slice(0, 8)}`;
const UID_OK = `uid-ok-${randomUUID().slice(0, 8)}`;
const UID_NO_CLAIM = `uid-noclaim-${randomUUID().slice(0, 8)}`;

async function seed() {
  // Users no Firebase Auth + custom claims
  await auth.createUser({ uid: UID_OK, email: `${UID_OK}@smoke.test` });
  await auth.setCustomUserClaims(UID_OK, {
    modules: { 'educacao-continuada': true },
  });

  await auth.createUser({ uid: UID_NO_CLAIM, email: `${UID_NO_CLAIM}@smoke.test` });
  // sem claim modules — vai falhar no assertEcAccess

  // Member ativo no lab
  await db.doc(`labs/${LAB_ID}/members/${UID_OK}`).set({ role: 'admin', active: true });
  // user sem claim NÃO vira member — duplo bloqueio

  // ec lab root
  await db.doc(`educacaoContinuada/${LAB_ID}`).set({ labId: LAB_ID });

  // 1 treinamento + 2 colaboradores
  const treinId = `trein-${randomUUID().slice(0, 8)}`;
  await db.doc(`educacaoContinuada/${LAB_ID}/treinamentos/${treinId}`).set({
    labId: LAB_ID,
    titulo: 'SMOKE Biossegurança',
    tema: 'Biossegurança',
    cargaHoraria: 2,
    modalidade: 'presencial',
    unidade: 'fixa',
    responsavel: 'Smoke Tester',
    periodicidade: 'anual',
    ativo: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    deletadoEm: null,
  });

  const col1Id = `col-${randomUUID().slice(0, 8)}`;
  const col2Id = `col-${randomUUID().slice(0, 8)}`;
  for (const id of [col1Id, col2Id]) {
    await db.doc(`educacaoContinuada/${LAB_ID}/colaboradores/${id}`).set({
      labId: LAB_ID,
      nome: `Colab ${id}`,
      cargo: 'Biomédico',
      setor: 'Hematologia',
      ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      deletadoEm: null,
    });
  }

  return { treinId, col1Id, col2Id };
}

// ─── Cenários ───────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n[smoke-ec] LAB_ID=${LAB_ID} UID_OK=${UID_OK}\n`);

  const { treinId, col1Id, col2Id } = await seed();
  const tokenOk = await mintIdToken(UID_OK);
  const tokenNoClaim = await mintIdToken(UID_NO_CLAIM);

  // 1. Auth fail — sem token
  const noAuthCall = await fetch(
    `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/ec_mintSignature`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { labId: LAB_ID, payloads: [{ x: 1 }] } }),
    },
  );
  const noAuthJson = await noAuthCall.json();
  record(
    '1. Sem auth → unauthenticated',
    noAuthJson.error?.status === 'UNAUTHENTICATED',
    JSON.stringify(noAuthJson),
  );

  // 2. Claim ausente → permission-denied
  await expectError(
    callCallable('ec_mintSignature', tokenNoClaim, { labId: LAB_ID, payloads: [{ x: 1 }] }),
    'PERMISSION_DENIED',
    '2. Claim ausente → permission-denied',
  );

  // 3. Mint signature (happy path)
  const mintRes = await expectOk(
    callCallable('ec_mintSignature', tokenOk, {
      labId: LAB_ID,
      payloads: [{ foo: 'bar', n: 1 }],
    }),
    '3. ec_mintSignature happy path',
  );
  if (mintRes && mintRes.signatures?.[0]?.hash?.length !== 64) {
    record('3a. mint hash size 64', false, `len=${mintRes.signatures?.[0]?.hash?.length}`);
  } else if (mintRes) {
    record('3a. mint hash size 64', true);
  }

  // 4. Commit realizada — RN-03 fail (lista presencas vazia)
  await expectError(
    callCallable('ec_commitExecucaoRealizada', tokenOk, {
      labId: LAB_ID,
      execucaoId: null,
      treinamentoId: treinId,
      dataPlanejada: Date.now(),
      dataAplicacao: Date.now(),
      ministrante: 'Smoke',
      pauta: 'pauta',
      presencas: [],
      diasAntecedenciaAlerta: 30,
    }),
    'INVALID_ARGUMENT', // Zod min(1) bloqueia antes de chegar ao handler
    '4. Commit realizada presencas=[] → invalid-argument (Zod)',
  );

  // 4b. Commit realizada — RN-03 fail server (todos com presente=false passa Zod)
  await expectError(
    callCallable('ec_commitExecucaoRealizada', tokenOk, {
      labId: LAB_ID,
      execucaoId: null,
      treinamentoId: treinId,
      dataPlanejada: Date.now(),
      dataAplicacao: Date.now(),
      ministrante: 'Smoke',
      pauta: 'pauta',
      presencas: [{ colaboradorId: col1Id, presente: false }],
      diasAntecedenciaAlerta: 30,
    }),
    'FAILED_PRECONDITION',
    '4b. Commit realizada todos ausentes → RN-03 failed-precondition',
  );

  // 5. Commit realizada happy path
  const realizadaRes = await expectOk(
    callCallable('ec_commitExecucaoRealizada', tokenOk, {
      labId: LAB_ID,
      execucaoId: null,
      treinamentoId: treinId,
      dataPlanejada: Date.now() - 86400000,
      dataAplicacao: Date.now(),
      ministrante: 'Smoke Tester',
      pauta: 'Conteúdo de teste',
      presencas: [
        { colaboradorId: col1Id, presente: true },
        { colaboradorId: col2Id, presente: false },
      ],
      diasAntecedenciaAlerta: 30,
    }),
    '5. ec_commitExecucaoRealizada happy path',
  );
  const execucaoId = realizadaRes?.execucaoId;

  // 6. Registrar eficácia — RN-02 fail
  if (execucaoId) {
    await expectError(
      callCallable('ec_registrarAvaliacaoEficacia', tokenOk, {
        labId: LAB_ID,
        execucaoId,
        resultado: 'ineficaz',
        evidencia: 'evidência teste',
        dataAvaliacao: Date.now(),
        fechar: true,
        // sem acaoCorretiva — RN-02 deve bloquear
      }),
      'FAILED_PRECONDITION',
      '6. Registrar eficácia ineficaz+fechar sem ação → RN-02',
    );

    // 7. Registrar eficácia happy path (com ação)
    const eficaciaRes = await expectOk(
      callCallable('ec_registrarAvaliacaoEficacia', tokenOk, {
        labId: LAB_ID,
        execucaoId,
        resultado: 'ineficaz',
        evidencia: 'evidência teste',
        dataAvaliacao: Date.now(),
        fechar: true,
        acaoCorretiva: 'Replanejar conteúdo',
      }),
      '7. ec_registrarAvaliacaoEficacia happy path',
    );
    void eficaciaRes;

    // 8. Registrar competência — ISO 15189 fail (reprovado sem proximaAvaliacaoEm)
    await expectError(
      callCallable('ec_registrarAvaliacaoCompetencia', tokenOk, {
        labId: LAB_ID,
        execucaoId,
        colaboradorId: col1Id,
        metodo: 'observacao_direta',
        resultado: 'reprovado',
        evidencia: 'evidência',
        dataAvaliacao: Date.now(),
        // sem proximaAvaliacaoEm
      }),
      'FAILED_PRECONDITION',
      '8. Registrar competência reprovado sem próx → ISO 15189',
    );

    // 9. Registrar competência — colaborador AUSENTE (col2Id estava presente=false)
    await expectError(
      callCallable('ec_registrarAvaliacaoCompetencia', tokenOk, {
        labId: LAB_ID,
        execucaoId,
        colaboradorId: col2Id,
        metodo: 'observacao_direta',
        resultado: 'aprovado',
        evidencia: 'evidência',
        dataAvaliacao: Date.now(),
      }),
      'FAILED_PRECONDITION',
      '9. Registrar competência colaborador ausente → ISO 15189',
    );

    // 10. Registrar competência happy path (col1 estava presente)
    await expectOk(
      callCallable('ec_registrarAvaliacaoCompetencia', tokenOk, {
        labId: LAB_ID,
        execucaoId,
        colaboradorId: col1Id,
        metodo: 'observacao_direta',
        resultado: 'aprovado',
        evidencia: 'evidência',
        dataAvaliacao: Date.now(),
      }),
      '10. ec_registrarAvaliacaoCompetencia happy path',
    );
  }

  // 11. Adiar — cria nova execução planejada primeiro
  const planejadaRef = db.collection(`educacaoContinuada/${LAB_ID}/execucoes`).doc();
  await planejadaRef.set({
    labId: LAB_ID,
    treinamentoId: treinId,
    dataPlanejada: ts(Date.now() + 86400000),
    dataAplicacao: null,
    ministrante: 'Smoke',
    pauta: 'pauta',
    status: 'planejado',
    assinatura: { hash: 'a'.repeat(64), operatorId: UID_OK, ts: admin.firestore.Timestamp.now() },
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    deletadoEm: null,
  });

  await expectOk(
    callCallable('ec_commitExecucaoAdiada', tokenOk, {
      labId: LAB_ID,
      execucaoOriginalId: planejadaRef.id,
      novaDataPlanejada: Date.now() + 30 * 86400000,
      motivo: 'Smoke adiamento',
    }),
    '11. ec_commitExecucaoAdiada happy path',
  );

  // ─── Resumo ──────────────────────────────────────────────────────────────
  console.log(`\n─── SMOKE RESULT ───`);
  console.log(`pass: ${results.pass}  fail: ${results.fail}`);
  console.log(`────────────────────`);

  if (results.fail > 0) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('FATAL', err);
  process.exit(2);
});
