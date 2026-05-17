import { useMemo } from 'react';
import { useTurnos } from '../hooks/useTurnos';
import type { Turno } from '../types/Turno';

export function CoberturaTab() {
  const { turnos, isLoading } = useTurnos();

  const nonDeleted = useMemo(() => turnos.filter((t) => !t.deletadoEm), [turnos]);

  const stats = useMemo(() => {
    const registered = nonDeleted.filter((t) => !t.inferred).length;
    const inferred = nonDeleted.filter((t) => t.inferred).length;
    const total = nonDeleted.length;

    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);

    let daysWithCoverage = 0;
    const daySet = new Set<string>();
    for (const t of nonDeleted) {
      daySet.add(t.data);
    }
    daysWithCoverage = daySet.size;
    const coveragePercent = Math.round((daysWithCoverage / 90) * 100);

    return { total, registered, inferred, coveragePercent };
  }, [nonDeleted]);

  const heatmapData = useMemo(() => {
    const today = new Date();
    const days: { date: Date; iso: string; status: 'registered' | 'inferred' | 'missing' }[] = [];

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const dayTurnos = nonDeleted.filter((t) => t.data === iso);
      let status: 'registered' | 'inferred' | 'missing' = 'missing';
      if (dayTurnos.some((t) => !t.inferred)) status = 'registered';
      else if (dayTurnos.some((t) => t.inferred)) status = 'inferred';

      days.push({ date: d, iso, status });
    }
    return days;
  }, [nonDeleted]);

  const statusColors = {
    registered: 'var(--success-500, #10B981)',
    inferred: 'var(--warning-500, #F59E0B)',
    missing: 'rgba(239, 68, 68, 0.4)',
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg" style={{ background: 'var(--surface-muted, #161B23)' }} />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-lg" style={{ background: 'var(--surface-muted, #161B23)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total 90d', value: stats.total, color: 'var(--accent-600, #2563EB)' },
          { label: 'Registrados', value: stats.registered, color: 'var(--success-500, #10B981)' },
          { label: 'Inferidos', value: stats.inferred, color: 'var(--warning-500, #F59E0B)' },
          { label: 'Cobertura', value: `${stats.coveragePercent}%`, color: stats.coveragePercent >= 80 ? 'var(--success-500, #10B981)' : 'var(--danger-500, #EF4444)' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden rounded-lg p-4"
            style={{
              background: 'var(--surface-card, #11161D)',
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: kpi.color }}
            />
            <p
              className="font-semibold uppercase"
              style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text-faint, #64748B)' }}
            >
              {kpi.label}
            </p>
            <p
              className="mt-1 font-semibold"
              style={{ fontSize: '20px', color: 'var(--text-strong, #fff)' }}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'var(--surface-card, #11161D)',
          border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        }}
      >
        <h3
          className="mb-4 font-semibold"
          style={{ fontSize: '14px', color: 'var(--text-strong, #fff)' }}
        >
          Cobertura — últimos 90 dias
        </h3>

        <div className="flex flex-wrap gap-1">
          {heatmapData.map((day) => (
            <div
              key={day.iso}
              className="h-3 w-3 rounded-sm transition-transform hover:scale-150"
              style={{ background: statusColors[day.status] }}
              title={`${day.iso} — ${day.status === 'registered' ? 'Registrado' : day.status === 'inferred' ? 'Inferido' : 'Sem cobertura'}`}
              aria-label={`${day.iso}: ${day.status}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4">
          {[
            { label: 'Registrado', color: statusColors.registered },
            { label: 'Inferido', color: statusColors.inferred },
            { label: 'Sem cobertura', color: statusColors.missing },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
