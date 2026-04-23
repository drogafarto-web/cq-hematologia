/**
 * MigrationsTab — painel SuperAdmin para executar migrações one-time e
 * operações administrativas sensíveis.
 *
 * Seções:
 *   1. Migração Fase D — Setups → Equipamentos
 *   2. Cleanup de equipamentos pós-retenção (RDC 786/2023 art. 42)
 *   3. Provisionamento de claims de módulos (Onda 2)
 *   4. SuperAdmin temporário — grant/revoke (período de testes)
 *
 * Segurança: todas as CFs validam SuperAdmin server-side. Este painel é só UX.
 */

import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase.config';

// ─── Tipos compartilhados ────────────────────────────────────────────────────

interface PerLabMigrationResult {
  labId: string;
  setupsVistos: number;
  equipamentosCriados: number;
  setupsReescritos: number;
  setupsJaMigrados: number;
  erros: string[];
}

interface MigrationSummary {
  triggeredAt: string;
  durationMs: number;
  totalLabs: number;
  totalSetupsVistos: number;
  totalEquipamentosCriados: number;
  totalSetupsReescritos: number;
  totalSetupsJaMigrados: number;
  porLab: PerLabMigrationResult[];
  erros: string[];
}

interface CleanupSummary {
  triggeredAt: string;
  source: string;
  totalElegiveis: number;
  totalRemovidos: number;
  errors: string[];
  durationMs: number;
}

interface ProvisionUserDiff {
  uid: string;
  email: string | null;
  labIds: string[];
  beforeModules: Record<string, unknown> | null;
  afterModules: Record<string, boolean>;
  changed: boolean;
  reason: 'new-claim' | 'updated' | 'unchanged' | 'no-labs-skipped';
}

interface ProvisionReport {
  dryRun: boolean;
  scanned: number;
  updated: number;
  unchanged: number;
  skipped: number;
  diffs: ProvisionUserDiff[];
  auditLogId: string | null;
}

interface GrantUserDiff {
  uid: string;
  email: string | null;
  wasSuperAdminBefore: boolean;
  willPromote: boolean;
}

interface GrantReport {
  dryRun: boolean;
  grantId: string;
  scanned: number;
  toPromote: number;
  alreadySuperAdmin: number;
  diffs: GrantUserDiff[];
  appliedAt: string | null;
}

interface RevokeReport {
  dryRun: boolean;
  scanned: number;
  reverted: number;
  keptSuperAdmin: number;
  revokedUids: string[];
  appliedAt: string | null;
}

const GRANT_TOKEN = 'EU-ENTENDO-OS-RISCOS-LGPD';
const REVOKE_TOKEN = 'REVOGAR';

// ─── MigrationsTab ───────────────────────────────────────────────────────────

export function MigrationsTab() {
  return (
    <div className="space-y-8">
      <FaseDMigrationSection />
      <CleanupSection />
      <ProvisionClaimsSection />
      <TemporarySuperAdminSection />
    </div>
  );
}

// ─── Seção 1 — Migração Fase D ───────────────────────────────────────────────

function FaseDMigrationSection() {
  const [loading, setLoading] = useState<'dry' | 'real' | null>(null);
  const [result, setResult] = useState<MigrationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setLoading(dryRun ? 'dry' : 'real');
    setError(null);
    setResult(null);
    try {
      const fn = httpsCallable<
        { labIds?: string[]; dryRun?: boolean },
        MigrationSummary
      >(functions, 'triggerMigrateSetupsToEquipamentos');
      const res = await fn({ dryRun });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao disparar migração.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6">
      <header className="mb-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-violet-400/80">
          Migração one-time · Fase D
        </p>
        <h3 className="text-base font-semibold text-white/90 mt-0.5">
          Setups legados → Equipamentos
        </h3>
        <p className="text-xs text-white/55 mt-1 leading-relaxed max-w-2xl">
          Para cada setup pré-Fase D (docId = módulo), cria um Equipamento correspondente
          usando o catálogo default (Yumizen H550, Clotimer Duo, etc) e reescreve o setup
          com docId = equipamentoId. Idempotente — rerun safe. Recomendado: rodar{' '}
          <strong>dry-run</strong> primeiro para conferir volume.
        </p>
      </header>

      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => run(true)}
          disabled={loading !== null}
          className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-white/80 disabled:opacity-50 transition-all"
        >
          {loading === 'dry' ? 'Simulando…' : 'Dry-run (só conta)'}
        </button>
        <button
          type="button"
          onClick={() => run(false)}
          disabled={loading !== null}
          className="px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-all"
        >
          {loading === 'real' ? 'Migrando…' : 'Executar migração real'}
        </button>
      </div>

      {error && <ErrorBox message={error} />}
      {result && <MigrationResult summary={result} />}
    </section>
  );
}

