import React, { useState, useMemo } from 'react';
import { useTraceability } from './hooks/useTraceability';
import { UNIDADES, DEFAULT_EQUIPMENT_ID, DEFAULT_EQUIPMENT_LABEL } from './constants';
import { ManualEventModal } from './components/ManualEventModal';
import type { TraceabilityEvent, TraceabilityEventType } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function ReagentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M9 3h6M10 3v5L5 19a2 2 0 002 2h10a2 2 0 002-2L14 8V3" />
    </svg>
  );
}

function ControlIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M3 12l4 4 14-14" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7" />
    </svg>
  );
}

function CalibrationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function MaintenanceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-3-.4-.4-3z" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<TraceabilityEventType, string> = {
  reagent_change: 'Reagente',
  control_run: 'Controle',
  calibration: 'Calibração',
  maintenance: 'Manutenção',
};

const TYPE_ICON: Record<TraceabilityEventType, React.ReactNode> = {
  reagent_change: <ReagentIcon />,
  control_run: <ControlIcon />,
  calibration: <CalibrationIcon />,
  maintenance: <MaintenanceIcon />,
};

// Tailwind v4 não resolve classes interpoladas dinamicamente — todas as
// classes precisam aparecer literais no source. Por isso o mapa explícito.
interface TypeStyles {
  iconWrap: string;
  pillText: string;
  pillBg: string;
  pillBorder: string;
}

