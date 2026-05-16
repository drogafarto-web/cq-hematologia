#!/usr/bin/env node

/**
 * Agent 07 — Upload dos arquivos-fonte (.docx/.xlsx) para Firebase Storage
 *
 * Sobe o arquivo original editável ao lado do PDF já existente.
 * Path: labs/{labId}/sgq/documentos/{codigo}/source.{ext}
 *
 * A Cloud Function criarDocumentoGDocs usará esse source para criar
 * o Google Doc com conteúdo pré-populado (em vez de Doc vazio).
 *
 * Input:  manifest.json (com sourcePath do Agent 01)
 * Output: manifest.json atualizado com _sourceStoragePath
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { extname } from 'path';
import { CONFIG } from '../config.mjs';

// Firebase Init
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: CONFIG.projectId,
    storageBucket: CONFIG.storageBucket,
  });
}

const bucket = admin.storage().bucket();

function computeSHA256(filePath) {
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

function getMimeType(ext) {
  const map = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    '.doc': 'application/msword',
    '.xls': 'application/vnd.ms-excel',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

function getSourceStoragePath(doc) {
  const ext = extname(doc.sourcePath).toLowerCase();
  return `labs/${CONFIG.labId}/sgq/documentos/${doc.codigo}/source${ext}`;
}

async function uploadSourceFile(localPath, storagePath, contentType, metadata) {
  const file = bucket.file(storagePath);
  const buffer = readFileSync(localPath);

  await file.save(buffer, {
    contentType,
    metadata: {
      metadata: {
        codigo: metadata.codigo,
        labId: CONFIG.labId,
        tipo: 'source',
        originalName: metadata.originalName,
        sha256: metadata.sha256,
        migratedAt: new Date().toISOString(),
      },
    },
  });

  return `gs://${CONFIG.storageBucket}/${storagePath}`;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  AGENT 07 — UPLOAD SOURCE FILES (.docx/.xlsx)');
  console.log(`  Bucket: ${CONFIG.storageBucket}`);
  console.log(`  Lab: ${CONFIG.labId}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const raw = JSON.parse(readFileSync(CONFIG.manifestPath, 'utf-8'));
  const manifest = raw.docs;

  const editableExts = ['.docx', '.xlsx', '.xlsm', '.doc', '.xls'];
  const docsToUpload = manifest.filter(d => {
    if (!d.sourcePath || !existsSync(d.sourcePath)) return false;
    const ext = extname(d.sourcePath).toLowerCase();
    return editableExts.includes(ext);
  });

  console.log(`  Total no manifest: ${manifest.length}`);
  console.log(`  Editáveis para upload: ${docsToUpload.length}\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < docsToUpload.length; i++) {
    const doc = docsToUpload[i];
    const ext = extname(doc.sourcePath).toLowerCase();
    const progress = `[${i + 1}/${docsToUpload.length}]`;
    process.stdout.write(`  ${progress} UP ${doc.codigo}${ext}...          \r`);

    try {
      const storagePath = getSourceStoragePath(doc);
      const contentType = getMimeType(ext);
      const sha256 = computeSHA256(doc.sourcePath);

      const gsUrl = await uploadSourceFile(doc.sourcePath, storagePath, contentType, {
        codigo: doc.codigo,
        originalName: doc.fileName,
        sha256,
      });

      doc._sourceStoragePath = storagePath;
      doc._sourceGsUrl = gsUrl;
      doc._sourceSha256 = sha256;
      uploaded++;
    } catch (err) {
      doc._sourceUploadError = err.message;
      failed++;
      failures.push({ codigo: doc.codigo, error: err.message });
    }
  }

  skipped = manifest.length - docsToUpload.length;

  raw.meta.sourceUploadedCount = uploaded;
  raw.meta.sourceUploadSkipped = skipped;
  raw.meta.sourceUploadFailed = failed;
  raw.meta.sourceUploadedAt = new Date().toISOString();
  writeFileSync(CONFIG.manifestPath, JSON.stringify(raw, null, 2), 'utf-8');

  console.log('\n');
  console.log('  ┌─────────────────────────────────────────────────────');
  console.log(`  │ Uploaded:  ${uploaded}`);
  console.log(`  │ Skipped:   ${skipped} (PDFs/não-editáveis)`);
  console.log(`  │ Failed:    ${failed}`);
  console.log('  └─────────────────────────────────────────────────────');

  if (failures.length > 0) {
    console.log('\n  Falhas:');
    for (const f of failures.slice(0, 10)) {
      console.log(`    - ${f.codigo}: ${f.error}`);
    }
  }

  console.log('\n  Done.\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
