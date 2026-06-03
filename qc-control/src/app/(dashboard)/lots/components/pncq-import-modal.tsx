'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const analytes = [
  { value: 'PT-INR', label: 'PT-INR' },
  { value: 'APTT', label: 'APTT' },
  { value: 'Fibrinogen', label: 'Fibrinogen' },
  { value: 'TT', label: 'TT' },
  { value: 'D-Dimer', label: 'D-Dimer' },
]

interface PncqImportModalProps {
  open: boolean
  onClose: () => void
  analyzers: any[]
  onImported: (data: any) => void
}

export function PncqImportModal({ open, onClose, onImported }: PncqImportModalProps) {
  const [referenceNumber, setReferenceNumber] = useState('')
  const [analyte, setAnalyte] = useState('')
  const [fetching, setFetching] = useState(false)
  const [preview, setPreview] = useState<any | null>(null)
  const [error, setError] = useState('')

  const handleFetch = async () => {
    if (!analyte) return
    setFetching(true)
    setError('')
    try {
      const res = await fetch('/api/lots/import-pncq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyte, referenceNumber: referenceNumber || undefined }),
      })
      const json = await res.json()
      if (json.success) {
        setPreview(json.data)
      } else {
        setError(json.error?.message || 'Fetch failed')
      }
    } catch {
      setError('Failed to connect to PNCQ service')
    } finally {
      setFetching(false)
    }
  }

  const handleConfirm = () => {
    onImported(preview)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Import from PNCQ">
      <div className="space-y-4">
        <Input
          label="PNCQ Reference Number"
          placeholder="e.g. 2024-001"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
        />

        <Select
          label="Analyte"
          options={analytes}
          placeholder="Select analyte"
          value={analyte}
          onChange={(e) => setAnalyte(e.target.value)}
        />

        <Button onClick={handleFetch} loading={fetching} className="w-full">
          Fetch from PNCQ
        </Button>

        {error && <p className="text-xs text-error">{error}</p>}

        {preview && (
          <div className="border border-border rounded p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Preview
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-on-surface-variant">Source:</span> {preview.source}
              </div>
              <div>
                <span className="text-on-surface-variant">Analyte:</span> {preview.analyte}
              </div>
              <div>
                <span className="text-on-surface-variant">Target Mean:</span>{' '}
                {preview.targetMean}
              </div>
              <div>
                <span className="text-on-surface-variant">SD:</span> {preview.sd}
              </div>
              <div>
                <span className="text-on-surface-variant">Min Acceptance:</span>{' '}
                {preview.minAcceptance}
              </div>
              <div>
                <span className="text-on-surface-variant">Max Acceptance:</span>{' '}
                {preview.maxAcceptance}
              </div>
            </div>

            <Button onClick={handleConfirm} className="w-full">
              Confirm & Create
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
