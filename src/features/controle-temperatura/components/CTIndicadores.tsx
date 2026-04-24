import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Timestamp } from '../../../shared/services/firebase';
import { useCTIndicadores } from '../hooks/useCTIndicadores';
import { useDispositivosIoT } from '../hooks/useDispositivosIoT';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useLeituras } from '../hooks/useLeituras';
import { useLeiturasPrevistas } from '../hooks/useLeiturasPrevistas';
import { useNCs } from '../hooks/useNCs';
import { useTermometros } from '../hooks/useTermometros';

function inicioMesCorrente(): Timestamp {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}
function fimMesCorrente(): Timestamp {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(d);
}

function corConformidade(pct: number): string {
  if (pct >= 95) return '#059669';
  if (pct >= 80) return '#f59e0b';
  return '#e11d48';
}

export function CTIndicadores() {
  const inicio = useMemo(inicioMesCorrente, []);
  const fim = useMemo(fimMesCorrente, []);

  const { equipamentos } = useEquipamentos();
  const { leituras } = useLeituras({ inicio, fim });
  const { previstas } = useLeiturasPrevistas({ inicio, fim });
  const { ncs } = useNCs();
  const { dispositivos } = useDispositivosIoT();
  const { proximosAVencer } = useTermometros();

  const {
    indicadores,
    totalNCsAbertas,
    totalPendentesHoje,
    percentualConformidadeGlobal,
  } = useCTIndicadores({
    equipamentos,
    leituras,
    previstas,
    ncs,
    dispositivos,
    inicioPeriodo: inicio,
    fimPeriodo: fim,
  });

  const dadosGrafico = indicadores.map((i) => ({
    nome: i.nomeEquipamento.length > 18 ? `${i.nomeEquipamento.slice(0, 16)}…` : i.nomeEquipamento,
    pct: i.percentualConformidade,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard
          label="Conformidade (mês)"
          value={`${percentualConformidadeGlobal}%`}
          tone="emerald"
        />
        <KpiCard label="NCs abertas" value={String(totalNCsAbertas)} tone="rose" />
        <KpiCard label="Pendentes hoje" value={String(totalPendentesHoje)} tone="amber" />
        <KpiCard
          label="Calibrações vencendo"
          value={String(proximosAVencer.length)}
          tone="slate"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-slate-700">
          % Conformidade por equipamento — mês corrente
        </h3>
        {dadosGrafico.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Sem equipamentos cadastrados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={dadosGrafico} margin={{ top: 10, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="nome"
                tick={{ fill: '#64748b', fontSize: 11 }}
                angle={-20}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 11 }}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: unknown) => [`${v}%`, 'Conformidade']}
              />
              <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                {dadosGrafico.map((d, i) => (
                  <Cell key={i} fill={corConformidade(d.pct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'rose' | 'amber' | 'slate';
}) {
  const valueCls =
    tone === 'emerald'
      ? 'text-slate-800'
      : tone === 'rose'
        ? 'text-rose-600'
        : tone === 'amber'
          ? 'text-amber-600'
          : 'text-slate-800';
  const iconBg =
    tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-600'
      : tone === 'rose'
        ? 'bg-rose-100 text-rose-600'
        : tone === 'amber'
          ? 'bg-amber-100 text-amber-600'
          : 'bg-slate-100 text-slate-600';

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`text-3xl font-bold ${valueCls}`}>{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
    </div>
  );
}
