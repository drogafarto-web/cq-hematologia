'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

const outcomeOptions = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'PENDING_PARTS', label: 'Pending Parts' },
]

interface MaintenanceFormProps {
  onSave: (data: {
    type: string
    performedAt: string
    description: string
    technician: string
    outcome: string
    nextScheduledAt: string | null
  }) => Promise<boolean | void>
  onClose: () => void
}

export function MaintenanceForm({ onSave, onClose }: MaintenanceFormProps) {
  const [type, setType] = useState<'PREVENTIVE' | 'CORRECTIVE'>('PREVENTIVE')
  const [performedAt, setPerformedAt] = useState(todayString())
  const [description, setDescription] = useState('')
  const [technician, setTechnician] = useState('')
  const [outcome, setOutcome] = useState('PASS')
  const [nextScheduledAt, setNextScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSaving(true)
    try {
      await onSave({
        type,
        performedAt: new Date(performedAt).toISOString(),
        description: description.trim(),
        technician: technician.trim(),
        outcome,
        nextScheduledAt: nextScheduledAt ? new Date(nextScheduledAt).toISOString() : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Log Maintenance">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Date"
          type="date"
          value={performedAt}
          onChange={e => setPerformedAt(e.target.value)}
        />

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Type</legend>
          <div className="flex gap-4">
            {(['PREVENTIVE', 'CORRECTIVE'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="maint-type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="accent-primary"
                />
                <span className="text-sm">{t === 'PREVENTIVE' ? 'Preventive' : 'Corrective'}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Textarea
          label="Description"
          placeholder="Describe the maintenance performed…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          error={!description.trim() ? 'Description is required' : undefined}
        />

        <Input
          label="Technician"
          placeholder="Technician name"
          value={technician}
          onChange={e => setTechnician(e.target.value)}
        />

        <Select
          label="Outcome"
          options={outcomeOptions}
          value={outcome}
          onChange={e => setOutcome(e.target.value)}
        />

        <Input
          label="Next Scheduled Date (optional)"
          type="date"
          value={nextScheduledAt}
          onChange={e => setNextScheduledAt(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!description.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
