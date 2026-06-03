'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const quickAddSchema = z.object({
  value: z.coerce.number().positive('Value must be positive'),
  justification: z.string().min(10, 'Justification must be at least 10 characters').optional().or(z.literal('')),
})

type QuickAddFormData = z.infer<typeof quickAddSchema>

interface Lot {
  id: string
  lotNumber: string
  analyte: string
  level: number
  reagentName: string
  analyzer: { id: string; analyzerId: string; model: string }
}

interface Violation {
  rule: string
  isWarning: boolean
  isReject: boolean
  sdDistance: number
}

interface QuickAddFormProps {
  lots: Lot[]
  selectedLotId: string
  onSelectLot: (id: string) => void
  onSave: (value: number) => void
  pendingViolation: { run: { id: string }; violation: Violation } | null
}

export function QuickAddForm({ lots, selectedLotId, onSelectLot, onSave, pendingViolation }: QuickAddFormProps) {
  const selectedLot = lots.find(l => l.id === selectedLotId)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<QuickAddFormData>({
    resolver: zodResolver(quickAddSchema),
  })

  function onSubmit(data: QuickAddFormData) {
    onSave(data.value)
    reset({ value: undefined, justification: '' })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-outline">Lot</label>
          <select
            value={selectedLotId}
            onChange={(e) => onSelectLot(e.target.value)}
            className="h-12 min-w-[240px] px-3 border border-border rounded text-sm bg-white font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">Select lot...</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNumber} - {lot.analyte}
              </option>
            ))}
          </select>
        </div>

        {selectedLot && (
          <div className="flex items-center gap-2 self-end pb-1">
            <span className="px-3 py-1.5 bg-surface-variant rounded text-xs font-mono text-on-surface-variant">
              Lot: {selectedLot.lotNumber}
            </span>
            <span className="px-3 py-1.5 bg-surface-variant rounded text-xs font-mono text-on-surface-variant">
              Level: {selectedLot.level}
            </span>
            <span className="px-3 py-1.5 bg-surface-variant rounded text-xs font-mono text-on-surface-variant">
              Reagent: {selectedLot.reagentName}
            </span>
            <span className="px-3 py-1.5 bg-surface-variant rounded text-xs font-mono text-on-surface-variant">
              {selectedLot.analyzer.analyzerId}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-outline">Value</label>
          <input
            type="number"
            step="any"
            disabled={!selectedLotId}
            {...register('value')}
            className="h-12 w-48 px-4 border border-border rounded text-lg font-mono text-center bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {errors.value && <p className="text-xs text-error">{errors.value.message}</p>}
        </div>

        <button
          type="submit"
          disabled={!selectedLotId || isSubmitting}
          className="h-12 px-8 bg-primary text-white font-semibold rounded text-sm hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
