/**
 * CEQDashboard — CQ Externo (Ensaios de Aptidão Externa)
 *
 * DICQ 4.5 · ISO 17043 · RDC 978/2025
 *
 * Shows participações ativas, resultados recentes com Z-score,
 * status de conformidade e NC automáticas geradas.
 */

import { useState } from 'react';
import { useCEQ } from '../hooks/useCEQ';
import { CEQParticipacaoForm } from './CEQParticipacaoForm';
import { CEQResultadoEntry } from './CEQResultadoEntry';
import type { CEQParticipacao, CEQAmostra, CEQResultado } from '../types/CEQ';

/* ─── Inline SVG icons ────────────────────────────────────────────────────── */

const Svg = ({ size = 20, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
    {children}
  </svg>
);

const ExchangeIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path
      d="M3 6.5h14M13.5 3.5l3 3-3 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 13.5H3M6.5 10.5l-3 3 3 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ZScoreIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6.5 7h7l-7 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const AlertIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M10 3l7.5 13h-15L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 8.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="14" r="0.9" fill="currentColor" />
  </Svg>
);

const CheckIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6.5 10.2l2.5 2.5L13.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const FlaskIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path
      d="M7.5 3h5M8 3v6.5L4 16.5h12L12 9.5V3"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M5.5 13h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5" />
  </Svg>
);

const PlusIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

const ChevronRightIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ChevronDownIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const XIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

/* ─── Z-Score Badge ───────────────────────────────────────────────────────── */

function ZScoreBadge({ interpretacao, zScore }: { interpretacao: CEQResultado['interpretacao']; zScore: number }) {
  const config = {
    satisfatoria: {
      label: 'Satisfatório',
      bg: 'bg-emerald-500/[0.12] border-emerald-500/25',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
    },
    questionavel: {
      label: 'Questionável',
      bg: 'bg-amber-500/[0.12] border-amber-500/25',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
    },
    insatisfatoria: {
      label: 'Insatisfatório',
      bg: 'bg-red-500/[0.12] border-red-500/25',
      text: 'text-red-400',
      dot: 'bg-red-400',
    },
  }[interpretacao];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
      {config.label} · Z {zScore >= 0 ? '+' : ''}{zScore.toFixed(2)}
    </span>
  );
}

/* ─── Status chip for amostra ─────────────────────────────────────────────── */

