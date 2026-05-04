import { useState } from 'react';
import { useTreinamentos } from '../useTreinamentos';
import type { Treinamento } from '../types/Treinamento';

interface RegistroPresencaUIProps {
  treinamento: Treinamento;
}

export function RegistroPresencaUI({ treinamento }: RegistroPresencaUIProps) {
  const { registrarPresenca } = useTreinamentos();
  const [loading, setLoading] = useState(false);

  const handleTogglePresenca = async (participanteId: string, presente: boolean) => {
    setLoading(true);
    try {
      await registrarPresenca(treinamento.id, participanteId, !presente);
    } catch (err) {
      console.error('Erro ao registrar presença:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-200">Presença</h3>
      <div className="grid gap-2">
        {treinamento.participantes.map((uid) => {
          const presenca = treinamento.presenca[uid];
          const presente = presenca?.presente || false;

          return (
            <div key={uid} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded">
              <span className="text-sm text-gray-300">{uid}</span>
              <button
                onClick={() => handleTogglePresenca(uid, presente)}
                disabled={loading}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  presente
                    ? 'bg-emerald-900 text-emerald-100 hover:bg-emerald-800'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {presente ? '✓ Presente' : 'Ausente'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
