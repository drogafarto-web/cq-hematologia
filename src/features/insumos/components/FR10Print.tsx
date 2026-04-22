/**
 * FR10Print — layout imprimível do formulário FR-10 (Rastreabilidade de
 * Insumos, Ver.00 Labclin MG). Imprime via window.print() + @media print css.
 *
 * Design:
 *  - Um PDF por equipamento por período (padrão do formulário físico).
 *  - Linhas intercalam reagentes diferentes do mesmo equipamento, ordenadas
 *    por data de abertura asc.
 *  - Agrupamento visual sutil de trocas simultâneas (mesma dataAbertura) —
 *    borda superior compartilhada via `isGroupStart`.
 *  - Rodapé com hash SHA-256, QR de validação, rubrica digital (nome + uid
 *    do emissor), data, Gerência da Qualidade.
 *
 * Metadados de compliance embutidos no canonical → hash → QR → endpoint
 * público (`validateReport`) que recomputa contra Firestore.
 *
 * Referência física: docs/reference/FR-10-preenchido-2024-2025 (CTO anexa
 * quando disponível). Ajustar proporções de coluna em pixel-peep review.
 */

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { FR10_VALIDATE_URL } from '../../../constants';
import type { FR10Payload, FR10Row } from '../services/fr10ExportService';