function AmostraStatusChip({ status }: { status: CEQAmostra['status'] }) {
  const config = {
    recebida: { label: 'Recebida', cls: 'text-sky-400 bg-sky-500/[0.08] border-sky-500/20' },
    em_analise: { label: 'Em análise', cls: 'text-violet-400 bg-violet-500/[0.08] border-violet-500/20' },
    resultado_lancado: { label: 'Resultado lançado', cls: 'text-amber-400 bg-amber-500/[0.08] border-amber-500/20' },
    processada: { label: 'Processada', cls: 'text-emerald-400 bg-emerald-500/[0.08] border-emerald-500/20' },
  }[status];

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${config.cls}`}>
      {config.label}
    </span>
  );
}

/* ─── Z-Score mini bar ────────────────────────────────────────────────────── */

function ZScoreBar({ zScore }: { zScore: number }) {
  const abs = Math.abs(zScore);
  // Map |Z| 0–4 to 0–100% (capped at 4 for display)
  const pct = Math.min((abs / 4) * 100, 100);
  const color =
    abs < 2 ? 'bg-emerald-400' : abs < 3 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2" aria-label={`Z-score ${zScore.toFixed(2)}`}>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {/* reference lines at 2/3 */}
      <span className="text-[10px] tabular-nums text-white/40 w-10 text-right">
        {zScore >= 0 ? '+' : ''}{zScore.toFixed(2)}
      </span>
    </div>
  );
}

/* ─── Stat card ───────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'violet' | 'emerald' | 'amber' | 'red' | 'teal';
}) {
  const dotColor = {
    violet: 'bg-violet-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    teal: 'bg-teal-400',
  }[accent ?? 'teal'];

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {accent && <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />}
        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-white/90">{value}</p>
      {sub && <p className="text-[11px] text-white/30">{sub}</p>}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

function EmptyParticipacoes({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-teal-500/[0.1] border border-teal-500/20 flex items-center justify-center mb-5 text-teal-400">
        <ExchangeIcon size={28} />
      </div>
      <h3 className="text-base font-semibold text-white/80 mb-1">
        Nenhuma participação registrada
      </h3>
      <p className="text-sm text-white/40 max-w-sm mb-6">
        Registre a participação do laboratório em um programa interlaboratorial
        (Controllab, BIPEA, PNCQ) para acompanhar Z-scores e conformidade.
      </p>
      <div className="flex flex-col items-center gap-2 text-xs text-white/25">
        <p>DICQ 4.5 · ISO 17043 · RDC 978/2025</p>
        <p>Z-score satisfatório: |Z| &lt; 2 · questionável: 2–3 · insatisfatório: ≥ 3</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium transition-colors"
      >
        <PlusIcon size={16} />
        Registrar participação
      </button>
    </div>
  );
}

/* ─── Modal wrapper ───────────────────────────────────────────────────────── */

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-[#141417] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors z-10"
        >
          <XIcon size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ─── CEQDashboard ────────────────────────────────────────────────────────── */

export function CEQDashboard() {
  const {
    participacoes,
    amostras,
    resultados,
    selectedParticipacao,
    selectedAmostra,
    loading,
    error,
    selectParticipacao,
    selectAmostra,
    criarParticipacao,
    receberAmostra,
    lancarResultado,
  } = useCEQ();

  const [showParticipacaoForm, setShowParticipacaoForm] = useState(false);
  const [showResultadoForm, setShowResultadoForm] = useState(false);
  const [expandedAmostra, setExpandedAmostra] = useState<string | null>(null);

  // Aggregate stats from all loaded resultados
  const totalResultados = resultados.length;
  const satisfatorios = resultados.filter((r) => r.interpretacao === 'satisfatoria').length;
  const questionaveis = resultados.filter((r) => r.interpretacao === 'questionavel').length;
  const insatisfatorios = resultados.filter((r) => r.interpretacao === 'insatisfatoria').length;

  const handleParticipacaoSubmit = async (input: Parameters<typeof criarParticipacao>[0]) => {
    await criarParticipacao(input);
    setShowParticipacaoForm(false);
  };

  const handleResultadoSubmit = async (input: Parameters<typeof lancarResultado>[0]) => {
    await lancarResultado(input);
    setShowResultadoForm(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-teal-400/80 mb-1.5">
              DICQ 4.5 · ISO 17043
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Controle de Qualidade Externo
            </h1>
            <p className="text-sm text-white/40 mt-1">
              Ensaios interlaboratoriais · Z-score · Conformidade
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowParticipacaoForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium transition-colors shrink-0"
          >
            <PlusIcon size={16} />
            Nova participação
          </button>
        </div>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {participacoes.length === 0 && !loading && (
          <EmptyParticipacoes onAdd={() => setShowParticipacaoForm(true)} />
        )}

        {/* ── Content (when there are participacoes) ───────────────────── */}
        {participacoes.length > 0 && (
          <>
            {/* Stat cards — scoped to selected amostra's results */}
            {selectedAmostra && totalResultados > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Resultados" value={totalResultados} accent="teal" />
                <StatCard
                  label="Satisfatórios"
                  value={satisfatorios}
                  sub={totalResultados ? `${Math.round((satisfatorios / totalResultados) * 100)}%` : undefined}
                  accent="emerald"
                />
                <StatCard label="Questionáveis" value={questionaveis} accent="amber" />
                <StatCard label="Insatisfatórios" value={insatisfatorios} sub={insatisfatorios > 0 ? 'NC gerada' : undefined} accent={insatisfatorios > 0 ? 'red' : 'teal'} />
              </div>
            )}

            {/* ── Main layout: participacoes list + detail ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

              {/* Participacoes list */}
              <aside className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3 px-1">
                  Participações ativas
                </p>

                {loading && participacoes.length === 0 ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  participacoes.map((p) => {
                    const isSelected = selectedParticipacao?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectParticipacao(isSelected ? null : p)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                          isSelected
                            ? 'bg-teal-500/[0.08] border-teal-500/30 shadow-[0_0_0_1px] shadow-teal-500/20'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-teal-300' : 'text-white/80'}`}>
                              {p.provedorNome}
                            </p>
                            <p className="text-[11px] text-white/40 mt-0.5 truncate">{p.esquema}</p>
                          </div>
                          <ChevronRightIcon
                            size={14}
                          />
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/35 capitalize">
                            {p.frequencia}
                          </span>
                          {p.ativo && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                              Ativo
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </aside>

              {/* Detail panel */}
              <div className="space-y-6">
                {!selectedParticipacao ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center border border-white/[0.05] rounded-2xl bg-white/[0.01]">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/25 mb-3">
                      <ExchangeIcon size={22} />
                    </div>
                    <p className="text-sm text-white/30">Selecione uma participação</p>
                  </div>
                ) : (
                  <>
                    {/* Participacao header */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-base font-semibold text-white/90">
                            {selectedParticipacao.provedorNome}
                          </h2>
                          <p className="text-sm text-white/45 mt-0.5">{selectedParticipacao.esquema}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-white/40 capitalize">
                            {selectedParticipacao.frequencia}
                          </span>
                          <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            Ativo
                          </span>
                        </div>
                      </div>

                      {selectedParticipacao.analitosParticipados.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-1.5 flex-wrap">
                          <p className="text-[10px] text-white/30 mr-1">Analitos:</p>
                          {selectedParticipacao.analitosParticipados.map((a) => (
                            <span
                              key={a}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-white/50 uppercase"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Amostras section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                          Amostras recebidas
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedParticipacao) return;
                            await receberAmostra({
                              ceqParticipacaoId: selectedParticipacao.id,
                              rodada: new Date().getMonth() + 1,
                              ano: new Date().getFullYear(),
                              dataRecepcao: new Date(),
                            });
                          }}
                          disabled={loading}
                          className="text-[11px] text-teal-400 hover:text-teal-300 disabled:opacity-40 flex items-center gap-1 transition-colors"
                        >
                          <PlusIcon size={12} />
                          Registrar amostra
                        </button>
                      </div>

                      {amostras.length === 0 ? (
                        <div className="flex flex-col items-center py-10 text-center border border-white/[0.05] rounded-xl bg-white/[0.01]">
                          <FlaskIcon size={24} />
                          <p className="text-sm text-white/30 mt-2">Nenhuma amostra registrada</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {amostras.map((a) => {
                            const isActive = selectedAmostra?.id === a.id;
                            const isExpanded = expandedAmostra === a.id;

                            return (
                              <div key={a.id} className={`rounded-xl border transition-all ${isActive ? 'border-teal-500/25 bg-teal-500/[0.05]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectAmostra(isActive ? null : a);
                                    setExpandedAmostra(isActive ? null : a.id);
                                  }}
                                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-teal-500/20 text-teal-400' : 'bg-white/[0.04] text-white/30'}`}>
                                      <FlaskIcon size={14} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-white/80">
                                        Rodada {a.rodada}/{a.ano}
                                      </p>
                                      <p className="text-[11px] text-white/35">
                                        {new Date(a.dataRecepcao).toLocaleDateString('pt-BR')}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <AmostraStatusChip status={a.status} />
                                    <ChevronDownIcon size={14} />
                                  </div>
                                </button>

                                {/* Resultados for this amostra */}
                                {isActive && (
                                  <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
                                        Resultados Z-score
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => setShowResultadoForm(true)}
                                        className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
                                      >
                                        <PlusIcon size={12} />
                                        Lançar resultado
                                      </button>
                                    </div>

                                    {resultados.length === 0 ? (
                                      <p className="text-[12px] text-white/25 py-2">
                                        Nenhum resultado lançado para esta amostra.
                                      </p>
                                    ) : (
                                      <div className="space-y-2.5">
                                        {resultados.map((r) => (
                                          <ResultadoRow key={r.id} resultado={r} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <Modal open={showParticipacaoForm} onClose={() => setShowParticipacaoForm(false)}>
        <div className="p-6">
          <h2 className="text-base font-semibold mb-1">Nova Participação</h2>
          <p className="text-xs text-white/40 mb-5">
            Registre o laboratório em um programa de ensaio de aptidão.
          </p>
          <CEQParticipacaoForm
            onSubmit={handleParticipacaoSubmit}
            loading={loading}
          />
        </div>
      </Modal>

      <Modal open={showResultadoForm && !!selectedAmostra} onClose={() => setShowResultadoForm(false)}>
        <div className="p-6">
          <h2 className="text-base font-semibold mb-1">Lançar Resultado</h2>
          {selectedAmostra && (
            <p className="text-xs text-white/40 mb-5">
              Amostra · Rodada {selectedAmostra.rodada}/{selectedAmostra.ano}
            </p>
          )}
          {selectedAmostra && (
            <CEQResultadoEntry
              amostra={selectedAmostra}
              onSubmit={handleResultadoSubmit}
              loading={loading}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ─── ResultadoRow ────────────────────────────────────────────────────────── */

function ResultadoRow({ resultado }: { resultado: CEQResultado }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        resultado.interpretacao === 'insatisfatoria'
          ? 'bg-red-500/[0.06] border-red-500/20'
          : resultado.interpretacao === 'questionavel'
            ? 'bg-amber-500/[0.06] border-amber-500/20'
            : 'bg-white/[0.02] border-white/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-sm font-medium text-white/85">{resultado.analyteName}</p>
          <p className="text-[10px] font-mono text-white/35 mt-0.5 uppercase">{resultado.analyteId}</p>
        </div>
        <ZScoreBadge interpretacao={resultado.interpretacao} zScore={resultado.zScore} />
      </div>

      <ZScoreBar zScore={resultado.zScore} />

      <div className="mt-2.5 flex items-center gap-4 text-[11px] text-white/35 tabular-nums">
        <span>Obtido: <span className="text-white/60">{resultado.valorObtido.toFixed(2)}</span></span>
        <span>Ref: <span className="text-white/60">{resultado.valorReferencia.toFixed(2)}</span></span>
        <span>DP: <span className="text-white/60">{resultado.desvioEstimado.toFixed(2)}</span></span>
        <span className="text-white/25">{resultado.unidade}</span>
      </div>

      {resultado.temNCGrave && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertIcon size={12} />
          NC automática gerada · Z-score insatisfatório
          {resultado.ncAutomaticaCriadaId && (
            <span className="font-mono text-red-400/70"> · {resultado.ncAutomaticaCriadaId.slice(0, 8)}</span>
          )}
        </div>
      )}
    </div>
  );
}
