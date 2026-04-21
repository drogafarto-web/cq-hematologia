/**
 * verifyInsumoChain — valida a integridade da cadeia criptográfica de
 * movimentações de insumos de um laboratório.
 *
 * Uso:
 *   LAB_ID=<labId> npx tsx tools/verifyInsumoChain.ts
 *   LAB_ID=<labId> INSUMO_ID=<insumoId> npx tsx tools/verifyInsumoChain.ts
 *
 * Requer:
 *   - service-account.json na raiz do projeto (Admin SDK)
 *   - LAB_ID env
 *
 * Saída:
 *   - Relatório por insumo: total de movimentações, selados, pendentes,
 *     quebras detectadas.
 *   - Exit code 0 se 100% válido; 1 se qualquer quebra detectada ou evento
 *     pendente há mais que a janela de selagem esperada (default 60s).
 *
 * Invariantes checados:
 *   1. Todo evento selado tem chainHash != null e chainStatus == 'sealed'.
 *   2. Recomputação: chainHash == SHA256(payloadSignature + previousChainHash)
 *      onde previousChainHash é do evento imediatamente anterior (ordem por
 *      timestamp asc, tiebreaker por movId) OU INSUMO_CHAIN_GENESIS_HASH
 *      se for o primeiro.
 *   3. payloadSignature tem 64 caracteres hex.
 *   4. Eventos 'pending' mais velhos que SEALING_GRACE_MS são suspeitos —
 *      indica trigger falhando ou lag > SLA.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Config ──────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
const LAB_ID = process.env.LAB_ID;
const INSUMO_ID_FILTER = process.env.INSUMO_ID ?? null;
const SEALING_GRACE_MS = 60_000; // 60s — trigger deve selar bem antes disso
const INSUMO_CHAIN_GENESIS_SEED = 'hcq-insumo-movimentacao-v1';

const INSUMO_CHAIN_GENESIS_HASH = crypto
  .createHash('sha256')
  .update(INSUMO_CHAIN_GENESIS_SEED)
  .digest('hex');

if (!LAB_ID) {
  console.error('ERRO: LAB_ID env var é obrigatório.');
  process.exit(2);
}
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`ERRO: ${SERVICE_ACCOUNT_PATH} não encontrado.`);
  process.exit(2);
}

// ─── Init Admin SDK ──────────────────────────────────────────────────────────

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MovDoc {
  id: string;
  insumoId: string;
  payloadSignature: string;
  chainHash: string | null;
  chainStatus: 'pending' | 'sealed';
  timestamp: Timestamp;
  sealedAt?: Timestamp;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Ordena por timestamp asc, tiebreaker por movId lexicográfico asc.
 * Deve bater exatamente com a lógica de `findPreviousSealed` na Cloud Function.
 */
function canonicalSort(a: MovDoc, b: MovDoc): number {
  const tA = a.timestamp.toMillis();
  const tB = b.timestamp.toMillis();
  if (tA !== tB) return tA - tB;
  return a.id.localeCompare(b.id);
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Report {
  insumoId: string;
  total: number;
  sealed: number;
  pending: number;
  breaks: Array<{ movId: string; reason: string }>;
  stalePending: number;
}

async function verify(): Promise<{ reports: Report[]; anyBroken: boolean }> {
  const colRef = db.collection(`labs/${LAB_ID}/insumo-movimentacoes`);
  const snap = INSUMO_ID_FILTER
    ? await colRef.where('insumoId', '==', INSUMO_ID_FILTER).get()
    : await colRef.get();

  const byInsumo = new Map<string, MovDoc[]>();
  snap.forEach((d) => {
    const data = d.data() as Omit<MovDoc, 'id'>;
    const mov: MovDoc = { id: d.id, ...data };
    const list = byInsumo.get(mov.insumoId) ?? [];
    list.push(mov);
    byInsumo.set(mov.insumoId, list);
  });

  const reports: Report[] = [];
  const now = Date.now();
  let anyBroken = false;

  for (const [insumoId, movsUnsorted] of byInsumo.entries()) {
    const movs = [...movsUnsorted].sort(canonicalSort);
    const report: Report = {
      insumoId,
      total: movs.length,
      sealed: 0,
      pending: 0,
      breaks: [],
      stalePending: 0,
    };

    let previousChainHash = INSUMO_CHAIN_GENESIS_HASH;

    for (const mov of movs) {
      // Validação 3 — payloadSignature formato
      if (!mov.payloadSignature || mov.payloadSignature.length !== 64) {
        report.breaks.push({
          movId: mov.id,
          reason: `payloadSignature inválido (len=${mov.payloadSignature?.length ?? 0})`,
        });
        anyBroken = true;
        continue;
      }

      if (mov.chainStatus === 'pending') {
        report.pending += 1;
        // Validação 4 — stale pending
        const ageMs = now - mov.timestamp.toMillis();
        if (ageMs > SEALING_GRACE_MS) {
          report.stalePending += 1;
          report.breaks.push({
            movId: mov.id,
            reason: `pending há ${Math.round(ageMs / 1000)}s (grace=${SEALING_GRACE_MS / 1000}s)`,
          });
          anyBroken = true;
        }
        // Não avança previousChainHash — ainda não selado.
        continue;
      }

      // chainStatus === 'sealed'
      // Validação 1 — sealed deve ter chainHash
      if (!mov.chainHash) {
        report.breaks.push({ movId: mov.id, reason: 'sealed sem chainHash' });
        anyBroken = true;
        continue;
      }

      // Validação 2 — recomputação do chain hash
      const expected = sha256Hex(mov.payloadSignature + previousChainHash);
      if (expected !== mov.chainHash) {
        report.breaks.push({
          movId: mov.id,
          reason: `chainHash diverge (esperado ${expected.slice(0, 12)}…, atual ${mov.chainHash.slice(0, 12)}…)`,
        });
        anyBroken = true;
      }

      report.sealed += 1;
      previousChainHash = mov.chainHash;
    }

    reports.push(report);
  }

  return { reports, anyBroken };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`[verifyInsumoChain] lab=${LAB_ID} insumo=${INSUMO_ID_FILTER ?? '*'}`);
  const { reports, anyBroken } = await verify();

  const totalEvents = reports.reduce((sum, r) => sum + r.total, 0);
  const totalBroken = reports.reduce((sum, r) => sum + r.breaks.length, 0);
  const insumosWithBreaks = reports.filter((r) => r.breaks.length > 0).length;

  console.log(`\nResumo:`);
  console.log(`  Insumos verificados:   ${reports.length}`);
  console.log(`  Eventos totais:        ${totalEvents}`);
  console.log(`  Eventos com quebra:    ${totalBroken}`);
  console.log(`  Insumos com quebra:    ${insumosWithBreaks}`);

  if (insumosWithBreaks > 0) {
    console.log(`\nDetalhes das quebras:`);
    for (const r of reports) {
      if (r.breaks.length === 0) continue;
      console.log(`\n  ${r.insumoId} (${r.sealed} sealed, ${r.pending} pending):`);
      for (const b of r.breaks) {
        console.log(`    - ${b.movId}: ${b.reason}`);
      }
    }
  }

  if (anyBroken) {
    console.log('\nFAIL: integridade da cadeia comprometida.');
    process.exit(1);
  }
  console.log('\nOK: cadeia íntegra.');
  process.exit(0);
})().catch((err) => {
  console.error('ERRO não-tratado:', err);
  process.exit(2);
});
