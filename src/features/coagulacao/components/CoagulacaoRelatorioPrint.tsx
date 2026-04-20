import React, { useRef, useMemo } from 'react';
import { useReactToPrint }         from 'react-to-print';
import { useActiveLab, useUser }   from '../../../store/useAuthStore';
import { COAG_ANALYTES }           from '../CoagAnalyteConfig';
import type { CoagulacaoLot, CoagulacaoRun } from '../types/Coagulacao';
import type { CoagLotStatus } from '../types/_shared_refs';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CoagulacaoRelatorioPrintProps {
  lot:       CoagulacaoLot;
  runs:      CoagulacaoRun[];
  lotStatus: CoagLotStatus;
  onClose:   () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtTs(ts: import('firebase/firestore').Timestamp | null | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function formatNotivisaCell(run: CoagulacaoRun): string {
  if (run.conformidade === 'A') return '—';
  if (run.notivisaStatus === 'notificado') {
    return `✓ Protocolo ${run.notivisaProtocolo ?? '—'} (${fmtDate(run.notivisaDataEnvio)})`;
  }
  if (run.notivisaStatus === 'dispensado') {
    return `Dispensado — ${run.notivisaJustificativa ?? 'sem justificativa'}`;
  }
  return 'PENDENTE — notificação não registrada';
}

function auditCode(labId: string, lotId: string): string {
  const seed = `${labId}-${lotId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `COAG-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

const STATUS_LABELS: Record<CoagLotStatus, string> = {
  sem_dados:  'Sem dados',
  valido:     'Válido',
  atencao:    'Atenção',
  reprovado:  'Reprovado',
};

const CARGO_LABELS: Record<string, string> = {
  biomedico:    'Biomédico(a)',
  tecnico:      'Técnico(a) de Laboratório',
  farmaceutico: 'Farmacêutico(a)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CoagulacaoRelatorioPrint({ lot, runs, lotStatus, onClose }: CoagulacaoRelatorioPrintProps) {
  const activeLab = useActiveLab();
  const user      = useUser();
  const printRef  = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `CIQ_Coagulacao_Nivel${lot.nivel}_${lot.loteControle}`,
  });

  // Ordena cronologicamente (mais antigo → mais novo) para a tabela
  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => a.dataRealizacao.localeCompare(b.dataRealizacao)),
    [runs],
  );

  const summary = useMemo(() => {
    const total    = runs.length;
    const rejCount = runs.filter((r) => r.conformidade === 'R').length;
    const taxaRej  = total > 0 ? (rejCount / total) * 100 : 0;
    const notivisaPendentes = runs
      .filter((r) => r.conformidade === 'R')
      .filter((r) => !r.notivisaStatus || r.notivisaStatus === 'pendente').length;
    return { total, rejCount, taxaRej, notivisaPendentes };
  }, [runs]);

  const audCode = auditCode(lot.labId, lot.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 dark:bg-black/85 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-slate-100 dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.08] print:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Relatório de Controle Interno — Coagulação</p>
          <p className="text-xs text-slate-400 dark:text-white/30">{audCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <path d="M6 14h12v8H6z"/>
            </svg>
            Imprimir / Salvar PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-lg text-xs font-medium text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white/85 hover:bg-slate-200 dark:hover:bg-white/[0.05] transition-all"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Print area */}
      <div className="max-w-4xl mx-auto py-6 px-4 print:max-w-none print:py-0 print:px-0">
        <div ref={printRef} className="bg-white text-slate-900 rounded-xl shadow-xl print:shadow-none print:rounded-none">
          <style>{`
            @media print {
              @page { size: A4; margin: 14mm 12mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page-break { page-break-before: always; }
              .avoid-break { page-break-inside: avoid; }
            }
          `}</style>

          <article className="p-10 print:p-0 text-[11px] leading-relaxed">

            {/* ── Cabeçalho ─────────────────────────────────────────── */}
            <header className="pb-4 border-b-2 border-slate-900 mb-4">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">
                    Controle Interno da Qualidade — Coagulação
                  </p>
                  <h1 className="text-xl font-bold tracking-tight">
                    {activeLab?.name ?? 'Laboratório'}
                  </h1>
                  {activeLab?.legalName && (
                    <p className="text-[10px] text-slate-500 mt-0.5">{activeLab.legalName}</p>
                  )}
                  {activeLab?.cnpj && (
                    <p className="text-[9px] text-slate-500 mt-0.5">CNPJ {activeLab.cnpj}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500">Código de auditoria</p>
                  <p className="font-mono text-sm font-semibold">{audCode}</p>
                  <p className="text-[9px] text-slate-500 mt-2">Emitido em</p>
                  <p className="text-[11px] font-medium">
                    {new Date().toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </header>

            {/* ── Identificação do lote ───────────────────────────── */}
            <section className="mb-5 avoid-break">
              <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-1">
                Lote de Controle
              </h2>
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-[10.5px]">
                <Field label="Nível" value={lot.nivel === 'I' ? 'I (Normal)' : 'II (Patológico)'}/>
                <Field label="Lote controle" value={<span className="font-mono">{lot.loteControle}</span>}/>
                <Field label="Fabricante" value={lot.fabricanteControle}/>
                <Field label="Abertura" value={fmtDate(lot.aberturaControle)}/>
                <Field label="Validade" value={fmtDate(lot.validadeControle)}/>
                <Field label="Status do lote" value={STATUS_LABELS[lotStatus]}/>
                <Field label="Equipamento" value="Clotimer Duo"/>
                <Field label="Total de corridas" value={String(summary.total)}/>
                <Field
                  label="Decisão formal"
                  value={lot.coagDecision
                    ? (lot.coagDecision === 'A' ? 'Aceitável' : lot.coagDecision === 'NA' ? 'Não aceitável' : 'Rejeitado')
                    : '— pendente'}
                />
              </div>
            </section>

            {/* ── Sumário ──────────────────────────────────────────── */}
            <section className="mb-5 avoid-break">
              <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-1">
                Sumário
              </h2>
              <div className="grid grid-cols-4 gap-3">
                <SummaryCard label="Corridas" value={String(summary.total)}/>
                <SummaryCard label="Não conformes" value={String(summary.rejCount)}/>
                <SummaryCard label="Taxa de rejeição" value={`${summary.taxaRej.toFixed(1)}%`}/>
                <SummaryCard label="NOTIVISA pendentes" value={String(summary.notivisaPendentes)}/>
              </div>
            </section>

            {/* ── Tabela de corridas ───────────────────────────────── */}
            <section className="mb-6">
              <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-1">
                Corridas cronológicas
              </h2>
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300">
                    <th className="text-left px-2 py-1.5 font-semibold">Código</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Data</th>
                    <th className="text-right px-2 py-1.5 font-semibold">AP (%)</th>
                    <th className="text-right px-2 py-1.5 font-semibold">RNI</th>
                    <th className="text-right px-2 py-1.5 font-semibold">TTPA (s)</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Conf.</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Violações</th>
                    <th className="text-left px-2 py-1.5 font-semibold">NOTIVISA</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Operador</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRuns.map((r, idx) => {
                    const cfg  = {
                      ap:   COAG_ANALYTES.atividadeProtrombinica.levels[lot.nivel],
                      rni:  COAG_ANALYTES.rni.levels[lot.nivel],
                      ttpa: COAG_ANALYTES.ttpa.levels[lot.nivel],
                    };
                    const apOut   = r.resultados.atividadeProtrombinica < cfg.ap.low   || r.resultados.atividadeProtrombinica > cfg.ap.high;
                    const rniOut  = r.resultados.rni  < cfg.rni.low  || r.resultados.rni  > cfg.rni.high;
                    const ttpaOut = r.resultados.ttpa < cfg.ttpa.low || r.resultados.ttpa > cfg.ttpa.high;
                    const isNC    = r.conformidade === 'R';
                    return (
                      <tr key={r.id} className={[
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                        isNC ? 'bg-red-50 border-y border-red-200' : '',
                      ].join(' ')}>
                        <td className="px-2 py-1 font-mono">{r.runCode ?? r.id.slice(0, 8)}</td>
                        <td className="px-2 py-1">{fmtDate(r.dataRealizacao)}</td>
                        <td className={`px-2 py-1 text-right tabular-nums ${apOut ? 'text-red-600 font-semibold' : ''}`}>{r.resultados.atividadeProtrombinica}</td>
                        <td className={`px-2 py-1 text-right tabular-nums ${rniOut ? 'text-red-600 font-semibold' : ''}`}>{r.resultados.rni.toFixed(2)}</td>
                        <td className={`px-2 py-1 text-right tabular-nums ${ttpaOut ? 'text-red-600 font-semibold' : ''}`}>{r.resultados.ttpa.toFixed(1)}</td>
                        <td className={`px-2 py-1 font-semibold ${isNC ? 'text-red-700' : 'text-emerald-700'}`}>{isNC ? 'R' : 'A'}</td>
                        <td className="px-2 py-1 text-[8.5px]">{(r.westgardViolations ?? []).join(', ') || '—'}</td>
                        <td className="px-2 py-1 text-[8.5px]">{formatNotivisaCell(r)}</td>
                        <td className="px-2 py-1 text-[9px]">{r.operatorName ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[8.5px] text-slate-500 mt-1.5">
                Linhas em vermelho indicam não conformidade. Valores individuais em vermelho extrapolam o intervalo do fabricante (low–high).
              </p>
            </section>

            {/* ── Ações corretivas ────────────────────────────────── */}
            {sortedRuns.some((r) => r.conformidade === 'R' && r.acaoCorretiva?.trim()) && (
              <section className="mb-5 avoid-break">
                <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-1">
                  Ações corretivas (RDC 978/2025 Art. 128)
                </h2>
                <ul className="space-y-2">
                  {sortedRuns.filter((r) => r.conformidade === 'R' && r.acaoCorretiva?.trim()).map((r) => (
                    <li key={r.id} className="text-[10px]">
                      <span className="font-mono font-semibold">{r.runCode}</span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span>{fmtDate(r.dataRealizacao)}</span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span className="italic">{r.acaoCorretiva}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Assinatura do RT ────────────────────────────────── */}
            <section className="mt-12 avoid-break">
              <div className="grid grid-cols-2 gap-12">
                <div>
                  <div className="border-b border-slate-900 h-12"/>
                  <p className="text-[9.5px] mt-1 text-slate-600">Responsável Técnico</p>
                  <p className="text-[9px] text-slate-500">
                    {lot.decisionBy && user?.uid === lot.decisionBy
                      ? user?.displayName ?? user?.email
                      : '—'}
                  </p>
                  {lot.decisionAt && (
                    <p className="text-[9px] text-slate-500 mt-0.5">Decidido em {fmtTs(lot.decisionAt)}</p>
                  )}
                </div>
                <div>
                  <div className="border-b border-slate-900 h-12"/>
                  <p className="text-[9.5px] mt-1 text-slate-600">Operador / Biomédico</p>
                  <p className="text-[9px] text-slate-500">
                    {sortedRuns[sortedRuns.length - 1]?.operatorName ?? '—'}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    {sortedRuns[sortedRuns.length - 1]?.operatorRole && CARGO_LABELS[sortedRuns[sortedRuns.length - 1].operatorRole] }
                  </p>
                </div>
              </div>
            </section>

            {/* ── Rodapé ──────────────────────────────────────────── */}
            <footer className="mt-10 pt-4 border-t border-slate-300 text-[8.5px] text-slate-500 leading-relaxed">
              <p>
                Documento emitido eletronicamente em conformidade com a <strong>RDC 302/2005</strong>,
                <strong> RDC 978/2025</strong> (Art. 128 — ação corretiva em toda não conformidade),
                e <strong>RDC 67/2009 · 551/2021</strong> (Tecnovigilância NOTIVISA).
                Referências técnicas: CLSI H21-A5, H47-A2, H54-A; ISTH guidelines (INR/ISI/MNPT).
                Cada corrida possui assinatura lógica SHA-256 vinculando operador, lote e resultados —
                verificável via QR Code no sistema.
              </p>
              <p className="mt-1.5 font-mono">
                {audCode} · {activeLab?.id ?? ''} · {lot.id}
              </p>
            </footer>

          </article>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[8.5px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-[10.5px] font-medium text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-300 rounded px-3 py-2">
      <p className="text-[8.5px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
