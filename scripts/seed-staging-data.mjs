#!/usr/bin/env node
/**
 * seed-staging-data.mjs — Seed test data to staging Firestore
 *
 * Populates hmatologia2-staging with minimal test data needed for smoke tests.
 * Creates: 1 test lab, 1 test user, sample data for core modules.
 *
 * Usage:
 *   export FIREBASE_PROJECT_ID=hmatologia2-staging
 *   export TEST_LAB_ID=test-lab-001
 *   node scripts/seed-staging-data.mjs
 *
 * Environment variables:
 *   FIREBASE_PROJECT_ID — Firebase project to seed (default: hmatologia2-staging)
 *   TEST_LAB_ID — Lab ID to create (default: test-lab-001)
 *   FIREBASE_EMULATOR_HOST — If set, use emulator instead of production
 */

import admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';

// Configuration
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'hmatologia2-staging';
const TEST_LAB_ID = process.env.TEST_LAB_ID || 'test-lab-001';
const FIREBASE_EMULATOR_HOST = process.env.FIREBASE_EMULATOR_HOST;
const USE_EMULATOR = !!FIREBASE_EMULATOR_HOST;

// If using emulator, set env vars before init
if (USE_EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = FIREBASE_EMULATOR_HOST;
}

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: PROJECT_ID,
  });
} catch (e) {
  if (!e.message.includes('already initialized')) {
    throw e;
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Timestamp helper
function ts(millis = Date.now()) {
  return admin.firestore.Timestamp.fromMillis(millis);
}

// Logging with timestamps
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

// Main seeding function
async function seedStagingData() {
  let success = 0;
  let errors = [];

  try {
    logSection('STAGING DATA SEEDER');
    log(`Project: ${PROJECT_ID}`);
    log(`Lab ID: ${TEST_LAB_ID}`);
    log(`Mode: ${USE_EMULATOR ? 'Emulator' : 'Production'}\n`);

    // Step 1: Create test lab
    logSection('Step 1: Create Test Lab');
    try {
      const labRef = db.collection('labs').doc(TEST_LAB_ID);
      const labData = {
        id: TEST_LAB_ID,
        nome: 'Laboratório de Testes - Staging',
        estado: 'ativo',
        criadoEm: ts(),
        deletadoEm: null,
        configuracoes: {
          permiteMultiplosAnalistas: true,
          requerValidacaoFT: true,
        },
      };

      await labRef.set(labData);
      log(`✓ Lab created: ${TEST_LAB_ID}`);
      success++;
    } catch (e) {
      const msg = `Failed to create lab: ${e.message}`;
      log(`✗ ${msg}`);
      errors.push(msg);
    }

    // Step 2: Create test user with standard claims
    logSection('Step 2: Create Test User');
    const testEmail = `test-${Date.now()}@staging.hmatologia2.local`;
    const testPassword = 'TestPassword@123';

    try {
      const userRecord = await auth.createUser({
        email: testEmail,
        password: testPassword,
        displayName: 'Test User',
        emailVerified: true,
      });

      log(`✓ User created: ${userRecord.uid}`);

      // Set custom claims for module access
      const claims = {
        modules: {
          'analyzer': true,
          'coagulacao': true,
          'ciq-imuno': true,
          'insumos': true,
          'uroanalise': true,
          'equipamentos': true,
          'fornecedores': true,
          'lots': true,
          'runs': true,
          'chart': true,
          'reports': true,
          'labSettings': true,
          'hub': true,
          'bulaparser': true,
        },
        labIds: [TEST_LAB_ID],
      };

      await auth.setCustomUserClaims(userRecord.uid, claims);
      log(`✓ Custom claims set for modules`);

      // Create user lab membership
      const userDocRef = db.collection('labs').doc(TEST_LAB_ID).collection('usuarios').doc(userRecord.uid);
      const userData = {
        id: userRecord.uid,
        labId: TEST_LAB_ID,
        email: testEmail,
        nome: 'Test User',
        perfil: 'operador',
        ativo: true,
        criadoEm: ts(),
        deletadoEm: null,
      };

      await userDocRef.set(userData);
      log(`✓ User added to lab: ${TEST_LAB_ID}`);
      success++;

      // Write credentials to file for test use
      const credsFile = './.staging-test-creds.json';
      const credsData = {
        email: testEmail,
        password: testPassword,
        uid: userRecord.uid,
        labId: TEST_LAB_ID,
        generatedAt: new Date().toISOString(),
      };

      const fs = (await import('fs')).default;
      fs.writeFileSync(credsFile, JSON.stringify(credsData, null, 2));
      log(`✓ Test credentials written to ${credsFile}`);
    } catch (e) {
      const msg = `Failed to create user: ${e.message}`;
      log(`✗ ${msg}`);
      errors.push(msg);
    }

    // Step 3: Seed minimal module data
    logSection('Step 3: Seed Module Sample Data');

    // 3a: Equipamentos (equipment/analyzers)
    try {
      const equipRef = db
        .collection('labs')
        .doc(TEST_LAB_ID)
        .collection('equipamentos')
        .doc('equip-analyzer-001');

      await equipRef.set({
        id: 'equip-analyzer-001',
        labId: TEST_LAB_ID,
        nome: 'Analisador Yumizen H550',
        tipo: 'analyzer',
        modelo: 'H550',
        fabricante: 'Horiba',
        numeroPatrimonio: 'HOR-2026-001',
        ativo: true,
        criadoEm: ts(),
        deletadoEm: null,
      });

      log(`✓ Equipment (analyzer) created`);
      success++;
    } catch (e) {
      log(`⚠ Equipment seed skipped: ${e.message}`);
    }

    // 3b: Fornecedores (suppliers)
    try {
      const supRef = db
        .collection('labs')
        .doc(TEST_LAB_ID)
        .collection('fornecedores')
        .doc('sup-001');

      await supRef.set({
        id: 'sup-001',
        labId: TEST_LAB_ID,
        nome: 'Fabricante de Reagentes ABC',
        contato: {
          email: 'contato@abc-reagentes.com.br',
          telefone: '+55 11 3000-0000',
        },
        ativo: true,
        criadoEm: ts(),
        deletadoEm: null,
      });

      log(`✓ Supplier created`);
      success++;
    } catch (e) {
      log(`⚠ Supplier seed skipped: ${e.message}`);
    }

    // 3c: Lotes (control lots)
    try {
      const lotRef = db
        .collection('labs')
        .doc(TEST_LAB_ID)
        .collection('lotes')
        .doc('lot-001');

      await lotRef.set({
        id: 'lot-001',
        labId: TEST_LAB_ID,
        numeroLote: `LOT-${Date.now()}`,
        produto: 'Controle de Qualidade Coagulação Nível 1',
        fabricante: 'Bio-Rad',
        dataValidade: ts(Date.now() + 365 * 24 * 60 * 60 * 1000),
        ativo: true,
        criadoEm: ts(),
        deletadoEm: null,
      });

      log(`✓ Control lot created`);
      success++;
    } catch (e) {
      log(`⚠ Control lot seed skipped: ${e.message}`);
    }

    // Step 4: Summary
    logSection('Seeding Summary');
    log(`✓ Successfully seeded: ${success} items`);

    if (errors.length > 0) {
      log(`\n⚠ Errors encountered: ${errors.length}`);
      errors.forEach((e, i) => {
        log(`  ${i + 1}. ${e}`);
      });
    }

    log(`\n✓ Staging data seeding completed`);
    log(`Test environment ready at: https://hmatologia2-staging.web.app`);

    return {
      success: true,
      itemsSeeded: success,
      errors: errors,
      testCredentials: {
        email: testEmail,
        labId: TEST_LAB_ID,
      },
    };
  } catch (e) {
    console.error('Fatal error during seeding:', e);
    process.exit(1);
  }
}

// Execute
seedStagingData()
  .then((result) => {
    if (result.success && result.errors.length === 0) {
      process.exit(0);
    } else if (result.success) {
      console.warn('Partial success - some items failed to seed');
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error('Unexpected error:', e);
    process.exit(1);
  });
