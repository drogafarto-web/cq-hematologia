import React from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeSessoes } from '../services/auditoriaService';
import type { Auditoria } from '../types';
import { useEffect, useState } from 'react';

interface SessoesListProps {
  auditorias: Auditoria[];
  onSelectSessao?: (auditoriaId: string, sessaoId: string) => void;
}

export function SessoesList({ auditorias, onSelectSessao }: SessoesListProps) {
  const labId = useActiveLabId();
  const [sessoesByAuditoria, setSessoesByAuditoria] = useState<
    Record<string, { id: string; status: string; dataInicio?: any }[]>
  >({});

  useEffect(() => {
    if (!labId || auditorias.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    for (const auditoria of auditorias) {
      const unsub = subscribeSessoes(
        labId,
        auditoria.id,
        (sessoes) => {
          setSessoesByAuditoria((prev) => ({ ...prev, [auditoria.id]: sessoes }));
        },
        (err) => console.error('Error loading sessoes:', err),
      );
      unsubscribes.push(unsub);
    }

    return () => unsubscribes.forEach((u) => u());
  }, [labId, auditorias]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sessões em Execução</h2>
      {auditorias.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-12 text-center">
          <p className="text-white/60">Nenhuma auditoria em execução</p>
        </div>
      ) : (
        auditorias.map((auditoria) => {
          const sessoes = sessoesByAuditoria[auditoria.id] || [];
          return (
            <div
              key={auditoria.id}
              className="border border-white/10 rounded-lg p-4 bg-white/5 space-y-3"
            >
              <div className="flex justify-between items-center">
                <p className="font-medium">
                  Ano {auditoria.ano} — {auditoria.frequencia}
                </p>
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300">
                  Em execução
                </span>
              </div>

              {sessoes.length === 0 ? (
                <p className="text-sm text-white/50">Nenhuma sessão criada</p>
              ) : (
                <div className="space-y-2">
                  {sessoes.map((sessao) => (
                    <button
                      key={sessao.id}
                      onClick={() => onSelectSessao?.(auditoria.id, sessao.id)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-violet-500/10 border border-white/10 hover:border-violet-500/30 transition"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm">
                          {sessao.dataInicio
                            ? new Date(sessao.dataInicio.toDate()).toLocaleDateString('pt-BR')
                            : 'Sessão'}
                        </span>
                        <span className="text-xs text-white/50">{sessao.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
