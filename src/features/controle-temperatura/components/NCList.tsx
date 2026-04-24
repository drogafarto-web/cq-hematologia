import { useMemo, useState } from 'react';

import { useEquipamentos } from '../hooks/useEquipamentos';
import { useNCs } from '../hooks/useNCs';
import type { NaoConformidadeTemp, StatusNC } from '../types/ControlTemperatura';
import { AlertTriangleIcon } from './_icons';
import { Button, SectionHeader, StatusBadge, toneForNC } from './_shared';
import { NCForm } from './NCForm';

const GRUPOS: { label: string; status: StatusNC; tone: 'danger' | 'info' | 'success' }[] = [
  { label: 'Ações imediatas pendentes', status: 'aberta', tone: 'danger' },
  { label: 'Em andamento', status: 'em_andamento', tone: 'info' },
  { label: 'Resolvidas', status: 'resolvida', tone: 'success' },
];

export function NCList() {
  const { ncs, isLoading } = useNCs();
  const { equipamentos } = useEquipamentos({ includeDeleted: true });
  const [edicao, setEdicao] = useState<NaoConformidadeTemp | null>(null);

  const nomePor = useMemo(() => {
    const m: Record<string, string> = {};
    equipamentos.forEach((e) => (m[e.id] = e.nome));
    return m;
  }, [equipamentos]);

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Carregando NCs...</div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Gestão de Não Conformidades" subtitle="FR-11 verso • PQ-06" />

      {GRUPOS.map(({ label, status, tone }) => {
        const grupo = ncs.filter((n) => n.status === status);
        if (grupo.length === 0 && status !== 'aberta') return null;
        return (
          <div
            key={status}
            className={`overflow-hidden rounded-xl border shadow-sm ${
              tone === 'danger'
                ? 'border-rose-200'
                : tone === 'info'
                  ? 'border-indigo-200'
                  : 'border-emerald-200'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b px-4 py-3 ${
                tone === 'danger'
                  ? 'border-rose-100 bg-rose-50'
                  : tone === 'info'
                    ? 'border-indigo-100 bg-indigo-50'
                    : 'border-emerald-100 bg-emerald-50'
              }`}
            >
              <h3
                className={`flex items-center gap-2 font-bold ${
                  tone === 'danger'
                    ? 'text-rose-800'
                    : tone === 'info'
                      ? 'text-indigo-800'
                      : 'text-emerald-800'
                }`}
              >
                <AlertTriangleIcon size={18} /> {label}
              </h3>
              <StatusBadge tone={toneForNC(status)}>{grupo.length}</StatusBadge>
            </div>

            {grupo.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nada aberto por aqui 👌</p>
            ) : (
              <ul className="divide-y divide-slate-100 bg-white">
                {grupo.map((nc) => (
                  <li
                    key={nc.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                          {nc.id.slice(0, 8)}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {nomePor[nc.equipamentoId] ?? nc.equipamentoId}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-rose-600">
                        {nc.temperaturaRegistrada.toFixed(1)}°C — violou {nc.limiteViolado}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Abertura: {nc.dataAbertura.toDate().toLocaleString('pt-BR')} • Resp:{' '}
                        {nc.responsavelAcao}
                      </p>
                    </div>
                    <Button
                      tone={status === 'resolvida' ? 'secondary' : 'danger'}
                      onClick={() => setEdicao(nc)}
                    >
                      {status === 'resolvida' ? 'Ver detalhes' : 'Tratar desvio'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {edicao ? <NCForm open onClose={() => setEdicao(null)} nc={edicao} /> : null}
    </div>
  );
}
