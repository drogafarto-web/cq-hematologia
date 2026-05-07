import { useMemo } from 'react';
import QRCode from 'qrcode.react';

import type { Designacao } from '../types/ControlInterno';

export interface DesignacaoCertificateProps {
  designacao: Designacao;
  operadorNome: string;
  cargoNome: string;
  labNome: string;
}

/**
 * Componente de exibição de designação digital CAPA com:
 * - Layout A4 portrait, pronto para PDF
 * - Dados do operador, cargo, período
 * - Assinatura digital (HMAC seal visual)
 * - QR code linkando para auditoria
 * - Dark theme com tipografia editorial
 * - CSS @media print para ajustes de impressão
 */
export function DesignacaoCertificate({
  designacao,
  operadorNome,
  cargoNome,
  labNome,
}: DesignacaoCertificateProps) {
  // Formata datas conforme PT-BR
  const formattedStartDate = useMemo(() => {
    return new Date(designacao.dataInicio.toDate()).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, [designacao.dataInicio]);

  const formattedEndDate = useMemo(() => {
    if (!designacao.dataFim) return null;
    return new Date(designacao.dataFim.toDate()).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, [designacao.dataFim]);

  // QR code vincula à página de auditoria da designação
  const qrValue = useMemo(() => {
    return `${window.location.origin}/auditoria/designacoes/${designacao.id}`;
  }, [designacao.id]);

  return (
    <div className="flex flex-col items-center justify-center bg-slate-950 p-6 print:bg-white">
      {/* Container A4 portrait: 210 × 297 mm ~ 794 × 1123 px a 96dpi */}
      <article className="w-full max-w-[794px] space-y-6 bg-slate-900 p-12 shadow-lg print:bg-white print:shadow-none">
        {/* Cabeçalho */}
        <header className="border-b border-slate-700 pb-6 text-center print:border-slate-300">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-100 print:text-slate-900">
            Designação Digital
          </h1>
          <p className="text-sm font-medium text-slate-400 print:text-slate-600">
            CAPA · Controle de Atividades de Pessoal Autorizado
          </p>
        </header>

        {/* Identificação do operador */}
        <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-6 print:border-slate-300 print:bg-white">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-slate-600">
              Operador Autorizado
            </span>
            <span className="text-xs text-slate-500 print:text-slate-600">
              ID: {designacao.id.slice(0, 8)}…
            </span>
          </div>
          <p className="text-xl font-semibold text-slate-100 print:text-slate-900">{operadorNome}</p>
        </section>

        {/* Cargo e período */}
        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 print:border-slate-300 print:bg-white">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-slate-600">
              Cargo
            </p>
            <p className="text-lg font-medium text-slate-100 print:text-slate-900">{cargoNome}</p>
            <p className="mt-1 text-xs text-slate-500 print:text-slate-600">
              Nível {designacao.cargoNivel}
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 print:border-slate-300 print:bg-white">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-slate-600">
              Período de Validade
            </p>
            <p className="text-base font-mono text-slate-100 print:text-slate-900">
              {formattedStartDate}
            </p>
            {formattedEndDate && (
              <p className="text-xs text-slate-500 print:text-slate-600">até {formattedEndDate}</p>
            )}
          </div>
        </section>

        {/* Assinatura digital + laboratório */}
        <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/30 p-6 print:border-slate-300 print:bg-white">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-slate-600">
              Laboratório
            </span>
            <span className="text-xs text-slate-500 print:text-slate-600">{labNome}</span>
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-700 pt-4 print:border-slate-300">
            <p className="text-xs font-mono text-slate-500 print:text-slate-600">
              Assinatura digital (HMAC-SHA256)
            </p>
            <p className="break-all rounded bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-300 print:break-words print:bg-slate-100 print:text-slate-700">
              {designacao.assinatura.hash}
            </p>
            <p className="text-[10px] text-slate-600 print:text-slate-500">
              Gerado por: {designacao.assinatura.operatorId} · {new Date(designacao.assinatura.ts.toDate()).toLocaleString('pt-BR')}
            </p>
          </div>
        </section>

        {/* QR code + verificação */}
        <section className="flex flex-col items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/30 p-6 print:border-slate-300 print:bg-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-slate-600">
            Verificação de Autenticidade
          </p>
          <QRCode
            value={qrValue}
            size={120}
            level="H"
            includeMargin
            className="print:size-24"
          />
          <p className="mt-2 text-center text-[10px] text-slate-500 print:text-slate-600">
            Escaneie para acessar a trilha de auditoria
          </p>
        </section>

        {/* Rodapé */}
        <footer className="border-t border-slate-700 pt-4 text-center text-[10px] text-slate-500 print:border-slate-300 print:text-slate-600">
          <p>Este documento é emitido digitalmente e tem força legal mediante a assinatura HMAC.</p>
          <p className="mt-1">RDC 978/2025 · ISO 15189:2022</p>
        </footer>
      </article>
    </div>
  );
}