// ─── Seção 2 — Cleanup ──────────────────────────────────────────────────────

function CleanupSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const ok = window.confirm(
      'Rodar limpeza de equipamentos aposentados com retenção expirada?\n\n' +
        'Deleta docs de /equipamentos cuja retencaoAte < agora (>5 anos aposentados).\n' +
        'Audit trail em /equipamentos-audit é preservado.',
    );
    if (!ok) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fn = httpsCallable<Record<string, never>, CleanupSummary>(
        functions,
        'triggerCleanupEquipamentosExpirados',
      );
      const res = await fn({});
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no cleanup.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6">
      <header className="mb-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-400/80">
          Limpeza pós-retenção · RDC 786/2023 art. 42
        </p>
        <h3 className="text-base font-semibold text-white/90 mt-0.5">
          Remover equipamentos aposentados &gt; 5 anos
        </h3>
        <p className="text-xs text-white/55 mt-1 leading-relaxed max-w-2xl">
          Normalmente roda automaticamente (03:45 BRT diariamente). Trigger manual
          disponível se precisar forçar. Audit trail em /equipamentos-audit é preservado
          pós-cleanup.
        </p>
      </header>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-white/80 disabled:opacity-50"
      >
        {loading ? 'Limpando…' : 'Executar cleanup agora'}
      </button>

      {error && <div className="mt-3"><ErrorBox message={error} /></div>}

      {result && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
          <p>
            Elegíveis: <strong>{result.totalElegiveis}</strong> · removidos:{' '}
            <strong>{result.totalRemovidos}</strong> · erros: {result.errors.length}
          </p>
          <p className="text-xs text-emerald-300/70 mt-1">
            {result.durationMs}ms · {result.triggeredAt}
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Seção 3 — Provisionamento de claims ─────────────────────────────────────

function ProvisionClaimsSection() {
  const [loading, setLoading] = useState<'dry' | 'real' | null>(null);
  const [result, setResult] = useState<ProvisionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (!dryRun) {
      const ok = window.confirm(
        'Provisionar claim de módulos para TODOS os usuários cadastrados?\n\n' +
          'Esta operação é idempotente — só escreve em usuários sem a claim correta.\n' +
          'Recomendação: rode dry-run antes para inspecionar o diff.',
      );
      if (!ok) return;
    }

    setLoading(dryRun ? 'dry' : 'real');
    setError(null);
    setResult(null);
    try {
      const fn = httpsCallable<
        { dryRun: boolean; labId?: string; targetUid?: string },
        ProvisionReport
      >(functions, 'provisionModulesClaims');
      const res = await fn({ dryRun });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao provisionar claims.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6">
      <header className="mb-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-sky-400/80">
          Onda 2 · Provisioning de claims
        </p>
        <h3 className="text-base font-semibold text-white/90 mt-0.5">
          Claim de módulos para todos os usuários
        </h3>
        <p className="text-xs text-white/55 mt-1 leading-relaxed max-w-2xl">
          Varre todos os usuários e grava <code className="text-sky-300">modules</code> no custom
          claim baseado nas memberships de lab. Idempotente — reexecuções só atualizam quem
          mudou de estado. Pré-requisito obrigatório para aplicar{' '}
          <code className="text-sky-300">firestore.rules.post-onda2</code> (strict mode).
        </p>
      </header>

      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => run(true)}
          disabled={loading !== null}
          className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-white/80 disabled:opacity-50 transition-all"
        >
          {loading === 'dry' ? 'Simulando…' : 'Dry-run (inspeciona diff)'}
        </button>
        <button
          type="button"
          onClick={() => run(false)}
          disabled={loading !== null}
          className="px-4 h-10 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium disabled:opacity-50 transition-all"
        >
          {loading === 'real' ? 'Provisionando…' : 'Aplicar'}
        </button>
      </div>

      {error && <ErrorBox message={error} />}
      {result && <ProvisionResult report={result} />}
    </section>
  );
}

// ─── Seção 4 — SuperAdmin temporário ─────────────────────────────────────────

