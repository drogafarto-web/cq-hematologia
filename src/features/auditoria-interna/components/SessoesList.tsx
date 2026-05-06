import React from 'react';
import type { Auditoria } from '../types';

interface SessoesListProps {
  auditorias: Auditoria[];
}

export function SessoesList({ auditorias }: SessoesListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sessões em Execução</h2>
      {auditorias.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-12 text-center">
          <p className="text-white/60">Nenhuma auditoria em execução</p>
        </div>
      ) : (
        auditorias.map((auditoria) => (
          <div key={auditoria.id} className="border border-white/10 rounded-lg p-4 bg-white/5">
            <p className="font-medium">Ano {auditoria.ano}</p>
            <p className="text-sm text-white/70">
              Status: {auditoria.status === 'em_execução' ? 'Em execução' : 'Finalizada'}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
