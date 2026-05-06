/**
 * bioquimica/seedBioquimicaDefaults.ts
 *
 * Cloud Function callable: cria os 17 analitos seed do módulo bioquimica
 * para um lab específico. Idempotente — query por (labId, seedDefault: true)
 * verifica o que já existe e só cria os faltantes.
 *
 * Auth: usuário deve ser membro ativo do lab. Não exige claim de admin —
 * qualquer membro pode disparar o seed na primeira ativação. Override
 * (recriar com defaults novos) só superadmin.
 *
 * Compliance:
 *   - RDC 978/2025 Art. 179 — definição inicial dos analitos sob CIQ
 *   - DICQ 4.3 Bloco F 5.5.1.1 — registro de método e parâmetros
 *
 * Schema do path: /labs/{labId}/bioquimica/root/analitos/{analitoId}
 *   (`bioquimica/root` é âncora — ver bioquimicaService.ts no client).
 *
 * Region: southamerica-east1 (lock global).
 * Memory: 256MiB (carga leve — 17 docs num batch).
 * Timeout: 30s default.
 */

import { onCall, HttpsError, type CallableOptions } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface SeedRequestPayload {
  labId: string;
  /** Se `true`, super-admin pode forçar re-seed (recria docs com defaults). */
  forceReseed?: boolean;
}

interface SeedResponse {
  created: number;
  skipped: number;
  total: number;
}

interface AnalitoSeedDoc {
  nome: string;
  sigla?: string;
  unidade: string;
  unidadeSI?: string;
  rangeBiologico: { min: number; max: number };
  metodo?: string;
  cvAlvo?: number;
  ativo: boolean;
}

// ─── Seed dataset ──────────────────────────────────────────────────────────
//
// Manter sincronizado com `src/features/bioquimica/constants/seedAnalitos.ts`.
// Duplicação consciente — functions e client têm runtimes separados; importar
// do client cruzaria fronteira de bundle e empurraria deps Vite para
// functions. Drift é detectável via teste de paridade (Plan 09-02).

const SEED_ANALITOS: ReadonlyArray<AnalitoSeedDoc> = [
  // ── Painel básico ──
  { nome: 'Glicose', sigla: 'GLI', unidade: 'mg/dL', unidadeSI: 'mmol/L',
    rangeBiologico: { min: 70, max: 99 }, metodo: 'Hexoquinase', cvAlvo: 2.5, ativo: true },
  { nome: 'Ureia', sigla: 'URE', unidade: 'mg/dL',
    rangeBiologico: { min: 17, max: 49 }, metodo: 'Urease UV', cvAlvo: 3.0, ativo: true },
  { nome: 'Creatinina', sigla: 'CRE', unidade: 'mg/dL',
    rangeBiologico: { min: 0.6, max: 1.3 }, metodo: 'Jaffé Cinético', cvAlvo: 4.0, ativo: true },

  // ── Painel hepático ──
  { nome: 'TGO/AST', sigla: 'TGO', unidade: 'U/L',
    rangeBiologico: { min: 5, max: 40 }, metodo: 'IFCC sem piridoxal', cvAlvo: 5.0, ativo: true },
  { nome: 'TGP/ALT', sigla: 'TGP', unidade: 'U/L',
    rangeBiologico: { min: 5, max: 41 }, metodo: 'IFCC sem piridoxal', cvAlvo: 5.0, ativo: true },
  { nome: 'Fosfatase Alcalina', sigla: 'FA', unidade: 'U/L',
    rangeBiologico: { min: 40, max: 129 }, metodo: 'IFCC (AMP)', cvAlvo: 4.5, ativo: true },
  { nome: 'GGT', sigla: 'GGT', unidade: 'U/L',
    rangeBiologico: { min: 8, max: 61 }, metodo: 'Szasz/IFCC', cvAlvo: 6.0, ativo: true },
  { nome: 'Bilirrubina Direta', sigla: 'BT-D', unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 0.3 }, metodo: 'Diazo (Sims-Horn)', cvAlvo: 8.0, ativo: true },
  { nome: 'Bilirrubina Indireta', sigla: 'BT-I', unidade: 'mg/dL',
    rangeBiologico: { min: 0.1, max: 1.0 }, metodo: 'Calculado (Total − Direta)', cvAlvo: 8.0, ativo: true },

  // ── Painel lipídico ──
  { nome: 'Colesterol Total', sigla: 'CT', unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 199 }, metodo: 'CHOD-PAP', cvAlvo: 3.0, ativo: true },
  { nome: 'HDL Colesterol', sigla: 'HDL', unidade: 'mg/dL',
    rangeBiologico: { min: 40, max: 999 }, metodo: 'Direto (homogêneo)', cvAlvo: 4.0, ativo: true },
  { nome: 'LDL Colesterol', sigla: 'LDL', unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 129 }, metodo: 'Direto / Friedewald', cvAlvo: 4.5, ativo: true },
  { nome: 'Triglicerídeos', sigla: 'TG', unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 150 }, metodo: 'GPO-PAP', cvAlvo: 4.0, ativo: true },

  // ── Eletrólitos ──
  { nome: 'Sódio', sigla: 'Na', unidade: 'mEq/L', unidadeSI: 'mmol/L',
    rangeBiologico: { min: 136, max: 145 }, metodo: 'ISE', cvAlvo: 1.5, ativo: true },
  { nome: 'Potássio', sigla: 'K', unidade: 'mEq/L', unidadeSI: 'mmol/L',
    rangeBiologico: { min: 3.5, max: 5.0 }, metodo: 'ISE', cvAlvo: 2.0, ativo: true },
  { nome: 'Cloro', sigla: 'Cl', unidade: 'mEq/L', unidadeSI: 'mmol/L',
    rangeBiologico: { min: 98, max: 107 }, metodo: 'ISE', cvAlvo: 1.5, ativo: true },
  { nome: 'Cálcio Total', sigla: 'Ca', unidade: 'mg/dL',
    rangeBiologico: { min: 8.6, max: 10.2 }, metodo: 'Arsenazo III / OCP', cvAlvo: 2.5, ativo: true },
];