function TemporarySuperAdminSection() {
  const [grantLoading, setGrantLoading] = useState<'dry' | 'real' | null>(null);
  const [grantResult, setGrantResult] = useState<GrantReport | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const [revokeLoading, setRevokeLoading] = useState<'dry' | 'real' | null>(null);
  const [revokeResult, setRevokeResult] = useState<RevokeReport | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function runGrant(dryRun: boolean) {
    if (!dryRun) {
      if (reason.trim().length < 20) {
        setGrantError('Reason obrigatória com ≥ 20 caracteres.');
        return;
      }
      const confirmed = window.prompt(
        `ATENÇÃO — promoção em massa a SuperAdmin.\n\n` +
          `Para confirmar, digite exatamente:\n${GRANT_TOKEN}`,
      );
      if (confirmed !== GRANT_TOKEN) {
        setGrantError('Token de confirmação não confere. Operação cancelada.');
        return;
      }
    }

    setGrantLoading(dryRun ? 'dry' : 'real');
    setGrantError(null);
    setGrantResult(null);
    try {
      const fn = httpsCallable<
        { dryRun: boolean; confirmationToken?: string; reason?: string },
        GrantReport
      >(functions, 'grantTemporarySuperAdminToAll');
      const payload: { dryRun: boolean; confirmationToken?: string; reason?: string } =
        { dryRun };
      if (!dryRun) {
        payload.confirmationToken = GRANT_TOKEN;
        payload.reason = reason.trim();
      }
      const res = await fn(payload);
      setGrantResult(res.data);
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Erro ao conceder SuperAdmin.');
    } finally {
      setGrantLoading(null);
    }
  }

  async function runRevoke(dryRun: boolean) {
    if (!dryRun) {
      const confirmed = window.prompt(
        `Revogar SuperAdmin temporário de todos os usuários promovidos?\n\n` +
          `SuperAdmins legítimos preexistentes NÃO são afetados.\n` +
          `Para confirmar, digite exatamente:\n${REVOKE_TOKEN}`,
      );
      if (confirmed !== REVOKE_TOKEN) {
        setRevokeError('Token de confirmação não confere. Operação cancelada.');
        return;
      }
    }

    setRevokeLoading(dryRun ? 'dry' : 'real');
    setRevokeError(null);
    setRevokeResult(null);
    try {
      const fn = httpsCallable<
        { dryRun: boolean; confirmationToken?: string },
        RevokeReport
      >(functions, 'revokeTemporarySuperAdmin');
      const payload: { dryRun: boolean; confirmationToken?: string } = { dryRun };
      if (!dryRun) payload.confirmationToken = REVOKE_TOKEN;
      const res = await fn(payload);
      setRevokeResult(res.data);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Erro ao revogar SuperAdmin.');
    } finally {
      setRevokeLoading(null);
    }
  }

  return (
    <section className="rounded-2xl bg-red-500/[0.04] border border-red-500/30 p-6">
      <header className="mb-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-red-400">
          ⚠ Operação crítica · Período de testes
        </p>
        <h3 className="text-base font-semibold text-white/95 mt-0.5">
          SuperAdmin temporário para todos os usuários
        </h3>
        <p className="text-xs text-white/60 mt-1 leading-relaxed max-w-2xl">
          Promove todos os usuários cadastrados a SuperAdmin mantendo snapshot reversível em{' '}
          <code className="text-red-300">temp/superadmin-grant/snapshots</code>. O revoke usa o
          snapshot como fonte da verdade — SuperAdmins legítimos preexistentes não são
          rebaixados.{' '}
          <strong className="text-red-300">
            Use apenas durante o período de testes declarado.
          </strong>{' '}
          Revogar ao final.
        </p>

        <div className="mt-3 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/30 text-xs text-red-200 leading-relaxed">
          <p className="font-semibold mb-1">Riscos enquanto vigente:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Acesso cross-lab irrestrito a todos os dados</li>
            <li>Qualquer user pode executar `deleteUser`, `setUserSuperAdmin`, etc</li>
            <li>LGPD: princípio de minimização suspenso — documentar em audit</li>
            <li>RDC 978/2025: trilha do período + reason é mandatória</li>
          </ul>
        </div>
      </header>

      {/* ── Grant ─────────────────────────────────────────────────── */}
      <div className="mt-6 space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-red-300/90">
          Conceder
        </p>

        <label className="block">
          <span className="text-xs text-white/70 font-medium">
            Razão do período de testes (≥ 20 caracteres, registrada em audit)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex: Período de testes pré-lançamento 2026-04-22 a 2026-05-05 com equipe de QA interna"
            rows={2}
            className="mt-1 w-full rounded-xl bg-black/30 border border-white/[0.1] px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-red-500/50 focus:outline-none"
          />
          <span className="text-[10px] text-white/40">
            {reason.trim().length} / 20 caracteres mínimos
          </span>
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => runGrant(true)}
            disabled={grantLoading !== null}
            className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-white/80 disabled:opacity-50"
          >
            {grantLoading === 'dry' ? 'Simulando…' : 'Dry-run grant'}
          </button>
          <button
            type="button"
            onClick={() => runGrant(false)}
            disabled={grantLoading !== null || reason.trim().length < 20}
            className="px-4 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {grantLoading === 'real' ? 'Promovendo…' : 'Conceder SuperAdmin a todos'}
          </button>
        </div>

        {grantError && <ErrorBox message={grantError} />}
        {grantResult && <GrantResultCard report={grantResult} />}
      </div>

      {/* ── Revoke ────────────────────────────────────────────────── */}
      <div className="mt-6 pt-5 border-t border-red-500/20 space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300/90">
          Revogar ao final do período
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => runRevoke(true)}
            disabled={revokeLoading !== null}
            className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-white/80 disabled:opacity-50"
          >
            {revokeLoading === 'dry' ? 'Simulando…' : 'Dry-run revoke'}
          </button>
          <button
            type="button"
            onClick={() => runRevoke(false)}
            disabled={revokeLoading !== null}
            className="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {revokeLoading === 'real' ? 'Revogando…' : 'Revogar SuperAdmin temporário'}
          </button>
        </div>

        {revokeError && <ErrorBox message={revokeError} />}
        {revokeResult && <RevokeResultCard report={revokeResult} />}
      </div>
    </section>
  );
}

