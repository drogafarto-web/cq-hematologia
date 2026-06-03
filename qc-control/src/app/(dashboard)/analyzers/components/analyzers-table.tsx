'use client'

import { cn } from '@/lib/utils'
import { Pill } from '@/components/ui/pill'
import { DataTable } from '@/components/data-table'
import { deriveAnalyzerStatus } from '@/lib/analyzer-status'
import type { AnalyzerData } from '../analyzers-client'

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
  OPERATIONAL: { label: 'Operational', variant: 'success' },
  CAL_DUE_SOON: { label: 'Cal Due Soon', variant: 'warning' },
  CAL_OVERDUE: { label: 'Cal Overdue', variant: 'error' },
  MAINTENANCE_DUE: { label: 'Maint Due', variant: 'warning' },
  MAINTENANCE_OVERDUE: { label: 'Maint Overdue', variant: 'error' },
  OUT_OF_SERVICE: { label: 'Out of Service', variant: 'neutral' },
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

interface AnalyzersTableProps {
  data: AnalyzerData[]
  onSelect: (id: string) => void
}

export function AnalyzersTable({ data, onSelect }: AnalyzersTableProps) {
  const columns = [
    {
      key: 'analyzerId',
      header: 'ID',
      render: (item: AnalyzerData) => (
        <span className={cn('font-mono text-sm', item.archived && 'opacity-50')}>{item.analyzerId}</span>
      ),
    },
    {
      key: 'model',
      header: 'Model · Manufacturer',
      render: (item: AnalyzerData) => (
        <span className={cn(item.archived && 'opacity-50')}>
          {item.model}
          <span className="text-on-surface-variant"> · {item.manufacturer}</span>
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (item: AnalyzerData) => (
        <span className={cn('text-sm', item.archived && 'opacity-50')}>{item.location}</span>
      ),
    },
    {
      key: 'lastCal',
      header: 'Last Cal',
      render: (item: AnalyzerData) => {
        const cal = item.calibrations[0]
        return (
          <span className={cn('text-sm', item.archived && 'opacity-50')}>
            {cal ? fmt(cal.calibratedAt) : '—'}
          </span>
        )
      },
    },
    {
      key: 'calDue',
      header: 'Cal Due',
      render: (item: AnalyzerData) => {
        const cal = item.calibrations[0]
        if (!cal) return <span className="text-error text-sm font-semibold">Overdue</span>
        const due = cal.nextDueAt
        const days = daysUntil(due)
        return (
          <span
            className={cn(
              'text-sm font-semibold',
              days < 0 && 'text-error',
              days >= 0 && days <= 30 && 'text-warning',
              days > 30 && 'text-on-surface',
              item.archived && 'opacity-50',
            )}
          >
            {fmt(due)}
          </span>
        )
      },
    },
    {
      key: 'lastMaint',
      header: 'Last Maint',
      render: (item: AnalyzerData) => {
        const maint = item.maintenances[0]
        return (
          <span className={cn('text-sm', item.archived && 'opacity-50')}>
            {maint ? fmt(maint.performedAt) : '—'}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: AnalyzerData) => {
        const derived = deriveAnalyzerStatus(item as Parameters<typeof deriveAnalyzerStatus>[0])
        const cfg = statusConfig[derived] ?? { label: derived, variant: 'neutral' as const }
        return <Pill variant={cfg.variant} size="sm">{cfg.label}</Pill>
      },
    },
  ]

  const rowClass = (item: AnalyzerData) => cn(item.archived && 'opacity-50')

  if (data.length === 0) {
    return (
      <div className="text-center text-on-surface-variant py-12">
        No analyzers registered.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-variant">
            {columns.map(col => (
              <th
                key={col.key}
                className="text-xs uppercase font-semibold tracking-wider text-on-surface-variant text-left px-4 py-3"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                'h-12 border-b border-border hover:bg-surface-variant cursor-pointer',
                rowClass(item),
              )}
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 text-on-surface">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
