'use client'

interface Lot {
  id: string
  lotNumber: string
  analyte: string
  level: number
  reagentName: string
  analyzer: { id: string; analyzerId: string; model: string }
  targetMean: number
  sd: number
  minAcceptance: number
  maxAcceptance: number
}

interface Run {
  id: string
  value: number
  sdDistance: number
  ruleViolated: string | null
  isReject: boolean
  isWarning: boolean
  status: string
  justification: string | null
  runAt: string
  operator: { name: string }
  lot: Lot
}

interface RecentRunsTableProps {
  runs: Run[]
  onSelectRun: (run: Run) => void
}

function RulePill({ rule, isReject, isWarning }: { rule: string | null; isReject: boolean; isWarning: boolean }) {
  if (!rule) return null
  const bg = isReject ? 'bg-error-container text-error' : isWarning ? 'bg-warning-container text-warning' : 'bg-surface-variant text-on-surface-variant'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${bg}`}>
      {rule}
    </span>
  )
}

export function RecentRunsTable({ runs, onSelectRun }: RecentRunsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-outline">Recent Runs</h2>
        <p className="text-sm text-outline">No runs recorded yet. Select a lot and add a value above.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-outline">Recent Runs</h2>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-variant text-left">
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Date</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Time</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Lot</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Level</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Result</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">±SD</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Rule</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Justification</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-outline">Operator</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const date = new Date(run.runAt)
              return (
                <tr
                  key={run.id}
                  onClick={() => onSelectRun(run)}
                  className="border-t border-border hover:bg-surface-variant/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs">{date.toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 font-mono text-xs">{date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 font-mono text-xs">{run.lot.lotNumber}</td>
                  <td className="px-4 py-3">{run.lot.level}</td>
                  <td className="px-4 py-3 font-mono">{run.value.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{(run.sdDistance >= 0 ? '+' : '') + run.sdDistance.toFixed(2)}</td>
                  <td className="px-4 py-3"><RulePill rule={run.ruleViolated} isReject={run.isReject} isWarning={run.isWarning} /></td>
                  <td className="px-4 py-3 text-xs text-outline max-w-[160px] truncate">{run.justification || '—'}</td>
                  <td className="px-4 py-3 text-xs">{run.operator.name}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
