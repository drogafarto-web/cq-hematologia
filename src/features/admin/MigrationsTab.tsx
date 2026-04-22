/**
 * MigrationsTab — painel SuperAdmin para executar migrações one-time.
 *
 * Fase D (2026-04-21 — 2º turno). Dispara a Cloud Function
 * `triggerMigrateSetupsToEquipamentos` com dryRun primeiro e execução real
 * depois, exibindo o summary retornado.
 *
 * Segurança: a CF valida SuperAdmin no server-side. Este painel é só UX.
 */

import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase.config';

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

export function MigrationsTab() {
  const [migLoading, setMigLoading] = useState<'dry' | 'real' | null>(null);
  const [migResult, setMigResult] = useState<MigrationSummary | null>(null);
  const [migError, setMigError] = useState<string | null>(null);

  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupSummary | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  async function runMigration(dryRun: boolean) {
    setMigLoading(dryRun ? 'dry' : 'real');
    setMigError(null);
    setMigResult(null);
    try {
      const fn = httpsCallable<
        { labIds?: string[]; dryRun?: boolean },
        MigrationSummary
      >(functions, 'triggerMigrateSetupsToEquipamentos');
      const result = await fn({ dryRun });
      setMigResult(result.data);
    } catch (err) {
      setMigError(err instanceof Error ? err.message : 'Erro ao disparar migração.');
    } finally {
      setMigLoading(null);
    }
  }

  async function runCleanup() {
    const ok = window.confirm(
      'Rodar limpeza de equipamentos aposentados com retenção expirada?\n\n' +
        'Deleta docs de /equipamentos cuja retencaoAte < agora (>5 anos aposentados).\n' +
        'Audit trail em /equipamentos-audit é preservado.',
    );
    if (!ok) return;
    setCleanupLoading(true);
    setCleanupError(null);
    setCleanupResult(null);
    try {
      const fn = httpsCallable<Record<string, never>, CleanupSummary>(
        functions,
        'triggerCleanupEquipamentosExpirados',
      );
      const result = await fn({});
      setCleanupResult(result.data);
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : 'Erro no cleanup.');
    } finally {
      setCleanupLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Migration Fase D ───────────────────────────────────────────────── */}
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
            onClick={() => runMigration(true)}
            disabled={migLoading !== null}
            className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-white/80 disabled:opacity-50 transition-all"
          >
            {migLoading === 'dry' ? 'Simulando…' : 'Dry-run (só conta)'}
          </button>
          <button
            type="button"
            onClick={() => runMigration(false)}
            disabled={migLoading !== null}
            className="px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-all"
          >
            {migLoading === 'real' ? 'Migrando…' : 'Executar migração real'}
          </button>
        </div>

        {migError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300 mb-3">
            {migError}
          </div>
        )}

        {migResult && <MigrationResult summary={migResult} />}
      </section>

      {/* ── Cleanup manual (opcional) ──────────────────────────────────────── */}
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
          onClick={runCleanup}
          disabled={cleanupLoading}
          className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-white/80 disabled:opacity-50"
        >
          {cleanupLoading ? 'Limpando…' : 'Executar cleanup agora'}
        </button>

        {cleanupError && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            {cleanupError}
          </div>
        )}

        {cleanupResult && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
            <p>
              Elegíveis: <strong>{cleanupResult.totalElegiveis}</strong> · removidos:{' '}
              <strong>{cleanupResult.totalRemovidos}</strong> · erros:{' '}
              {cleanupResult.errors.length}
            </p>
            <p className="text-xs text-emerald-300/70 mt-1">
              {cleanupResult.durationMs}ms · {cleanupResult.triggeredAt}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub: MigrationResult ────────────────────────────────────────────────────

function MigrationResult({ summary }: { summary: MigrationSummary }) {
  const isDryRun = summary.totalEquipamentosCriados === 0 && summary.totalSetupsReescritos === 0;
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
