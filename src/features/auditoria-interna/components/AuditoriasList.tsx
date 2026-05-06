import React from 'react';
import type { Auditoria } from '../types';

interface AuditoriasListProps {
  auditorias: Auditoria[];
}

export function AuditoriasList({ auditorias }: AuditoriasListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Histórico de Auditorias</h2>
      {auditorias.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-12 text-center">
          <p className="text-white/60">Nenhuma auditoria finalizada</p>
        </div>
      ) : (
        auditorias.map((auditoria) => (
          <div key={auditoria.id} className="border border-white/10 rounded-lg p-4 bg-white/5">
            <p className="font-medium">Ano {auditoria.ano}</p>
            <p className="text-sm text-white/70 mt-2">
              Finalizada em:{' '}
              {new Date(auditoria.criadoEm.toDate()).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-sm text-white/70">
              Responsável: {auditoria.responsavelTecnico}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