// ─── Resultados ──────────────────────────────────────────────────────────────

function MigrationResult({ summary }: { summary: MigrationSummary }) {
  const isDryRun =
    summary.totalEquipamentosCriados === 0 && summary.totalSetupsReescritos === 0;
  return (
    <div
      className={`p-4 rounded-xl border ${
        summary.erros.length > 0
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-emerald-500/10 border-emerald-500/30'
      }`}
    >
      <p className="text-sm font-semibold text-white/90">
        {isDryRun ? 'Simulação concluída' : 'Migração executada'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
        <Metric label="Labs varridos" value={summary.totalLabs} />
        <Metric label="Setups vistos" value={summary.totalSetupsVistos} />
        <Metric
          label={isDryRun ? 'Seriam migrados' : 'Equipamentos criados'}
          value={summary.totalEquipamentosCriados}
          accent="text-violet-300"
        />
        <Metric label="Já migrados" value={summary.totalSetupsJaMigrados} accent="text-white/50" />
      </div>

      <p className="text-[11px] text-white/50 mt-3">
        Duração: {summary.durationMs}ms · {summary.triggeredAt}
      </p>

      {summary.erros.length > 0 && (
        <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          <strong>{summary.erros.length} erro(s) global(is):</strong>
          <ul className="mt-1 space-y-0.5">
            {summary.erros.slice(0, 5).map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.porLab.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs font-medium text-white/70 cursor-pointer hover:text-white/90">
            Detalhes por lab ({summary.porLab.length})
          </summary>
          <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {summary.porLab.map((l) => (
              <li
                key={l.labId}
                className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px]"
              >
                <p className="font-medium text-white/80">{l.labId}</p>
                <p className="text-white/50 mt-0.5">
                  Vistos: {l.setupsVistos} · Criados: {l.equipamentosCriados} · Reescritos:{' '}
                  {l.setupsReescritos} · Já migrados: {l.setupsJaMigrados}
                  {l.erros.length > 0 && ` · ${l.erros.length} erro(s)`}
                </p>
                {l.erros.length > 0 && (
                  <ul className="mt-1 text-red-300/80">
                    {l.erros.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ProvisionResult({ report }: { report: ProvisionReport }) {
  const changedDiffs = report.diffs.filter((d) => d.changed);
  const skippedDiffs = report.diffs.filter((d) => d.reason === 'no-labs-skipped');
  return (
    <div className="p-4 rounded-xl border bg-sky-500/10 border-sky-500/30">
      <p className="text-sm font-semibold text-white/90">
        {report.dryRun ? 'Dry-run de provisioning' : 'Claims provisionadas'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
        <Metric label="Usuários varridos" value={report.scanned} />
        <Metric
          label={report.dryRun ? 'Seriam atualizados' : 'Atualizados'}
          value={report.updated}
          accent="text-sky-300"
        />
        <Metric label="Sem mudança" value={report.unchanged} accent="text-white/50" />
        <Metric
          label="Pulados (sem lab)"
          value={report.skipped}
          accent="text-white/40"
        />
      </div>

      {changedDiffs.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs font-medium text-white/70 cursor-pointer hover:text-white/90">
            Usuários com diff ({changedDiffs.length})
          </summary>
          <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {changedDiffs.slice(0, 50).map((d) => (
              <li
                key={d.uid}
                className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px]"
              >
                <p className="font-medium text-white/80">
                  {d.email ?? d.uid}
                  <span className="ml-2 text-[9px] uppercase tracking-wider text-sky-400/80">
                    {d.reason}
                  </span>
                </p>
                <p className="text-white/50 mt-0.5">
                  Labs: {d.labIds.length === 0 ? '—' : d.labIds.join(', ')}
                </p>
              </li>
            ))}
            {changedDiffs.length > 50 && (
              <li className="text-[10px] text-white/40 text-center py-2">
                + {changedDiffs.length - 50} outros
              </li>
            )}
          </ul>
        </details>
      )}

      {skippedDiffs.length > 0 && (
        <p className="text-[11px] text-white/40 mt-2">
          {skippedDiffs.length} usuário(s) sem lab cadastrado — pulados.
        </p>
      )}

      {report.auditLogId && (
        <p className="text-[10px] text-white/40 mt-2 font-mono">
          auditLogId: {report.auditLogId}
        </p>
      )}
    </div>
  );
}

function GrantResultCard({ report }: { report: GrantReport }) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        report.dryRun
          ? 'bg-white/[0.04] border-white/[0.1]'
          : 'bg-red-500/10 border-red-500/40'
      }`}
    >
      <p className="text-sm font-semibold text-white/95">
        {report.dryRun ? 'Dry-run grant' : '⚠ SuperAdmin concedido em massa'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
        <Metric label="Usuários varridos" value={report.scanned} />
        <Metric
          label={report.dryRun ? 'Seriam promovidos' : 'Promovidos'}
          value={report.toPromote}
          accent="text-red-300"
        />
        <Metric
          label="Já SuperAdmin"
          value={report.alreadySuperAdmin}
          accent="text-white/50"
        />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
            Grant ID
          </p>
          <p className="text-[11px] font-mono text-white/70 mt-0.5 truncate" title={report.grantId}>
            {report.grantId}
          </p>
        </div>
      </div>

      {report.appliedAt && (
        <p className="text-[11px] text-red-300/80 mt-2">
          Aplicado em {report.appliedAt}. Snapshot salvo em{' '}
          <code className="text-red-300">temp/superadmin-grant/snapshots</code>.{' '}
          <strong>Lembrar de revogar ao final do período.</strong>
        </p>
      )}

      {report.diffs.length > 0 && report.dryRun && (
        <details className="mt-3">
          <summary className="text-xs font-medium text-white/70 cursor-pointer hover:text-white/90">
            Usuários que seriam promovidos ({report.toPromote})
          </summary>
          <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {report.diffs
              .filter((d) => d.willPromote)
              .slice(0, 100)
              .map((d) => (
                <li
                  key={d.uid}
                  className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px]"
                >
                  <p className="font-medium text-white/80">{d.email ?? d.uid}</p>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RevokeResultCard({ report }: { report: RevokeReport }) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        report.dryRun
          ? 'bg-white/[0.04] border-white/[0.1]'
          : 'bg-emerald-500/10 border-emerald-500/40'
      }`}
    >
      <p className="text-sm font-semibold text-white/95">
        {report.dryRun ? 'Dry-run revoke' : 'SuperAdmin temporário revogado'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-xs">
        <Metric label="Entradas no snapshot" value={report.scanned} />
        <Metric
          label={report.dryRun ? 'Seriam revogados' : 'Revogados'}
          value={report.reverted}
          accent="text-emerald-300"
        />
        <Metric
          label="Mantidos (legítimos)"
          value={report.keptSuperAdmin}
          accent="text-white/50"
        />
      </div>

      {report.appliedAt && (
        <p className="text-[11px] text-emerald-300/80 mt-2">
          Revogado em {report.appliedAt}.
        </p>
      )}

      {report.revokedUids.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs font-medium text-white/70 cursor-pointer hover:text-white/90">
            UIDs afetados ({report.revokedUids.length})
          </summary>
          <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto font-mono text-[10px] text-white/60">
            {report.revokedUids.slice(0, 100).map((uid) => (
              <li key={uid}>{uid}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── Helpers compartilhados ──────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
      {message}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${accent ?? 'text-white/90'}`}>{value}</p>
    </div>
  );
}
