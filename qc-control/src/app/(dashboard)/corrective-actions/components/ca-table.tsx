'use client';

import { Pill } from '@/components/ui/pill';

interface CAOperator {
  name: string;
}
interface CAInvestigator {
  name: string;
}
interface CALot {
  lotNumber: string;
  analyte: string;
  reagentName: string;
  analyzer: { analyzerId: string };
}

interface TableAction {
  id: string;
  caNumber: string;
  openedAt: string;
  analyte: string;
  ruleViolated: string | null;
  status: string;
  investigator: CAInvestigator | null;
  lot: CALot | null;
  closedAt: string | null;
}

interface CATableProps {
  actions: TableAction[];
  onSelect: (action: TableAction) => void;
}

const statusConfig: Record<
  string,
  { variant: 'error' | 'warning' | 'info' | 'success'; label: string }
> = {
  OPEN: { variant: 'error', label: 'Open' },
  IN_PROGRESS: { variant: 'warning', label: 'In Progress' },
  UNDER_VERIFICATION: { variant: 'info', label: 'Under Verification' },
  CLOSED: { variant: 'success', label: 'Closed' },
};

function getAgeDays(openedAt: string, closedAt: string | null): number {
  const start = new Date(openedAt);
  const end = closedAt ? new Date(closedAt) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function CATable({ actions, onSelect }: CATableProps) {
  if (actions.length === 0) {
    return (
      <div className="text-center text-on-surface-variant py-12 text-sm border border-border rounded">
        No corrective actions found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-variant text-left">
            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">
              CA#
            </th>
            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">
              Date Opened
            </th>
            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">
              Analyte · Lot
            </th>
            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">
              Rule
            </th>
            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">
              Investigator
            </th>
            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">
              Status
            </th>
            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">
              Age
            </th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => {
            const age = getAgeDays(a.openedAt, a.closedAt);
            const config = statusConfig[a.status] || {
              variant: 'neutral' as const,
              label: a.status,
            };
            const date = new Date(a.openedAt);
            return (
              <tr
                key={a.id}
                onClick={() => onSelect(a)}
                className="border-t border-border hover:bg-surface-variant/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-mono font-semibold text-primary">{a.caNumber}</td>
                <td className="px-4 py-3 font-mono text-xs">{date.toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-xs">
                  {a.lot ? (
                    <span>
                      {a.analyte}
                      <span className="text-outline"> · </span>
                      <span className="font-mono">{a.lot.lotNumber}</span>
                    </span>
                  ) : (
                    a.analyte
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.ruleViolated ? (
                    <span className="font-mono text-xs font-semibold text-error">
                      {a.ruleViolated}
                    </span>
                  ) : (
                    <span className="text-outline">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {a.investigator?.name || <span className="text-outline">—</span>}
                </td>
                <td className="px-4 py-3">
                  <Pill variant={config.variant} size="sm">
                    {config.label}
                  </Pill>
                </td>
                <td
                  className={`px-4 py-3 font-mono text-xs ${age > 14 ? 'text-error font-bold' : ''}`}
                >
                  {age}d
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
