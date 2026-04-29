/**
 * PreFlightCheck — pre-flight visual antes da captura.
 *
 * Mostra ao operador o que está em uso AGORA (3 controles + reagentes do
 * equipamento) com lote, data de inclusão e validade. Sinaliza pendências
 * (controles faltando, reagentes vencidos, mínimo não atingido) ANTES da
 * foto, com atalho pra resolver. Hoje a validação só acontece pós-captura
 * no ReviewRunModal — antecipar evita o operador descobrir tarde que falta
 * algo e ter que descartar a foto.
 *
 * Não bloqueia. O operador pode prosseguir mesmo com pendências e usar o
 * fluxo de override existente — só fica ciente antes.
 */

import React from 'react';
import { useLots } from '../../lots/hooks/useLots';
import { useInsumos } from '../../insumos/hooks/useInsumos';
import type { ControlLot } from '../../../types';
import type { Insumo, InsumoModulo } from '../../insumos/types/Insumo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bulaKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function diasAteVencer(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

interface ControlSummary {
  level: 1 | 2 | 3;
  lot: ControlLot | null;
}

interface ReagentSummary {
  insumo: Insumo;
  diasValidade: number;
  expired: boolean;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
      <path
        d="M5 8.5l2 2 4-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarnCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
      <path
        d="M8 4.5v4M8 11.2v.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Módulo da corrida (default 'hematologia'). */
  modulo?: InsumoModulo;
  /** ID do equipamento (filtra reagentes vinculados). */
  equipamentoId?: string;
  /** Mínimo esperado de controles na bula corrente (3 pra Controllab). */
  expectedControls?: 1 | 2 | 3;
  /** Mínimo esperado de reagentes ativos no equipamento (3 ABX no Yumizen). */
  expectedReagents?: number;
  /** Callback pra abrir cadastro de novo lote (resolução rápida). */
  onAddLote?: () => void;
}

