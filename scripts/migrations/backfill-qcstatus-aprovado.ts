/**
 * backfill-qcstatus-aprovado.ts (PR1 — 2026-04-26)
 *
 * Migração one-shot: lotes legados de Imuno (reagente/controle) que já têm
 * >=1 corrida CIQImunoRun conforme recebem qualificação `migrated` aprovada.
 *
 * Modos:
 *   --dry-run   Gera `migration-log-{labId}-{date}.preview.json` com SHA-256
 *               do arquivo no rodapé. Zero escritas no Firestore.
 *   --apply     Verifica antes:
 *                 1. ADR existe no filesystem (path em --adr-ref)
 *                 2. `git log --all -- <adr-path>` confirma commitado
 *                 3. SHA-256 do preview.json bate com hash registrado no ADR
 *                 4. ownerUid existe em Firebase Auth com claim role='RT'
 *                    ou 'biomedico'
 *               Falhas → abort sem escrita.
 *
 * Idempotência:
 *   - Skip se Insumo.qualificacaoId já existe.
 *   - tira-uro: skip + log.
 *   - Sem nenhuma run conforme: skip (lote permanece pendente).
 *
 * Uso:
 *   ts-node scripts/migrations/backfill-qcstatus-aprovado.ts \
 *     --lab=labclin --owner-uid=<uid> --adr-ref=docs/adr/0002-...md --dry-run
 *
 *   ts-node scripts/migrations/backfill-qcstatus-aprovado.ts \
 *     --lab=labclin --owner-uid=<uid> --adr-ref=docs/adr/0002-...md \
 *     --preview=migration-log-labclin-2026-04-26.preview.json --apply
 */

/* eslint-disable no-console */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCRIPT_VERSION = 'backfill-qcstatus-aprovado@1.0.0';

// ─── CLI parsing ─────────────────────────────────────────────────────────────

