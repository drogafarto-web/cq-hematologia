import { useMemo, useState } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useCTIndicadores } from '../hooks/useCTIndicadores';
import { useDispositivosIoT } from '../hooks/useDispositivosIoT';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useLeituras } from '../hooks/useLeituras';
import { useLeiturasPrevistas } from '../hooks/useLeiturasPrevistas';
import { useNCs } from '../hooks/useNCs';
import { useTermometros } from '../hooks/useTermometros';
import type {
  CardStatusEquipamento,
  EquipamentoMonitorado,
} from '../types/ControlTemperatura';
import {
  ActivityIcon,
  AlertTriangleIcon,
  ClockIcon,
  ServerIcon,
} from './_icons';
import {
  borderForStatusCard,
  Button,
  SectionHeader,
  StatusBadge,
  toneForStatusCard,
} from './_shared';
import { LeituraRapidaForm } from './LeituraRapidaForm';

function inicioMes(): Timestamp {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}
function fimMes(): Timestamp {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(d);
}

/**
 * Dashboard em tempo real. Subscribers de equipamentos / leituras /
 * dispositivos ficam abertos e a derivação via useCTIndicadores recalcula
 * os cards a cada onSnapshot — sem polling manual.
 */
export function CTDashboard() {
  const inicio = useMemo(inicioMes, []);
  const fim = useMemo(fimMes, []);

  const { equipamentos } = useEquipamentos();
  const { leituras } = useLeituras({ inicio, fim });
  const { previstas } = useLeiturasPrevistas({ inicio, fim });
  const { ncs } = useNCs();
  const { dispositivos } = useDispositivosIoT();
  const { proximosAVencer } = useTermometros();

  const {
    cards,
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

  const dispositivosOffline = dispositivos.filter((d) => d.ativo && !d.online).length;
  const [leituraRapida, setLeituraRapida] = useState<EquipamentoMonitorado | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryKpi
          label="Conformidade (mês)"
          value={`${percentualConformidadeGlobal}%`}
          tone="emerald"
          icon={<ActivityIcon size={22} />}
        />
        <SummaryKpi
          label="NCs abertas"
          value={String(totalNCsAbertas)}
          tone="rose"
          icon={<AlertTriangleIcon size={22} />}
        />
        <SummaryKpi
          label="Leituras pendentes"
          value={String(totalPendentesHoje)}
          tone="amber"
          icon={<ClockIcon size={22} />}
        />
        <SummaryKpi
          label="IoT offline"
          value={String(dispositivosOffline)}
          tone="slate"
          icon={<ServerIcon size={22} />}
        />
      </div>

      {proximosAVencer.length > 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <span>
            <strong>{proximosAVencer.length}</strong> termômetro(s) com calibração vencendo nos
            próximos 30 dias.
          </span>
        </div>
      ) : null}

      <SectionHeader title="Monitoramento em tempo real" />
      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Cadastre um equipamento na aba "Equipamentos" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <EquipamentoCard
              key={c.equipamento.id}
              card={c}
              onRegistrar={() => setLeituraRapida(c.equipamento)}
            />
          ))}
        </div>
      )}

      {leituraRapida ? (
        <LeituraRapidaForm
          open
          onClose={() => setLeituraRapida(null)}
          equipamento={leituraRapida}
        />
      ) : null}
    </div>
  );
}

function SummaryKpi({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'rose' | 'amber' | 'slate';
  icon: React.ReactNode;
}) {
  const iconBg =
    tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-600'
      : tone === 'rose'
        ? 'bg-rose-100 text-rose-600'
        : tone === 'amber'
          ? 'bg-amber-100 text-amber-600'
          : 'bg-slate-100 text-slate-600';
  const valueCls = tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-800';
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`text-3xl font-bold ${valueCls}`}>{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

function EquipamentoCard({
  card,
  onRegistrar,
}: {
  card: CardStatusEquipamento;
  onRegistrar: () => void;
}) {
  const { equipamento, ultimaLeitura, dispositivo, ncsAbertas, statusCard, motivo } = card;
  const borderTop = borderForStatusCard(statusCard);
  const tempCls =
    statusCard === 'vermelho' ? 'text-rose-600' : 'text-slate-800';

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 ${borderTop}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="text-base font-semibold leading-tight text-slate-800">
            {equipamento.nome}
          </h4>
          <p className="mt-1 text-xs capitalize text-slate-500">
            {equipamento.tipo.replace('_', ' ')} • {equipamento.localizacao}
          </p>
        </div>
        {dispositivo ? (
          dispositivo.online ? (
            <span className="relative flex h-3 w-3" title="IoT online">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <span className="h-3 w-3 rounded-full bg-slate-300" title="IoT offline" />
          )
        ) : null}
      </div>

      <div className="mb-4 flex items-end gap-3">
        <span className={`text-4xl font-black ${tempCls}`}>
          {ultimaLeitura ? `${ultimaLeitura.temperaturaAtual.toFixed(1)}°C` : '—'}
        </span>
        <div className="mb-1 text-xs text-slate-500">
          <span className="block">Min: {equipamento.limites.temperaturaMin.toFixed(1)}°</span>
          <span className="block">Max: {equipamento.limites.temperaturaMax.toFixed(1)}°</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <StatusBadge tone={toneForStatusCard(statusCard)}>{motivo}</StatusBadge>
        <Button tone="ghost" onClick={onRegistrar}>
          Registrar →
        </Button>
      </div>

      {ncsAbertas > 0 ? (
        <div className="mt-3 rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
          {ncsAbertas} NC{ncsAbertas > 1 ? 's' : ''} aberta{ncsAbertas > 1 ? 's' : ''}
        </div>
      ) : null}
    </div>
  );
}
