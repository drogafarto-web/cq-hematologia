'use client'

import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
  emptyState?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyState = 'Nenhum registro encontrado.',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center text-on-surface-variant py-12">
        {emptyState}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-variant">
            {columns.map((col) => (
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
          {data.map((item, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(item)}
              className={cn('h-12 border-b border-border hover:bg-surface-variant', onRowClick && 'cursor-pointer')}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 text-on-surface">
                  {col.render ? col.render(item) : (item[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