// ─── Auth check ────────────────────────────────────────────────────────────

/**
 * Verifica se o usuário é membro ativo do lab. Replica do pattern usado em
 * outras callables do projeto — a fonte de verdade é
 * `/labs/{labId}/members/{uid}.active === true`.
 *
 * Throws HttpsError('permission-denied') se falhar.
 */
async function assertActiveMemberOfLab(uid: string, labId: string): Promise<void> {
  const memberSnap = await db
    .collection('labs')
    .doc(labId)
    .collection('members')
    .doc(uid)
    .get();

  if (!memberSnap.exists) {
    throw new HttpsError(
      'permission-denied',
      'Usuário não é membro deste laboratório.',
    );
  }

  const data = memberSnap.data() as { active?: boolean } | undefined;
  if (data?.active !== true) {
    throw new HttpsError(
      'permission-denied',
      'Membership inativa neste laboratório.',
    );
  }
}

// ─── Callable options ──────────────────────────────────────────────────────

const callableOptions: CallableOptions = {
  region: 'southamerica-east1',
  memory: '256MiB',
  timeoutSeconds: 30,
};

// ─── Function ──────────────────────────────────────────────────────────────

/**
 * Carrega os 17 analitos seed para o lab. Idempotente — chamadas repetidas
 * retornam `{ created: 0, skipped: 17 }`.
 *
 * Operação:
 *   1. Auth: precisa estar autenticado e ser membro ativo do lab (ou super).
 *   2. Lista analitos existentes do lab onde `seedDefault: true`.
 *   3. Filtra os ainda ausentes (match por `nome`).
 *   4. Cria em writeBatch (max 500 ops; 17 estão bem abaixo).
 *   5. Atualiza `/labs/{labId}/bioquimica/root` com `seededAt` para telemetria.
 */
export const seedBioquimicaDefaults = onCall<SeedRequestPayload>(
  callableOptions,
  async (request): Promise<SeedResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { uid, token } = request.auth;
    const isSuperAdmin = token?.isSuperAdmin === true;

    const payload = request.data ?? ({} as SeedRequestPayload);
    const labId = payload.labId;
    const forceReseed = payload.forceReseed === true;

    if (typeof labId !== 'string' || labId.length === 0) {
      throw new HttpsError('invalid-argument', '`labId` é obrigatório.');
    }

    // forceReseed só superadmin (operação destrutiva — sobrescreve customizações).
    if (forceReseed && !isSuperAdmin) {
      throw new HttpsError(
        'permission-denied',
        'forceReseed exige super-admin.',
      );
    }

    if (!isSuperAdmin) {
      await assertActiveMemberOfLab(uid, labId);
    }

    // Subcoleção alvo — mantém paralelo ao client em bioquimicaService.ts.
    const analitosCol = db
      .collection('labs')
      .doc(labId)
      .collection('bioquimica')
      .doc('root')
      .collection('analitos');

    // ── Query analitos seed existentes (idempotência) ──────────────────────
    const existingSnap = await analitosCol.where('seedDefault', '==', true).get();
    const existingNames = new Set<string>();
    if (!forceReseed) {
      existingSnap.forEach((doc) => {
        const data = doc.data() as { nome?: string; deletadoEm?: Timestamp | null };
        // Considera doc "presente" mesmo se soft-deletado — não recria pra
        // não ressuscitar dado que o lab quis remover.
        if (typeof data.nome === 'string') existingNames.add(data.nome);
      });
    }

    // ── Decide o que criar ─────────────────────────────────────────────────
    const toCreate = SEED_ANALITOS.filter((a) => !existingNames.has(a.nome));
    const skipped = SEED_ANALITOS.length - toCreate.length;

    if (toCreate.length === 0) {
      return { created: 0, skipped, total: SEED_ANALITOS.length };
    }

    // ── Garante doc raiz `/labs/{labId}/bioquimica/root` ──────────────────
    const now = Timestamp.now();
    const rootRef = db
      .collection('labs')
      .doc(labId)
      .collection('bioquimica')
      .doc('root');

    const batch = db.batch();
    batch.set(
      rootRef,
      {
        labId,
        module: 'bioquimica',
        seededAt: now,
        seededBy: uid,
      },
      { merge: true },
    );

    for (const seed of toCreate) {
      const ref = analitosCol.doc();
      const docPayload: Record<string, unknown> = {
        labId,
        nome: seed.nome,
        unidade: seed.unidade,
        rangeBiologico: seed.rangeBiologico,
        ativo: seed.ativo,
        seedDefault: true,
        criadoEm: now,
        criadoPor: uid,
        deletadoEm: null,
      };
      if (seed.sigla !== undefined) docPayload.sigla = seed.sigla;
      if (seed.unidadeSI !== undefined) docPayload.unidadeSI = seed.unidadeSI;
      if (seed.metodo !== undefined) docPayload.metodo = seed.metodo;
      if (seed.cvAlvo !== undefined) docPayload.cvAlvo = seed.cvAlvo;
      batch.set(ref, docPayload);
    }

    await batch.commit();

    return {
      created: toCreate.length,
      skipped,
      total: SEED_ANALITOS.length,
    };
  },
);
