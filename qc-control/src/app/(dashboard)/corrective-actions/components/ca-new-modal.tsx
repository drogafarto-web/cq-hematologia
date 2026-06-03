'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface User {
  id: string;
  name: string;
}

interface CANewModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (action: unknown) => void;
  prefillLot?: string;
  prefillRule?: string;
  users: User[];
  currentUserId: string;
}

const RULE_OPTIONS = ['1-3S', '2-2S', 'R-4S', '4-1S', '10X'];

export function CANewModal({
  open,
  onClose,
  onCreated,
  prefillLot,
  prefillRule,
  users,
  currentUserId,
}: CANewModalProps) {
  const [analyte, setAnalyte] = useState('');
  const [linkedLot, setLinkedLot] = useState('');
  const [ruleViolated, setRuleViolated] = useState('');
  const [investigatorId, setInvestigatorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [lots, setLots] = useState<{ id: string; lotNumber: string; analyte: string }[]>([]);

  useEffect(() => {
    if (open) {
      if (prefillRule) setRuleViolated(prefillRule);
      if (prefillLot) setLinkedLot(prefillLot);
      fetchLots();
    } else {
      setAnalyte('');
      setLinkedLot('');
      setRuleViolated('');
      setInvestigatorId('');
    }
  }, [open, prefillLot, prefillRule]);

  async function fetchLots() {
    try {
      const res = await fetch('/api/lots');
      const json = await res.json();
      if (json.success) setLots(json.data);
    } catch {}
  }

  async function handleCreate() {
    if (!analyte) {
      toast.error('Analyte is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/corrective-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyte,
          lotId: linkedLot || undefined,
          ruleViolated: ruleViolated || undefined,
          investigatorId: investigatorId || undefined,
          operatorId: currentUserId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || 'Failed to create corrective action');
        return;
      }
      toast.success(`Created ${json.data.caNumber}`);
      onCreated(json.data);
    } catch {
      toast.error('Failed to create corrective action');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Corrective Action">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Analyte <span className="text-error">*</span>
          </label>
          <input
            value={analyte}
            onChange={(e) => setAnalyte(e.target.value)}
            placeholder="e.g. Glucose, Creatinine..."
            className="h-12 px-4 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Linked Lot
          </label>
          <select
            value={linkedLot}
            onChange={(e) => setLinkedLot(e.target.value)}
            className="h-12 px-4 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">None</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNumber} - {lot.analyte}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Rule Violated
          </label>
          <select
            value={ruleViolated}
            onChange={(e) => setRuleViolated(e.target.value)}
            className="h-12 px-4 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">None</option>
            {RULE_OPTIONS.map((rule) => (
              <option key={rule} value={rule}>
                {rule}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Investigator
          </label>
          <select
            value={investigatorId}
            onChange={(e) => setInvestigatorId(e.target.value)}
            className="h-12 px-4 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">Not assigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