export function PreFlightCheck({
  modulo = 'hematologia',
  equipamentoId,
  expectedControls = 3,
  expectedReagents = 3,
  onAddLote,
}: Props) {
  const { lots } = useLots();

  // Reagentes ativos do módulo, filtrados por equipamento se informado.
  const { insumos: reagentesAtivos } = useInsumos({
    tipo: 'reagente',
    status: 'ativo',
    modulo,
  });

  // ── Controles em uso (bula corrente, não-vencidos, não retirados) ─────────
  const now = Date.now();
  const vigentes = lots.filter(
    (l) => l.expiryDate.getTime() >= now && l.manualHidden !== true,
  );

  // Bula corrente = startDate mais recente <= agora.
  let bulaCorrente: string | null = null;
  let bestStart = -Infinity;
  for (const l of vigentes) {
    const ts = l.startDate.getTime();
    if (ts <= now && ts > bestStart) {
      bestStart = ts;
      bulaCorrente = bulaKey(l.startDate);
    }
  }
  if (!bulaCorrente && vigentes.length > 0) {
    bestStart = -Infinity;
    for (const l of vigentes) {
      const ts = l.startDate.getTime();
      if (ts > bestStart) {
        bestStart = ts;
        bulaCorrente = bulaKey(l.startDate);
      }
    }
  }
  const lotsBulaCorrente = vigentes.filter((l) => bulaKey(l.startDate) === bulaCorrente);

  const controls: ControlSummary[] = ([1, 2, 3] as const)
    .slice(0, expectedControls)
    .map((level) => ({
      level,
      lot: lotsBulaCorrente.find((l) => l.level === level) ?? null,
    }));

  const controlsOK = controls.every((c) => c.lot !== null);
  const controlsMissing = controls.filter((c) => c.lot === null);

  // ── Reagentes ativos do equipamento ───────────────────────────────────────
  // useInsumos retorna union (Insumo) — narrow pra reagente antes de acessar
  // equipamentoId, que só existe em InsumoReagente/InsumoTiraUro.
  const reagentesDoEquip = equipamentoId
    ? reagentesAtivos.filter((r) => {
        if (r.tipo !== 'reagente' && r.tipo !== 'tira-uro') return false;
        const eqId = r.equipamentoId;
        return !eqId || eqId === equipamentoId;
      })
    : reagentesAtivos;

  const reagents: ReagentSummary[] = reagentesDoEquip.map((insumo) => {
    const validade = insumo.validadeReal.toDate();
    const dias = diasAteVencer(validade);
    return { insumo, diasValidade: dias, expired: dias < 0 };
  });

  const reagentsExpired = reagents.filter((r) => r.expired);
  const reagentsCount = reagents.length;
  const reagentsCountOK = reagentsCount >= expectedReagents;
  const reagentsOK = reagentsCountOK && reagentsExpired.length === 0;

  const allOK = controlsOK && reagentsOK;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`mb-5 rounded-2xl border shadow-sm dark:shadow-none overflow-hidden ${
        allOK
          ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.04] border-emerald-200 dark:border-emerald-500/20'
          : 'bg-amber-50/40 dark:bg-amber-500/[0.04] border-amber-200 dark:border-amber-500/25'
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-2.5 border-b flex items-center gap-2 ${
          allOK
            ? 'border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            : 'border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-300'
        }`}
      >
        {allOK ? <CheckCircle /> : <WarnCircle />}
        <span className="text-xs font-semibold uppercase tracking-wider">
          {allOK ? 'Tudo pronto pra rodar' : 'Pendências antes da captura'}
        </span>
        {!allOK && onAddLote && (
          <button
            type="button"
            onClick={onAddLote}
            className="ml-auto text-[11px] font-semibold px-3 h-7 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            + Cadastrar lote
          </button>
        )}
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Coluna Controles */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              Controles em uso
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {controls.filter((c) => c.lot).length} de {expectedControls}
            </span>
          </div>
          <ul className="space-y-1">
            {controls.map(({ level, lot }) => (
              <li
                key={level}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                  lot
                    ? 'bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]'
                    : 'bg-amber-100/50 dark:bg-amber-500/[0.08] border border-amber-300/60 dark:border-amber-500/30'
                }`}
              >
                <span
                  className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    level === 1
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                      : level === 2
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  NV{level}
                </span>
                {lot ? (
                  <>
                    <span className="font-mono text-[11px] text-slate-700 dark:text-white/80 truncate">
                      {lot.lotNumber}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                      desde {fmtDate(lot.startDate)}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
                    Não cadastrado
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Coluna Reagentes */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              Reagentes em uso
            </span>
            <span
              className={`text-[10px] ${reagentsCountOK ? 'text-slate-400 dark:text-slate-500' : 'text-amber-700 dark:text-amber-400 font-semibold'}`}
            >
              {reagentsCount} de {expectedReagents}
            </span>
          </div>
          {reagents.length === 0 ? (
            <div className="px-2.5 py-3 rounded-lg bg-amber-100/50 dark:bg-amber-500/[0.08] border border-amber-300/60 dark:border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-200">
              Nenhum reagente ativo cadastrado pra este equipamento.
            </div>
          ) : (
            <ul className="space-y-1">
              {reagents.map(({ insumo, diasValidade, expired }) => (
                <li
                  key={insumo.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                    expired
                      ? 'bg-red-100/50 dark:bg-red-500/[0.08] border border-red-300/60 dark:border-red-500/30'
                      : diasValidade <= 15
                        ? 'bg-amber-50 dark:bg-amber-500/[0.05] border border-amber-200 dark:border-amber-500/20'
                        : 'bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]'
                  }`}
                >
                  <span className="font-medium text-slate-700 dark:text-white/85 truncate flex-1 min-w-0">
                    {insumo.nomeComercial}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    {insumo.lote}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-medium ${
                      expired
                        ? 'text-red-700 dark:text-red-300'
                        : diasValidade <= 15
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {expired ? `Venc. ${Math.abs(diasValidade)}d` : `${diasValidade}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pendências resumidas */}
      {!allOK && (
        <div className="px-4 py-2.5 border-t border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/[0.06]">
          <ul className="text-[11px] text-amber-800 dark:text-amber-200 space-y-0.5">
            {controlsMissing.length > 0 && (
              <li>
                ▸ Faltam {controlsMissing.length} controle(s):{' '}
                {controlsMissing.map((c) => `NV${c.level}`).join(', ')}
              </li>
            )}
            {!reagentsCountOK && reagents.length > 0 && (
              <li>
                ▸ Mínimo de {expectedReagents} reagentes ativos não atingido (atual:{' '}
                {reagentsCount})
              </li>
            )}
            {reagentsExpired.length > 0 && (
              <li>
                ▸ {reagentsExpired.length} reagente(s) vencido(s):{' '}
                {reagentsExpired.map((r) => r.insumo.nomeComercial).join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
