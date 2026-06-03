import React from 'react';
import type { Designacao, Cargo } from '../types';

interface DesignacaoCertificateProps {
  designacao: Designacao;
  cargo: Cargo;
  laboratorioNome?: string;
}

/**
 * Printable certificate layout (A4) for Designação (appointment).
 * Print-ready: use `window.print()` or <a href="...">Print Certificate</a> button.
 * Responsive, dark-mode safe, semantic structure for PDF generation.
 */
export const DesignacaoCertificate: React.FC<DesignacaoCertificateProps> = ({
  designacao,
  cargo,
  laboratorioNome = 'Laboratório Clínico',
}) => {
  const dataInicio = new Date(designacao.dataInicio.toMillis?.() ?? designacao.dataInicio);
  const dataFim = designacao.dataFim
    ? new Date(designacao.dataFim.toMillis?.() ?? designacao.dataFim)
    : null;
  const dataCriacao = new Date(designacao.criadoEm.toMillis?.() ?? designacao.criadoEm);

  const formatDate = (date: Date) => date.toLocaleDateString('pt-BR');
  const formatDateTime = (date: Date) => date.toLocaleString('pt-BR');

  return (
    <div className="w-full bg-white text-gray-900 print:bg-white print:text-black">
      {/* A4 Page Container: 210mm x 297mm */}
      <div className="mx-auto p-8 print:p-8" style={{ width: '210mm', minHeight: '297mm' }}>
        {/* Header */}
        <div className="text-center mb-12 pb-6 border-b-2 border-gray-300">
          <h1 className="text-3xl font-serif font-bold mb-2">Certificado de Designação</h1>
          <p className="text-gray-600">{laboratorioNome}</p>
        </div>

        {/* Main Content */}
        <div className="space-y-8 mb-12">
          {/* Intro */}
          <p className="text-center text-gray-700 text-sm leading-relaxed">
            A entidade supra qualificada certifica que, em conformidade com as normas regulatórias
            DICQ 4.1.2.7 e RDC 978/2025, foi designado para exercer as responsabilidades de:
          </p>

          {/* Cargo */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">CARGO</p>
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-1">{cargo.titulo}</h2>
            <p className="text-gray-700 italic">{cargo.descricao}</p>
          </div>

          {/* Designado */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <p className="text-sm font-semibold text-gray-600 uppercase mb-1">Designado</p>
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-4">
              {designacao.pessoaNome}
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 font-semibold">Válido De</p>
                <p className="text-gray-900">{formatDate(dataInicio)}</p>
              </div>
              <div>
                <p className="text-gray-600 font-semibold">Válido Até</p>
                <p className="text-gray-900">{dataFim ? formatDate(dataFim) : 'Indefinido'}</p>
              </div>
            </div>
          </div>

          {/* Autoridades */}
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase mb-3">
              Autoridades e Responsabilidades
            </p>
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-800 leading-relaxed">
              {designacao.descricaoAutoridade}
            </div>
          </div>

          {/* Divisor */}
          <div className="border-t border-gray-300" />

          {/* Assinatura e Validação */}
          <div className="space-y-4">
            <p className="text-sm text-gray-600 font-semibold uppercase">
              Validação por Assinatura Digital
            </p>

            <div className="grid grid-cols-3 gap-4 text-xs font-mono bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-gray-600 font-semibold mb-1">Hash (SHA-256)</p>
                <p className="text-gray-900 break-all">
                  {designacao.chainHash.hash.substring(0, 32)}...
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-semibold mb-1">Operador</p>
                <p className="text-gray-900 break-all">
                  {designacao.chainHash.operatorId.substring(0, 16)}...
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-semibold mb-1">Assinado em</p>
                <p className="text-gray-900">
                  {formatDateTime(
                    new Date(designacao.chainHash.ts.toMillis?.() ?? designacao.chainHash.ts),
                  )}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 italic">
              Este certificado é auditável e imutável. A validação digital garante a integridade e
              rastreabilidade conforme RDC 978 Art. 128 (Trilha de Auditoria).
            </p>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-16 pt-8 border-t-2 border-gray-300">
          <div className="grid grid-cols-3 gap-8 text-center">
            {/* Signature 1 */}
            <div>
              <div className="h-16 mb-2" />
              <p className="text-xs border-t border-gray-400 pt-1">Responsável Técnico</p>
            </div>

            {/* Signature 2 */}
            <div>
              <div className="h-16 mb-2" />
              <p className="text-xs border-t border-gray-400 pt-1">Gerente de Qualidade</p>
            </div>

            {/* Signature 3 */}
            <div>
              <div className="h-16 mb-2" />
              <p className="text-xs border-t border-gray-400 pt-1">Diretor / Auditor</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center text-xs text-gray-500">
            <p>
              Certificado emitido em {formatDate(dataCriacao)} | ID: {designacao.id}
            </p>
            <p className="mt-1">DICQ 4.1.2.7 · RDC 978 Art. 122 · LGPD Art. 18</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .print\\:bg-white {
            background-color: white;
          }
          .print\\:text-black {
            color: black;
          }
        }
      `}</style>
    </div>
  );
};
