'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CalibrationFormProps {
  onSave: (data: {
    calibratedAt: string;
    certificateNumber: string;
    performedBy: string;
    interval: number;
    notes: string;
  }) => Promise<boolean | void>;
  onClose: () => void;
}

export function CalibrationForm({ onSave, onClose }: CalibrationFormProps) {
  const [calibratedAt, setCalibratedAt] = useState(todayString());
  const [certificateNumber, setCertificateNumber] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [interval, setInterval] = useState('12');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!certificateNumber.trim()) return;
    setSaving(true);
    try {
      await onSave({
        calibratedAt: new Date(calibratedAt).toISOString(),
        certificateNumber: certificateNumber.trim(),
        performedBy: performedBy.trim(),
        interval: Number(interval),
        notes: notes.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Record New Calibration">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Calibration Date"
          type="date"
          value={calibratedAt}
          onChange={(e) => setCalibratedAt(e.target.value)}
        />
        <Input
          label="Certificate Number"
          placeholder="e.g. CAL-2026-001"
          value={certificateNumber}
          onChange={(e) => setCertificateNumber(e.target.value)}
          error={!certificateNumber.trim() ? undefined : undefined}
        />
        <Input
          label="Performed By"
          placeholder="Technician name"
          value={performedBy}
          onChange={(e) => setPerformedBy(e.target.value)}
        />
        <Input
          label="Interval (months)"
          type="number"
          min={1}
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          helperText="Default 12 months until next calibration"
        />
        <Textarea
          label="Notes"
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!certificateNumber.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
