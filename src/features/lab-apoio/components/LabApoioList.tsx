/**
 * LabApoioList.tsx — dark-first table view of contracts.
 *
 * Columns: Nome | CNPJ | AVS | Vigência | Exames | Criticidade | Avaliação | Ações
 * Tabular-nums on CNPJ and dates.
 */

import React from 'react';
import type { Contrato } from '../types/LabApoio';

interface LabApoioListProps {
  contratos: Contrato[];
}

export function LabApoioList({ contratos }: LabApoioListProps) {
  if (contratos.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-8 text-center">
        <p className="text-white/50">Nenhum contrato registrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 bg-white/5">
            <th className="px-4 py-3 text-left font-medium text-white/70">Nome</th>
            <th className="px-4 py-3 text-left font-medium text-white/70 font-tabular-nums">
              CNPJ
            </th>
            <th className="px-4 py-3 text-left font-medium text-white/70">AVS</th>
            <th className="px-4 py-3 text-left font-medium text-white/70 font-tabular-nums">
              Vigência
            </th>
            <th className="px-4 py-3 text-center font-medium text-white/70">Exames</th>
            <th className="px-4 py-3 text-left font-medium text-white/70">Criticidade</th>
            <th className="px-4 py-3 text-left font-medium text-white/70">Avaliação</th>
            <th className="px-4 py-3 text-right font-medium text-white/70">Ações</th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((contrato) => (
            <tr
              key={contrato.id}
              className="border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <td className="px-4 py-3 text-white font-medium">{contrato.nome}</td>
              <td className="px-4 py-3 text-white font-tabular-nums text-sm">{contrato.cnpj}</td>
              <td className="px-4 py-3 text-white/70 text-sm">
                {contrato.habilitacaoAnvisa.substring(0, 20)}
              </td>
              <td className="px-4 py-3 text-white font-tabular-nums text-sm">
                {contrato.vigenciaInicio} • {contrato.vigenciaFim}
              </td>
              <td className="px-4 py-3 text-center text-white/70">{contrato.exames.length}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    contrato.criticidade === 'alta'
                      ? 'bg-red-500/20 text-red-400'
                      : contrato.criticidade === 'media'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {contrato.criticidade}
                </span>
              </td>
              <td className="px-4 py-3 text-white/70 text-sm">
                {contrato.avaliacaoPeriodica.length > 0
                  ? `${contrato.avaliacaoPeriodica.length} avaliações`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <button className="text-violet-400 hover:text-violet-300 text-sm transition-colors">
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