interface FR10PrintProps {
  payload: FR10Payload;
  /** SHA-256 hex do canonical; calculado fora e passado pronto. */
  hash: string;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function fmtTime(d: Date | undefined): string {
  if (!d) return '';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtCnpj(cnpj: string): string {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14) return cnpj;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
}

function fmtModulo(m: string): string {
  switch (m) {
    case 'hematologia':
      return 'Hematologia';
    case 'coagulacao':
      return 'Coagulação';
    case 'uroanalise':
      return 'Uroanálise';
    case 'imunologia':
      return 'Imunologia';
    default:
      return m;
  }
}

function fmtMotivo(row: FR10Row): string {
  if (!row.motivoTermino) return '';
  if (row.motivoTermino === 'descarte') {
    return row.motivoDescarte ? `Descarte: ${row.motivoDescarte}` : 'Descartado';
  }
  return 'Fechado';
}

/** Linhas adjacentes com a mesma data de abertura recebem separador sutil. */
function rowGroupKeys(rows: FR10Row[]): boolean[] {
  return rows.map((r, i) => {
    if (i === 0) return true;
    const prev = rows[i - 1];
    return r.dataAbertura.toDateString() !== prev.dataAbertura.toDateString();
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FR10Print({ payload, hash, onClose }: FR10PrintProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `FR-10-${payload.modulo}-${payload.equipamento}-${payload.periodoInicio.toISOString().slice(0, 7)}`,
  });

  const groupStarts = rowGroupKeys(payload.rows);
  const qrUrl = `${FR10_VALIDATE_URL}?lab=${encodeURIComponent(payload.labId)}&hash=${hash}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 dark:bg-black/85 backdrop-blur-sm overflow-y-auto print:bg-white print:static print:overflow-visible">
      {/* Barra de ação — oculta na impressão */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#0B0F14] border-b border-slate-200 dark:border-white/[0.08] px-6 h-14 flex items-center justify-between print:hidden">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/30">
            Preview FR-10
          </p>
          <p className="text-sm font-medium text-slate-800 dark:text-white/85">
            {fmtModulo(payload.modulo)} · {payload.equipamento} ·{' '}
            {payload.periodoInicio.toLocaleDateString('pt-BR')} –{' '}
            {payload.periodoFim.toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePrint()}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <path d="M6 14h12v8H6z" />
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

      <div className="max-w-[860px] mx-auto py-6 px-4 print:max-w-none print:py-0 print:px-0">
        <div
          ref={printRef}
          className="bg-white text-slate-900 rounded-xl shadow-xl print:shadow-none print:rounded-none"
        >
          <style>{`
            @media print {
              @page { size: A4; margin: 12mm 10mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page-break { page-break-before: always; }
              .avoid-break { page-break-inside: avoid; }
              thead { display: table-header-group; }
              tr { page-break-inside: avoid; }
            }
          `}</style>

          <article className="p-8 print:p-2 text-[10.5px] leading-snug">
            {/* ── Cabeçalho ─────────────────────────────────────────── */}
            <header className="pb-3 border-b-2 border-slate-900 mb-4">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">
                    Formulário de Rastreabilidade de Insumos
                  </p>
                  <h1 className="text-lg font-bold tracking-tight">FR-10 · Ver.00</h1>
                  <p className="text-[11px] text-slate-700 mt-1">{payload.labName}</p>
                  {payload.labCnpj && (
                    <p className="text-[9px] text-slate-500">CNPJ {payload.labCnpj}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500">Emitido em</p>
                  <p className="text-[11px] font-medium">
                    {payload.generatedAt.toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-1.5">Emissor</p>
                  <p className="text-[10px] font-medium">{payload.generatedBy.displayName}</p>
                  <p className="text-[8px] font-mono text-slate-400">
                    uid: {payload.generatedBy.uid.slice(0, 10)}…
                  </p>
                </div>
              </div>

              {/* Material / Equipamento / Módulo / Período — segunda linha */}
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[10px]">
                <div>
                  <span className="text-slate-500">Material: </span>
                  <span className="font-medium">Reagentes {payload.equipamento}</span>
                </div>
                <div>
                  <span className="text-slate-500">Módulo: </span>
                  <span className="font-medium">{fmtModulo(payload.modulo)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Equipamento: </span>
                  <span className="font-medium">{payload.equipamento}</span>
                </div>
                <div>
                  <span className="text-slate-500">Período: </span>
                  <span className="font-medium">
                    {payload.periodoInicio.toLocaleDateString('pt-BR')} –{' '}
                    {payload.periodoFim.toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </header>

            {/* ── Tabela principal ──────────────────────────────────── */}
            {payload.rows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-[11px]">
                Nenhum lote aberto no período para este módulo.
              </div>
            ) : (
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-[9px] uppercase tracking-wider text-slate-700">
                    <th className="text-left py-1.5 pr-1 font-semibold">Data abert.</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Hora abert.</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Reagente</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Lote / NF / Fornecedor</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Validade</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Colab. abert.</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Data térm.</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Hora térm.</th>
                    <th className="text-left py-1.5 pr-1 font-semibold">Colab. térm.</th>
                    <th className="text-left py-1.5 font-semibold">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.rows.map((row, i) => {
                    const isGroupStart = groupStarts[i];
                    return (
                      <tr
                        key={row.aberturaMovId}
                        className={`text-slate-800 ${
                          isGroupStart
                            ? 'border-t border-slate-400'
                            : 'border-t border-slate-200'
                        }`}
                      >
                        <td className="py-1.5 pr-1 whitespace-nowrap font-mono">
                          {fmtDate(row.dataAbertura)}
                        </td>
                        <td className="py-1.5 pr-1 whitespace-nowrap font-mono">
                          {fmtTime(row.dataAbertura)}
                        </td>
                        <td className="py-1.5 pr-1">{row.nomeComercial}</td>
                        <td className="py-1.5 pr-1 leading-tight">
                          <div className="font-mono">{row.lote}</div>
                          {row.notaFiscal && (
                            <div className="text-[8px] text-slate-600 font-mono">
                              NF {row.notaFiscal.numero}
                              {row.notaFiscal.serie && row.notaFiscal.serie !== '1' && (
                                <span>/{row.notaFiscal.serie}</span>
                              )}
                              {row.notaFiscal.dataEmissao && (
                                <span className="text-slate-400">
                                  {' · '}
                                  {fmtDate(row.notaFiscal.dataEmissao)}
                                </span>
                              )}
                            </div>
                          )}
                          {row.fornecedor && (
                            <div className="text-[8px] text-slate-500">
                              {row.fornecedor.razaoSocial}
                              {row.fornecedor.cnpj && ` · ${fmtCnpj(row.fornecedor.cnpj)}`}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-1 whitespace-nowrap font-mono">
                          {fmtDate(row.validade)}
                        </td>
                        <td className="py-1.5 pr-1">{row.operadorAbertura}</td>
                        <td className="py-1.5 pr-1 whitespace-nowrap font-mono">
                          {fmtDate(row.dataTermino)}
                        </td>
                        <td className="py-1.5 pr-1 whitespace-nowrap font-mono">
                          {fmtTime(row.dataTermino)}
                        </td>
                        <td className="py-1.5 pr-1">{row.operadorTermino ?? ''}</td>
                        <td className="py-1.5 text-slate-500">{fmtMotivo(row)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── Rodapé ────────────────────────────────────────────── */}
            <footer className="mt-6 pt-4 border-t-2 border-slate-900 avoid-break">
              <div className="grid grid-cols-[1fr_auto] gap-6">
                {/* Lado esquerdo — assinatura + hash */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-slate-500">
                      Gerência da Qualidade
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-400 w-64">
                      <p className="text-[10px] font-medium">{payload.generatedBy.displayName}</p>
                      <p className="text-[8.5px] text-slate-500">
                        Assinatura eletrônica — MP 2.200-2/2001 art. 4
                      </p>
                    </div>
                  </div>

                  <div className="text-[8.5px] font-mono text-slate-500 break-all">
                    <span className="uppercase tracking-wider text-[8px] text-slate-400 not-italic font-sans block mb-0.5">
                      Hash SHA-256
                    </span>
                    {hash}
                  </div>

                  <div className="text-[8px] text-slate-500 leading-tight">
                    Este documento foi gerado digitalmente pelo sistema hc quality. Cada linha
                    corresponde a uma movimentação registrada no Firestore com assinatura
                    criptográfica individual. O QR ao lado permite auditor externo validar o
                    hash deste documento contra a base de dados do laboratório.
                    <br />
                    Compliance: RDC 978/2025 Art.128 · ISO 15189:2022 cl. 6.5.3 · PALC 2021/2025 ·
                    RDC 786/2023 art. 42.
                  </div>
                </div>

                {/* Lado direito — QR */}
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2 bg-white border border-slate-300 rounded">
                    <QRCodeSVG value={qrUrl} size={96} level="M" includeMargin={false} />
                  </div>
                  <p className="text-[8px] text-slate-500 text-center leading-tight max-w-[100px]">
                    Escaneie para validar este relatório
                  </p>
                </div>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
