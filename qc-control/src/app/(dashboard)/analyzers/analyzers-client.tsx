'use client'

import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { AnalyzersTable } from './components/analyzers-table'
import { AnalyzerDetailPanel } from './components/analyzer-detail-panel'
import { CalibrationForm } from './components/calibration-form'
import { MaintenanceForm } from './components/maintenance-form'

interface CalibrationData {
  id: string
  analyzerId: string
  calibratedAt: string
  nextDueAt: string
  certificateNumber: string
  interval: number
  performedBy: string | null
  notes: string | null
  createdAt: string
}

interface MaintenanceData {
  id: string
  analyzerId: string
  type: string
  performedAt: string
  description: string
  technician: string
  outcome: string
  nextScheduledAt: string | null
  createdAt: string
}

export interface AnalyzerData {
  id: string
  analyzerId: string
  model: string
  manufacturer: string
  serialNumber: string
  location: string
  installDate: string
  status: string
  archived: boolean
  createdAt: string
  updatedAt: string
  calibrations: CalibrationData[]
  maintenances: MaintenanceData[]
  _count: { lots: number }
  qcRunCount: number
  openCaCount: number
}

interface AnalyzersClientProps {
  analyzers: AnalyzerData[]
}

export function AnalyzersClient({ analyzers: initial }: AnalyzersClientProps) {
  const [analyzers, setAnalyzers] = useState(initial)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAnalyzerId, setSelectedAnalyzerId] = useState<string | null>(null)
  const [showCalibrationForm, setShowCalibrationForm] = useState(false)
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAnalyzer, setNewAnalyzer] = useState({
    analyzerId: '',
    model: '',
    manufacturer: '',
    serialNumber: '',
    location: '',
    installDate: new Date().toISOString().slice(0, 10),
  })

  const selectedAnalyzer = useMemo(
    () => analyzers.find(a => a.id === selectedAnalyzerId) ?? null,
    [analyzers, selectedAnalyzerId],
  )

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return analyzers
    const q = searchQuery.toLowerCase()
    return analyzers.filter(
      a =>
        a.analyzerId.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.manufacturer.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q),
    )
  }, [analyzers, searchQuery])

  async function handleSaveAnalyzer(id: string, data: Partial<AnalyzerData>) {
    try {
      const res = await fetch(`/api/analyzers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to update analyzer')
        return false
      }
      setAnalyzers(prev => prev.map(a => (a.id === id ? { ...a, ...data } : a)))
      toast.success('Analyzer updated')
      return true
    } catch {
      toast.error('Failed to update analyzer')
      return false
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive this analyzer? It will be marked out of service.')) return
    try {
      const res = await fetch(`/api/analyzers/${id}/archive`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to archive')
        return
      }
      setAnalyzers(prev =>
        prev.map(a => (a.id === id ? { ...a, archived: true, status: 'OUT_OF_SERVICE' } : a)),
      )
      toast.success('Analyzer archived')
      setSelectedAnalyzerId(null)
    } catch {
      toast.error('Failed to archive analyzer')
    }
  }

  async function handleCalibrate(data: {
    calibratedAt: string
    certificateNumber: string
    performedBy: string
    interval: number
    notes: string
  }) {
    if (!selectedAnalyzerId) return
    try {
      const res = await fetch(`/api/analyzers/${selectedAnalyzerId}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to record calibration')
        return false
      }
      const cal = {
        ...json.data,
        calibratedAt: json.data.calibratedAt,
        nextDueAt: json.data.nextDueAt,
        createdAt: json.data.createdAt,
      }
      setAnalyzers(prev =>
        prev.map(a =>
          a.id === selectedAnalyzerId
            ? { ...a, calibrations: [cal, ...a.calibrations], status: 'OPERATIONAL' as const }
            : a,
        ),
      )
      toast.success('Calibration recorded')
      setShowCalibrationForm(false)
      return true
    } catch {
      toast.error('Failed to record calibration')
      return false
    }
  }

  async function handleMaintenance(data: {
    type: string
    performedAt: string
    description: string
    technician: string
    outcome: string
    nextScheduledAt: string | null
  }) {
    if (!selectedAnalyzerId) return
    try {
      const res = await fetch(`/api/analyzers/${selectedAnalyzerId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to log maintenance')
        return false
      }
      const maint = {
        ...json.data,
        performedAt: json.data.performedAt,
        createdAt: json.data.createdAt,
        nextScheduledAt: json.data.nextScheduledAt ?? null,
      }
      setAnalyzers(prev =>
        prev.map(a =>
          a.id === selectedAnalyzerId
            ? { ...a, maintenances: [maint, ...a.maintenances] }
            : a,
        ),
      )
      toast.success('Maintenance logged')
      setShowMaintenanceForm(false)
      return true
    } catch {
      toast.error('Failed to log maintenance')
      return false
    }
  }

  async function handleCreate() {
    try {
      const body = {
        ...newAnalyzer,
        installDate: new Date(newAnalyzer.installDate).toISOString(),
      }
      const res = await fetch('/api/analyzers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to create analyzer')
        return
      }
      toast.success('Analyzer created')
      setShowCreateForm(false)
      setNewAnalyzer({ analyzerId: '', model: '', manufacturer: '', serialNumber: '', location: '', installDate: new Date().toISOString().slice(0, 10) })
      window.location.reload()
    } catch {
      toast.error('Failed to create analyzer')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-on-surface">Analyzers</h1>
        <Button onClick={() => setShowCreateForm(true)}>Add Analyzer</Button>
      </div>

      <div className="max-w-sm">
        <Input
          label="Search"
          placeholder="Search by ID, model, manufacturer, location..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <AnalyzersTable data={filtered} onSelect={setSelectedAnalyzerId} />

      {selectedAnalyzer && (
        <AnalyzerDetailPanel
          analyzer={selectedAnalyzer}
          onClose={() => setSelectedAnalyzerId(null)}
          onSave={handleSaveAnalyzer}
          onArchive={handleArchive}
          onOpenCalibration={() => setShowCalibrationForm(true)}
          onOpenMaintenance={() => setShowMaintenanceForm(true)}
        />
      )}

      {showCalibrationForm && (
        <CalibrationForm
          onSave={handleCalibrate}
          onClose={() => setShowCalibrationForm(false)}
        />
      )}

      {showMaintenanceForm && (
        <MaintenanceForm
          onSave={handleMaintenance}
          onClose={() => setShowMaintenanceForm(false)}
        />
      )}

      <Modal
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="Add Analyzer"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Analyzer ID"
            value={newAnalyzer.analyzerId}
            onChange={e => setNewAnalyzer(prev => ({ ...prev, analyzerId: e.target.value }))}
          />
          <Input
            label="Model"
            value={newAnalyzer.model}
            onChange={e => setNewAnalyzer(prev => ({ ...prev, model: e.target.value }))}
          />
          <Input
            label="Manufacturer"
            value={newAnalyzer.manufacturer}
            onChange={e => setNewAnalyzer(prev => ({ ...prev, manufacturer: e.target.value }))}
          />
          <Input
            label="Serial Number"
            value={newAnalyzer.serialNumber}
            onChange={e => setNewAnalyzer(prev => ({ ...prev, serialNumber: e.target.value }))}
          />
          <Input
            label="Location"
            value={newAnalyzer.location}
            onChange={e => setNewAnalyzer(prev => ({ ...prev, location: e.target.value }))}
          />
          <Input
            label="Install Date"
            type="date"
            value={newAnalyzer.installDate}
            onChange={e => setNewAnalyzer(prev => ({ ...prev, installDate: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
