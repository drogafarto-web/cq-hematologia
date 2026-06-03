'use client'

import { DataTable } from '@/components/data-table'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'

interface LotsTableProps {
  lots: any[]
  onRowClick: (lot: any) => void
}

export function LotsTable({ lots, onRowClick }: LotsTableProps) {
  const columns = [
    {
      key: 'analyte',
      header: 'Analyte',
      render: (lot: any) => lot.analyte,
    },
    {
      key: 'lotNumber',
      header: 'Lot',
      render: (lot: any) => lot.lotNumber,
    },
    {
      key: 'level',
      header: 'Level',
      render: (lot: any) => `Level ${lot.level}`,
    },
    {
      key: 'reagentName',
      header: 'Reagent',
      render: (lot: any) => lot.reagentName,
    },
    {
      key: 'analyzer',
      header: 'Analyzer',
      render: (lot: any) => lot.analyzer?.model || '-',
    },
    {
      key: 'targetMean',
      header: 'Mean',
      render: (lot: any) => Number(lot.targetMean).toFixed(2),
    },
    {
      key: 'sd',
      header: 'SD',
      render: (lot: any) => Number(lot.sd).toFixed(2),
    },
    {
      key: 'range',
      header: 'Range',
      render: (lot: any) =>
        `${Number(lot.minAcceptance).toFixed(2)} – ${Number(lot.maxAcceptance).toFixed(2)}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (lot: any) => {
        const isActive = lot.status === 'ACTIVE'
        return (
          <Pill variant={isActive ? 'success' : 'neutral'}>
            <span className={cn(!isActive && 'italic')}>
              {isActive
                ? 'Active'
                : lot.status.charAt(0) + lot.status.slice(1).toLowerCase()}
            </span>
          </Pill>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={lots}
      onRowClick={onRowClick}
      emptyState="No lots registered. Add your first above."
    />
  )
}
