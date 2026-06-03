import React, { useEffect, useState } from 'react';
import { usePGRSS } from '../usePGRSS';
import type { RegistroGeracao } from '../types/PGRSS';

/**
 * WasteRegistry — Display waste generation records with segregation checklist.
 * RDC 222/2018 compliance: visual segregation validation, type categorization.
 */
export function WasteRegistry() {
  const { subscribeToGeracoes } = usePGRSS();
  const [registros, setRegistros] = useState<RegistroGeracao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToGeracoes(
      (data) => {
        setRegistros(data);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar registros:', err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [subscribeToGeracoes]);

  const tiposCore = {
    biologico: { label: 'Biológico', color: 'bg-red-100 text-red-900', icon: '🧬' },
    quimico: { label: 'Químico', color: 'bg-yellow-100 text-yellow-900', icon: '⚗️' },
    radioativo: { label: 'Radioativo', color: 'bg-purple-100 text-purple-900', icon: '☢️' },
    'perfuro-cortante': { label: 'Perfuro-cortante', color: 'bg-red-200 text-red-800', icon: '💉' },
    comum: { label: 'Comum', color: 'bg-gray-100 text-gray-900', icon: '♻️' },
  } as const;

  if (loading) return <div className="p-6 text-center text-gray-500">Carregando registros...</div>;

  const agrupadoPorTipo = registros.reduce(
    (acc, registro) => {
      if (!acc[registro.tipo]) acc[registro.tipo] = [];
      acc[registro.tipo].push(registro);
      return acc;
    },
    {} as Record<string, RegistroGeracao[]>,
  );

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Object.entries(tiposCore).map(([tipo, config]) => {
          const count = agrupadoPorTipo[tipo]?.length || 0;
          const peso = agrupadoPorTipo[tipo]?.reduce((sum, r) => sum + r.peso_kg, 0) || 0;

          return (
            <div key={tipo} className={`rounded-lg p-4 ${config.color}`}>
              <div className="text-2xl">{config.icon}</div>
              <div className="mt-2 text-sm font-medium">{config.label}</div>
              <div className="mt-1 text-xs">
                <div>{count} registro(s)</div>
                <div>{peso.toFixed(1)} kg</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold">Registros Recentes</h3>
        <div className="mt-4 space-y-3">
          {registros.slice(0, 10).map((registro) => (
            <div
              key={registro.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex-1">
                <div className="font-medium">{registro.descricao}</div>
                <div className="text-sm text-gray-600">
                  {tiposCore[registro.tipo as keyof typeof tiposCore]?.label} — {registro.peso_kg}{' '}
                  kg
                </div>
                <div className="text-xs text-gray-500">Por: {registro.responsavel}</div>
              </div>
              <div
                className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                  registro.status === 'gerado'
                    ? 'bg-blue-100 text-blue-800'
                    : registro.status === 'segregado'
                      ? 'bg-yellow-100 text-yellow-800'
                      : registro.status === 'coletado'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                }`}
              >
                {registro.status.charAt(0).toUpperCase() + registro.status.slice(1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="text-sm text-yellow-900">
          <strong>Checklist RDC 222/2018:</strong>
          <ul className="mt-2 ml-4 space-y-1 list-disc">
            <li>Resíduos segregados por tipo correto</li>
            <li>Containers dentro da capacidade máxima</li>
            <li>Identificação clara de tipos</li>
            <li>Armazenamento em área designada</li>
            <li>Coleta documentada com comprovante</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
