'use client';

import { useState, useMemo } from 'react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { cn } from '@/lib/utils';
import { deriveAnalyzerStatus } from '@/lib/analyzer-status';
import type { AnalyzerData } from '../analyzers-client';

const statusConfig: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }
> = {
  OPERATIONAL: { label: 'Operational', variant: 'success' },
  CAL_DUE_SOON: { label: 'Cal Due Soon', variant: 'warning' },
  CAL_OVERDUE: { label: 'Cal Overdue', variant: 'error' },
  MAINTENANCE_DUE: { label: 'Maint Due', variant: 'warning' },
  MAINTENANCE_OVERDUE: { label: 'Maint Overdue', variant: 'error' },
  OUT_OF_SERVICE: { label: 'Out of Service', variant: 'neutral' },
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const outcomeVariant: Record<string, 'success' | 'error' | 'warning'> = {
  PASS: 'success',
  FAIL: 'error',
  PENDING_PARTS: 'warning',
};

interface AnalyzerDetailPanelProps {
  analyzer: AnalyzerData;
  onClose: () => void;
  onSave: (id: string, data: Partial<AnalyzerData>) => Promise<boolean>;
  onArchive: (id: string) => void;
  onOpenCalibration: () => void;
  onOpenMaintenance: () => void;
}

export function AnalyzerDetailPanel({
  analyzer,
  onClose,
  onSave,
  onArchive,
  onOpenCalibration,
  onOpenMaintenance,
}: AnalyzerDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    model: analyzer.model,
    manufacturer: analyzer.manufacturer,
    serialNumber: analyzer.serialNumber,
    location: analyzer.location,
    installDate: analyzer.installDate.slice(0, 10),
  });

  const derived = useMemo(
    () => deriveAnalyzerStatus(analyzer as Parameters<typeof deriveAnalyzerStatus>[0]),
    [analyzer],
  );
  const cfg = statusConfig[derived] ?? { label: derived, variant: 'neutral' as const };

  const isCalOverdue = useMemo(() => {
    const latestCal = analyzer.calibrations[0];
    if (!latestCal) return true;
    const due = new Date(latestCal.nextDueAt);
    return due < new Date();
  }, [analyzer.calibrations]);

  async function handleSave() {
    const ok = await onSave(analyzer.id, {
      model: form.model,
      manufacturer: form.manufacturer,
      serialNumber: form.serialNumber,
      location: form.location,
      installDate: new Date(form.installDate).toISOString(),
    } as Partial<AnalyzerData>);
    if (ok) setEditing(false);
  }

  function handleCancel() {
    setForm({
      model: analyzer.model,
      manufacturer: analyzer.manufacturer,
      serialNumber: analyzer.serialNumber,
      location: analyzer.location,
      installDate: analyzer.installDate.slice(0, 10),
    });
    setEditing(false);
  }

  const footer = (
    <>
      <Button variant="outline" onClick={handleCancel}>
        Cancel
      </Button>
      <Button onClick={handleSave}>Save</Button>
      <Button variant="danger" onClick={() => onArchive(analyzer.id)}>
        Archive Analyzer
      </Button>
    </>
  );

  return (
    <Panel open={true} onClose={onClose} title={`Analyzer ${analyzer.analyzerId}`} footer={footer}>
      <div className="flex flex-col gap-6">
        {/* Identification */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
            Identification
          </h3>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-on-surface-variant">ID</span>
                <p className="font-mono text-sm">{analyzer.analyzerId}</p>
              </div>
              <div>
                <span className="text-xs text-on-surface-variant">Status</span>
                <div className="mt-0.5">
                  <Pill variant={cfg.variant} size="sm">
                    {cfg.label}
                  </Pill>
                </div>
              </div>
            </div>
            {editing ? (
              <>
                <Input
                  label="Model"
                  value={form.model}
                  onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                />
                <Input
                  label="Manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))}
                />
                <Input
                  label="Serial Number"
                  value={form.serialNumber}
                  onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))}
                />
                <Input
                  label="Location"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                />
                <Input
                  label="Install Date"
                  type="date"
                  value={form.installDate}
                  onChange={(e) => setForm((p) => ({ ...p, installDate: e.target.value }))}
                />
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-on-surface-variant">Model</span>
                    <p className="text-sm">{analyzer.model}</p>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant">Manufacturer</span>
                    <p className="text-sm">{analyzer.manufacturer}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-on-surface-variant">S/N</span>
                    <p className="font-mono text-sm">{analyzer.serialNumber}</p>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant">Installed</span>
                    <p className="text-sm">{fmt(analyzer.installDate)}</p>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant">Location</span>
                  <p className="text-sm">{analyzer.location}</p>
                </div>
              </>
            )}
            {!editing && (
              <Button variant="text" size="sm" onClick={() => setEditing(true)}>
                Edit Fields
              </Button>
            )}
          </div>
        </section>

        <hr className="border-border" />

        {/* Calibration History */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Calibration History
            </h3>
            <Button size="sm" onClick={onOpenCalibration}>
              Record New Calibration
            </Button>
          </div>
          {isCalOverdue && (
            <Card className="border-l-4 border-l-error mb-3" padding="sm">
              <p className="text-sm text-error font-semibold">Calibration is overdue</p>
            </Card>
          )}
          {analyzer.calibrations.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-2">No calibrations recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-variant">
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Date
                    </th>
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Cert#
                    </th>
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Next Due
                    </th>
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analyzer.calibrations.map((cal) => (
                    <tr key={cal.id} className="border-b border-border">
                      <td className="px-3 py-2">{fmt(cal.calibratedAt)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{cal.certificateNumber}</td>
                      <td
                        className={cn(
                          'px-3 py-2',
                          daysUntil(cal.nextDueAt) < 0 && 'text-error font-semibold',
                        )}
                      >
                        {fmt(cal.nextDueAt)}
                      </td>
                      <td className="px-3 py-2">{cal.performedBy ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* Maintenance History */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Maintenance History
            </h3>
            <Button size="sm" onClick={onOpenMaintenance}>
              Log Maintenance
            </Button>
          </div>
          {analyzer.maintenances.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-2">No maintenance logs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-variant">
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Date
                    </th>
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Type
                    </th>
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Description
                    </th>
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Outcome
                    </th>
                    <th className="text-xs font-semibold text-left px-3 py-2 text-on-surface-variant">
                      Technician
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analyzer.maintenances.map((m) => (
                    <tr key={m.id} className="border-b border-border">
                      <td className="px-3 py-2">{fmt(m.performedAt)}</td>
                      <td className="px-3 py-2">
                        <Pill variant={m.type === 'PREVENTIVE' ? 'info' : 'warning'} size="sm">
                          {m.type === 'PREVENTIVE' ? 'Preventive' : 'Corrective'}
                        </Pill>
                      </td>
                      <td className="px-3 py-2 max-w-[140px] truncate" title={m.description}>
                        {m.description}
                      </td>
                      <td className="px-3 py-2">
                        <Pill variant={outcomeVariant[m.outcome] ?? 'neutral'} size="sm">
                          {m.outcome.replace('_', ' ')}
                        </Pill>
                      </td>
                      <td className="px-3 py-2">{m.technician}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* Traceability */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
            Traceability
          </h3>
          <div className="flex gap-6">
            <div>
              <span className="text-2xl font-semibold text-primary">{analyzer.qcRunCount}</span>
              <p className="text-xs text-on-surface-variant">QC Runs</p>
            </div>
            <div>
              <span
                className={cn(
                  'text-2xl font-semibold',
                  analyzer.openCaCount > 0 ? 'text-error' : 'text-on-surface',
                )}
              >
                {analyzer.openCaCount}
              </span>
              <p className="text-xs text-on-surface-variant">Open CAs</p>
            </div>
          </div>
        </section>
      </div>
    </Panel>
  );
}