const TYPE_STYLES: Record<TraceabilityEventType, TypeStyles> = {
  reagent_change: {
    iconWrap:
      'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200/60 dark:border-violet-500/20',
    pillText: 'text-violet-700 dark:text-violet-300',
    pillBg: 'bg-violet-50 dark:bg-violet-500/10',
    pillBorder: 'border-violet-200 dark:border-violet-500/20',
  },
  control_run: {
    iconWrap:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20',
    pillText: 'text-emerald-700 dark:text-emerald-300',
    pillBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    pillBorder: 'border-emerald-200 dark:border-emerald-500/20',
  },
  calibration: {
    iconWrap:
      'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200/60 dark:border-sky-500/20',
    pillText: 'text-sky-700 dark:text-sky-300',
    pillBg: 'bg-sky-50 dark:bg-sky-500/10',
    pillBorder: 'border-sky-200 dark:border-sky-500/20',
  },
  maintenance: {
    iconWrap:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20',
    pillText: 'text-amber-700 dark:text-amber-300',
    pillBg: 'bg-amber-50 dark:bg-amber-500/10',
    pillBorder: 'border-amber-200 dark:border-amber-500/20',
  },
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Slot card ────────────────────────────────────────────────────────────────

interface SlotCardProps {
  type: TraceabilityEventType;
  current: TraceabilityEvent | null;
  next: TraceabilityEvent | null;
  queryExamNum: number;
}

function SlotCard({ type, current, next, queryExamNum }: SlotCardProps) {
  const styles = TYPE_STYLES[type];
  const noData = !current;
  const rangeEnd = next ? `${next.examCodeNum - 1}` : '∞';

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center border ${styles.iconWrap}`}
        >
          {TYPE_ICON[type]}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          {TYPE_LABEL[type]}
        </span>
      </div>

      {noData ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
          Sem evento registrado anterior a {queryExamNum}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold text-slate-800 dark:text-white">
              {current.examCodeAtChange}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              início vigência
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Range:</span>
            <span className="font-mono">
              {current.examCodeAtChange} → {rangeEnd}
            </span>
          </div>

          {current.payload.note && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.05]">
              {current.payload.note}
            </p>
          )}

          <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            Registrado em {formatDate(current.timestamp)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function RastreabilidadeView() {
  const { events, isLoading, resolve } = useTraceability();

  const [examCode, setExamCode] = useState('');
  const [unidadeCode, setUnidadeCode] = useState(UNIDADES[0].code);
  const [submitted, setSubmitted] = useState<{ code: string; unidade: string } | null>(null);
  const [tab, setTab] = useState<'consulta' | 'historico'>('consulta');
  const [showManual, setShowManual] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<TraceabilityEventType | 'all'>(
    'all',
  );
  const [historyUnidadeFilter, setHistoryUnidadeFilter] = useState<string>('all');

  const snapshot = useMemo(() => {
    if (!submitted) return null;
    return resolve(submitted.unidade, DEFAULT_EQUIPMENT_ID, submitted.code);
  }, [submitted, resolve]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = examCode.replace(/\D/g, '');
    if (!cleaned) return;
    setSubmitted({ code: cleaned, unidade: unidadeCode });
  }

  const totalEvents = events.length;
  const eventsForUnidade = useMemo(
    () =>
      events.filter(
        (e) => e.unidadeCode === unidadeCode && e.equipmentId === DEFAULT_EQUIPMENT_ID,
      ).length,
    [events, unidadeCode],
  );

  // History list (filtered + sorted desc by examCodeNum)
  const historyEvents = useMemo(() => {
    return events.filter((e) => {
      if (historyTypeFilter !== 'all' && e.type !== historyTypeFilter) return false;
      if (historyUnidadeFilter !== 'all' && e.unidadeCode !== historyUnidadeFilter) return false;
      return true;
    });
  }, [events, historyTypeFilter, historyUnidadeFilter]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Rastreabilidade
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Consulte qual reagente, controle e equipamento estavam vigentes em um
            determinado código de atendimento — auditoria ISO 15189:2022 cláusula 7.4.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-500/20 transition-all"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Registrar evento manual
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={() => setTab('consulta')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'consulta'
              ? 'border-blue-600 text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white/80'
          }`}
        >
          Consulta
        </button>
        <button
          type="button"
          onClick={() => setTab('historico')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'historico'
              ? 'border-blue-600 text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white/80'
          }`}
        >
          Histórico de eventos
          <span className="ml-1.5 text-[11px] font-normal text-slate-400 dark:text-slate-500">
            ({events.length})
          </span>
        </button>
      </div>

      {tab === 'consulta' && (
        <>
      {/* Query form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm dark:shadow-none"
      >
        <div className="grid grid-cols-[1fr_180px_auto] gap-3 items-end">
          <div>
            <label
              htmlFor="exam-code"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Código de atendimento
            </label>
            <input
              id="exam-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="Ex: 0107028"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full h-11 px-3.5 font-mono text-base bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="unidade-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Unidade
            </label>
            <select
              id="unidade-select"
              value={unidadeCode}
              onChange={(e) => setUnidadeCode(e.target.value)}
              className="w-full h-11 px-3.5 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
            >
              {UNIDADES.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code} — {u.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!examCode.trim()}
            className="h-11 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-500/20"
          >
            <SearchIcon />
            Consultar
          </button>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
          {isLoading
            ? 'Carregando eventos…'
            : `${totalEvents} eventos no lab · ${eventsForUnidade} em ${unidadeCode} · ${DEFAULT_EQUIPMENT_LABEL}`}
        </p>
      </form>

      {/* Results */}
      {snapshot && (
        <section>
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="text-base font-semibold text-slate-700 dark:text-white/80">
              Atendimento
            </h2>
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">
              {snapshot.queryExamCode}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              · {snapshot.unidadeCode} · {DEFAULT_EQUIPMENT_LABEL}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SlotCard
              type="reagent_change"
              current={snapshot.reagentChange}
              next={snapshot.nextReagentChange}
              queryExamNum={snapshot.queryExamNum}
            />
            <SlotCard
              type="control_run"
              current={snapshot.controlRun}
              next={snapshot.nextControlRun}
              queryExamNum={snapshot.queryExamNum}
            />
            <SlotCard
              type="calibration"
              current={snapshot.calibration}
              next={null}
              queryExamNum={snapshot.queryExamNum}
            />
            <SlotCard
              type="maintenance"
              current={snapshot.maintenance}
              next={null}
              queryExamNum={snapshot.queryExamNum}
            />
          </div>

          {!snapshot.reagentChange && !snapshot.controlRun && (
            <div className="mt-5 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              Nenhum evento de rastreabilidade foi registrado antes deste código
              em {snapshot.unidadeCode}. Cadastre eventos ao trocar reagente e
              ao aprovar controle para começar a construir a linha de rastreabilidade.
            </div>
          )}
        </section>
      )}
        </>
      )}

      {tab === 'historico' && (
        <section className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filtros:
            </span>
            <select
              value={historyTypeFilter}
              onChange={(e) =>
                setHistoryTypeFilter(e.target.value as TraceabilityEventType | 'all')
              }
              aria-label="Filtrar por tipo de evento"
              className="h-8 px-3 text-xs bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">Todos os tipos</option>
              <option value="reagent_change">Reagente</option>
              <option value="control_run">Controle</option>
              <option value="calibration">Calibração</option>
              <option value="maintenance">Manutenção</option>
            </select>
            <select
              value={historyUnidadeFilter}
              onChange={(e) => setHistoryUnidadeFilter(e.target.value)}
              aria-label="Filtrar por unidade"
              className="h-8 px-3 text-xs bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">Todas as unidades</option>
              {UNIDADES.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code}
                </option>
              ))}
            </select>
            <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
              {historyEvents.length} de {events.length} eventos
            </span>
          </div>

          {/* List */}
          {historyEvents.length === 0 ? (
            <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-10 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum evento registrado{events.length > 0 ? ' com esses filtros' : ' ainda'}.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="text-left px-4 py-2.5 font-semibold">Atendimento</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Unidade</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Tipo</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Data</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEvents.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-slate-100 dark:border-white/[0.04] last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800 dark:text-white">
                        {e.examCodeAtChange}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {e.unidadeCode}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${TYPE_STYLES[e.type].pillText} ${TYPE_STYLES[e.type].pillBg} ${TYPE_STYLES[e.type].pillBorder}`}
                        >
                          {TYPE_LABEL[e.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(e.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {e.payload.note ?? (
                          <span className="text-slate-400 dark:text-slate-500 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Manual event modal */}
      {showManual && (
        <ManualEventModal
          onClose={() => setShowManual(false)}
          defaultUnidade={tab === 'consulta' ? unidadeCode : undefined}
          defaultExamCode={tab === 'consulta' ? examCode : undefined}
        />
      )}
    </div>
  );
}
