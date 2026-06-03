'use client'

import { useState } from 'react'

interface Violation {
  rule: string
  isWarning: boolean
  isReject: boolean
  sdDistance: number
}

interface Run {
  id: string
  value: number
  sdDistance: number
  ruleViolated: string | null
  justification: string | null
}

interface ViolationAlertProps {
  violation: Violation
  run: Run
  onRelease: (justification: string) => void
}

export function ViolationAlert({ violation, run, onRelease }: ViolationAlertProps) {
  const [justification, setJustification] = useState('')
  const [showPanel, setShowPanel] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleRelease() {
    if (justification.length < 10) return
    setSubmitting(true)
    await onRelease(justification)
    setSubmitting(false)
    setShowPanel(false)
    setJustification('')
  }

  return (
    <>
      <div className="bg-error-container px-4 py-3 rounded flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-error text-lg font-bold">!</span>
          <div>
            <p className="text-sm font-semibold text-error">
              Rule Violation: {violation.rule}
            </p>
            <p className="text-xs text-error/80">
              SD Distance: {violation.sdDistance.toFixed(2)} — Justification required
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPanel(true)}
          className="h-10 px-4 bg-error text-white text-sm font-semibold rounded hover:bg-error/90 transition-colors"
        >
          Review
        </button>
      </div>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowPanel(false)} />
          <div className="relative w-full max-w-md bg-white shadow-lg p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-on-surface">Justify Violation</h2>
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                className="text-outline hover:text-on-surface transition-colors text-lg"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-outline">Rule</span>
                <span className="font-mono font-semibold text-error">{violation.rule}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">Value</span>
                <span className="font-mono">{run.value}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">SD Distance</span>
                <span className="font-mono">{violation.sdDistance.toFixed(2)}</span>
              </div>
            </div>

            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Describe the justification (min 10 characters)..."
              rows={4}
              className="w-full px-3 py-2 border border-border rounded text-sm font-sans resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />

            <button
              type="button"
              disabled={justification.length < 10 || submitting}
              onClick={handleRelease}
              className="h-12 w-full bg-primary text-white font-semibold rounded text-sm hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Releasing...' : 'Release with Justification'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
