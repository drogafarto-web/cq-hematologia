'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { QuickAddForm } from './components/quick-add-form';
import { ViolationAlert } from './components/violation-alert';
import { RecentRunsTable } from './components/recent-runs-table';
import { RunDetailPanel } from './components/run-detail-panel';

interface Lot {
  id: string;
  lotNumber: string;
  analyte: string;
  level: number;
  reagentName: string;
  analyzer: { id: string; analyzerId: string; model: string };
  targetMean: number;
  sd: number;
  minAcceptance: number;
  maxAcceptance: number;
}

interface Run {
  id: string;
  value: number;
  sdDistance: number;
  ruleViolated: string | null;
  isReject: boolean;
  isWarning: boolean;
  status: string;
  justification: string | null;
  runAt: string;
  operator: { name: string };
  lot: Lot;
}

interface Violation {
  rule: string;
  isWarning: boolean;
  isReject: boolean;
  sdDistance: number;
}

export function QcControlClient({ lots }: { lots: Lot[] }) {
  const [selectedLotId, setSelectedLotId] = useState('');
  const [chartData, setChartData] = useState<{
    referenceLines: Record<string, number>;
    dataPoints: { value: number; runAt: string }[];
  } | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [pendingViolation, setPendingViolation] = useState<{
    run: Run;
    violation: Violation;
  } | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);

  const fetchChartData = useCallback(async (lotId: string) => {
    try {
      const res = await fetch(`/api/qc/chart?lotId=${lotId}&days=30`);
      const json = await res.json();
      if (json.success) setChartData(json.data);
    } catch {
      toast.error('Failed to load chart data');
    }
  }, []);

  const fetchRecentRuns = useCallback(async (lotId: string) => {
    try {
      const res = await fetch(`/api/qc?lotId=${lotId}&limit=20`);
      const json = await res.json();
      if (json.success) setRecentRuns(json.data);
    } catch {
      toast.error('Failed to load recent runs');
    }
  }, []);

  useEffect(() => {
    if (selectedLotId) {
      fetchChartData(selectedLotId);
      fetchRecentRuns(selectedLotId);
    }
  }, [selectedLotId, fetchChartData, fetchRecentRuns]);

  async function handleQuickAdd(value: number) {
    if (!selectedLotId) return;
    try {
      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotId: selectedLotId, value }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || 'Failed to save run');
        return;
      }
      if (json.violation?.rule && !json.violation.isWarning) {
        setPendingViolation({ run: json.data, violation: json.violation });
        toast('Violation detected - justification required', { icon: '⚠️' });
      } else if (json.violation?.rule && json.violation.isWarning) {
        toast('Warning: ' + json.violation.rule, { icon: '⚡' });
      } else {
        toast.success('Run saved successfully');
      }
      fetchRecentRuns(selectedLotId);
      fetchChartData(selectedLotId);
    } catch {
      toast.error('Failed to save run');
    }
  }

  async function handleRelease(justification: string) {
    if (!pendingViolation) return;
    try {
      const res = await fetch(`/api/qc/${pendingViolation.run.id}/release`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justification }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || 'Failed to release');
        return;
      }
      toast.success('Run released with justification');
      setPendingViolation(null);
      fetchRecentRuns(selectedLotId);
    } catch {
      toast.error('Failed to release run');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-on-surface">QC Control</h1>

      <QuickAddForm
        lots={lots}
        selectedLotId={selectedLotId}
        onSelectLot={setSelectedLotId}
        onSave={handleQuickAdd}
        pendingViolation={pendingViolation}
      />

      {pendingViolation && (
        <ViolationAlert
          violation={pendingViolation.violation}
          run={pendingViolation.run}
          onRelease={handleRelease}
        />
      )}

      <RecentRunsTable runs={recentRuns} onSelectRun={(r) => setSelectedRun(r)} />

      {selectedRun && (
        <RunDetailPanel
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onRelease={handleRelease}
        />
      )}
    </div>
  );
}