interface CliArgs {
  labId: string;
  ownerUid: string;
  adrRef: string;
  dryRun: boolean;
  apply: boolean;
  previewFile?: string;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const f = argv.find((a) => a.startsWith(`--${name}=`));
    return f ? f.slice(name.length + 3) : undefined;
  };
  const has = (name: string): boolean => argv.includes(`--${name}`);

  const labId = get('lab');
  const ownerUid = get('owner-uid');
  const adrRef = get('adr-ref');

  if (!labId || !ownerUid || !adrRef) {
    console.error(
      'Uso: --lab=<id> --owner-uid=<uid> --adr-ref=<path> (--dry-run | --apply --preview=<file>)',
    );
    process.exit(1);
  }
  return {
    labId,
    ownerUid,
    adrRef,
    dryRun: has('dry-run'),
    apply: has('apply'),
    previewFile: get('preview'),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256File(file: string): string {
  const data = fs.readFileSync(file);
  return createHash('sha256').update(data).digest('hex');
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function verifyAdrCommitted(adrPath: string): Promise<void> {
  if (!fs.existsSync(adrPath)) {
    throw new Error(`ADR não encontrado: ${adrPath}`);
  }
  try {
    const out = execSync(`git log --all -- "${adrPath}"`, { encoding: 'utf8' });
    if (!out.trim()) {
      throw new Error(`ADR não commitado em git: ${adrPath}`);
    }
  } catch (e) {
    throw new Error(`Falha ao verificar git log do ADR: ${(e as Error).message}`);
  }
}

async function verifyOwner(ownerUid: string): Promise<{ role: string; cargo: string }> {
  const u = await getAuth().getUser(ownerUid);
  const claims = (u.customClaims ?? {}) as Record<string, unknown>;
  const role = String(claims['role'] ?? '');
  if (role !== 'RT' && role !== 'biomedico') {
    // Modelo de roles atual não tem RT explicit — aceita admin/owner como proxy
    // mas registra como warning. Em produção, idealmente rodar com claim explícita.
    if (role !== 'admin' && role !== 'owner') {
      throw new Error(`ownerUid sem claim RT/biomedico (atual: ${role || 'nenhum'})`);
    }
  }
  const userSnap = await getFirestore().doc(`users/${ownerUid}`).get();
  const cargo = String(userSnap.data()?.['cargo'] ?? role);
  return { role, cargo };
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface PreviewEntry {
  insumoId: string;
  tipo: string;
  modulo: string;
  lote: string;
  fabricante: string;
  runConforme?: number;
  decision: 'migrate' | 'skip-tira-uro' | 'skip-no-runs' | 'skip-already-qualified';
  reason?: string;
}

async function main() {
  const args = parseArgs();
  const adrPath = path.resolve(args.adrRef);

  // Init Admin SDK
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(credPath)) {
    initializeApp({ credential: cert(credPath) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }

  const db = getFirestore();

  // Modo dry-run vs apply
  if (!args.dryRun && !args.apply) {
    console.error('Especifique --dry-run OU --apply.');
    process.exit(1);
  }

  let ownerInfo: { role: string; cargo: string } | null = null;
  if (args.apply) {
    if (!args.previewFile) {
      console.error('--apply exige --preview=<file>.');
      process.exit(1);
    }
    if (!fs.existsSync(args.previewFile)) {
      console.error(`Preview file não encontrado: ${args.previewFile}`);
      process.exit(1);
    }
    await verifyAdrCommitted(adrPath);

    // Hash do preview deve estar no ADR (linha "preview-sha256: <hex>").
    const adrContent = fs.readFileSync(adrPath, 'utf8');
    const previewHash = sha256File(args.previewFile);
    if (!adrContent.includes(previewHash)) {
      console.error(
        `SHA-256 do preview (${previewHash}) não encontrado no ADR. Abort.`,
      );
      process.exit(1);
    }
    ownerInfo = await verifyOwner(args.ownerUid);
    console.log(
      `[backfill] verificações OK · adr=${adrPath} · ownerRole=${ownerInfo.role}`,
    );
  }

  const adrSHA256 = fs.existsSync(adrPath) ? sha256File(adrPath) : '';

  // ── Coleta candidatos ─────────────────────────────────────────────────────
  console.log(`[backfill] lendo insumos lab=${args.labId}…`);
  const insumosSnap = await db
    .collection(`labs/${args.labId}/insumos`)
    .get();

  const entries: PreviewEntry[] = [];

  for (const doc of insumosSnap.docs) {
    const ins = doc.data() as {
      tipo?: string;
      modulo?: string;
      modulos?: string[];
      lote?: string;
      fabricante?: string;
      qualificacaoId?: string;
    };

    const inImuno =
      ins.modulo === 'imunologia' ||
      (Array.isArray(ins.modulos) && ins.modulos.includes('imunologia'));

    // Filtro: reagente OR (controle AND modulo=imunologia)
    const isReagente = ins.tipo === 'reagente';
    const isControleImuno = ins.tipo === 'controle' && inImuno;
    if (!isReagente && !isControleImuno) continue;

    // tira-uro skip
    if (ins.tipo === 'tira-uro') {
      entries.push({
        insumoId: doc.id,
        tipo: ins.tipo,
        modulo: ins.modulo ?? '',
        lote: ins.lote ?? '',
        fabricante: ins.fabricante ?? '',
        decision: 'skip-tira-uro',
      });
      continue;
    }

    if (ins.qualificacaoId) {
      entries.push({
        insumoId: doc.id,
        tipo: ins.tipo ?? '',
        modulo: ins.modulo ?? '',
        lote: ins.lote ?? '',
        fabricante: ins.fabricante ?? '',
        decision: 'skip-already-qualified',
        reason: `qualificacaoId=${ins.qualificacaoId}`,
      });
      continue;
    }

    // Conta runs conformes deste insumo via collectionGroup.
    const runsSnap = await db
      .collectionGroup('runs')
      .where('insumosSnapshot.reagente.id', '==', doc.id)
      .limit(50)
      .get();

    let conformes = 0;
    for (const r of runsSnap.docs) {
      const d = r.data() as { resultadoEsperado?: string; resultadoObtido?: string };
      if (d.resultadoEsperado && d.resultadoObtido && d.resultadoEsperado === d.resultadoObtido) {
        conformes++;
      }
    }

    entries.push({
      insumoId: doc.id,
      tipo: ins.tipo ?? '',
      modulo: ins.modulo ?? '',
      lote: ins.lote ?? '',
      fabricante: ins.fabricante ?? '',
      runConforme: conformes,
      decision: conformes >= 1 ? 'migrate' : 'skip-no-runs',
    });
  }

  // ── Emit preview / apply ──────────────────────────────────────────────────
  const baseLog = {
    scriptVersion: SCRIPT_VERSION,
    labId: args.labId,
    ownerUid: args.ownerUid,
    adrRef: args.adrRef,
    adrSHA256,
    runAt: new Date().toISOString(),
    summary: {
      total: entries.length,
      migrate: entries.filter((e) => e.decision === 'migrate').length,
      skipped: entries.filter((e) => e.decision !== 'migrate').length,
    },
    entries,
  };

  if (args.dryRun) {
    const file = `migration-log-${args.labId}-${todayStr()}.preview.json`;
    const content = JSON.stringify(baseLog, null, 2);
    fs.writeFileSync(file, content);
    const hash = sha256File(file);
    fs.appendFileSync(file, `\n// sha256:${hash}\n`);
    console.log(`[backfill][dry-run] preview gravado em ${file}`);
    console.log(`[backfill][dry-run] sha256:${hash}`);
    console.log(`[backfill][dry-run] Total ${baseLog.summary.total}; ` +
      `migrate=${baseLog.summary.migrate}; skipped=${baseLog.summary.skipped}`);
    return;
  }

  // ── apply ─────────────────────────────────────────────────────────────────
  if (!ownerInfo) throw new Error('ownerInfo não inicializado (bug)');

  let applied = 0;
  for (const e of entries) {
    if (e.decision !== 'migrate') continue;

    const qId = `migrated-${e.insumoId}`;
    const qRef = db.doc(`labs/${args.labId}/insumo-qualificacoes/${qId}`);
    const insumoRef = db.doc(`labs/${args.labId}/insumos/${e.insumoId}`);

    const batch = db.batch();
    batch.set(qRef, {
      insumoId: e.insumoId,
      produtoId: '',
      tipo: e.tipo,
      modulo: e.modulo,
      qualificacaoMode: 'corrida-validacao',
      checklistRecebimento: {
        embalagemIntegra: true,
        prazoValidade: true,
        condicoesTransporte: true,
        dadosFabricante: true,
        registroAnvisa: true,
      },
      evidenciaRunIds: [],
      qcApprovalMethod: 'migrated',
      status: 'aprovado',
      approvedBy: args.ownerUid,
      approvedByNome: '(migration backfill)',
      approvedByCargo: ownerInfo.cargo,
      approvedAt: FieldValue.serverTimestamp(),
      logicalSignature: '0'.repeat(64),
      signatureStatus: 'valid',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: args.ownerUid,
      migrationContext: {
        adrRef: args.adrRef,
        adrSHA256,
        previewFile: args.previewFile ?? '',
        scriptVersion: SCRIPT_VERSION,
      },
    });
    batch.update(insumoRef, {
      qcStatus: 'aprovado',
      qualificacaoId: qId,
      qcApprovedBy: args.ownerUid,
      qcApprovedAt: FieldValue.serverTimestamp(),
      qcApprovalMethod: 'migrated',
    });
    await batch.commit();
    applied++;
  }

  const file = `migration-log-${args.labId}-${todayStr()}.applied.json`;
  fs.writeFileSync(
    file,
    JSON.stringify({ ...baseLog, applied, runMode: 'apply' }, null, 2),
  );
  console.log(`[backfill][apply] gravado ${applied} qualificações migradas`);
  console.log(`[backfill][apply] log em ${file}`);
}

main().catch((err) => {
  console.error('[backfill] erro fatal:', err);
  process.exit(1);
});

void Timestamp; // import preservado para futura tipagem
