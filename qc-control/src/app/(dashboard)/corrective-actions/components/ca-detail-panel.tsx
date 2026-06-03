'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { CATimeline, type TimelineEntry } from './ca-timeline';

interface User {
  id: string;
  name: string;
}

interface CAOperator {
  id: string;
  name: string;
}
interface CAInvestigator {
  id: string;
  name: string;
}
interface CAVerifiedBy {
  id: string;
  name: string;
}
interface CALot {
  lotNumber: string;
  analyte: string;
  reagentName: string;
  analyzer: { analyzerId: string };
}

interface CADetail {
  id: string;
  caNumber: string;
  openedAt: string;
  analyte: string;
  lotId: string | null;
  equipmentId: string | null;
  ruleViolated: string | null;
  status: string;
  operatorId: string;
  investigatorId: string | null;
  rootCause: string | null;
  supportingEvidence: string | null;
  actionTaken: string | null;
  preventiveMeasure: string | null;
  targetCompletionAt: string | null;
  effectivenessCheck: string | null;
  verifiedById: string | null;
  verificationAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  operator: CAOperator;
  investigator: CAInvestigator | null;
  verifiedBy: CAVerifiedBy | null;
  lot: CALot | null;
}

interface CADetailPanelProps {
  ca: CADetail;
  users: User[];
  onClose: () => void;
  onUpdate: (updated: CADetail) => void;
  onStatusChange: (updated: CADetail) => void;
}

const statusConfig: Record<
  string,
  { variant: 'error' | 'warning' | 'info' | 'success'; label: string }
> = {
  OPEN: { variant: 'error', label: 'Open' },
  IN_PROGRESS: { variant: 'warning', label: 'In Progress' },
  UNDER_VERIFICATION: { variant: 'info', label: 'Under Verification' },
  CLOSED: { variant: 'success', label: 'Closed' },
};

function SectionGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</div>;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className={`text-sm ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-outline">—</span>}
      </span>
    </div>
  );
}

export function CADetailPanel({
  ca,
  users,
  onClose,
  onUpdate,
  onStatusChange,
}: CADetailPanelProps) {
  const [activeSection, setActiveSection] = useState('identification');
  const [investigatorId, setInvestigatorId] = useState(ca.investigatorId || '');
  const [rootCause, setRootCause] = useState(ca.rootCause || '');
  const [supportingEvidence, setSupportingEvidence] = useState(ca.supportingEvidence || '');
  const [actionTaken, setActionTaken] = useState(ca.actionTaken || '');
  const [preventiveMeasure, setPreventiveMeasure] = useState(ca.preventiveMeasure || '');
  const [targetCompletionAt, setTargetCompletionAt] = useState(
    ca.targetCompletionAt ? ca.targetCompletionAt.split('T')[0] : '',
  );
  const [effectivenessCheck, setEffectivenessCheck] = useState(ca.effectivenessCheck || '');
  const [verifiedById, setVerifiedById] = useState(ca.verifiedById || '');
  const [verificationAt, setVerificationAt] = useState(
    ca.verificationAt ? ca.verificationAt.split('T')[0] : '',
  );
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    setInvestigatorId(ca.investigatorId || '');
    setRootCause(ca.rootCause || '');
    setSupportingEvidence(ca.supportingEvidence || '');
    setActionTaken(ca.actionTaken || '');
    setPreventiveMeasure(ca.preventiveMeasure || '');
    setTargetCompletionAt(ca.targetCompletionAt ? ca.targetCompletionAt.split('T')[0] : '');
    setEffectivenessCheck(ca.effectivenessCheck || '');
    setVerifiedById(ca.verifiedById || '');
    setVerificationAt(ca.verificationAt ? ca.verificationAt.split('T')[0] : '');
    setActiveSection('identification');
    fetchTimeline();
  }, [ca.id]);

  async function fetchTimeline() {
    try {
      const res = await fetch(`/api/audit-logs?entityType=CorrectiveAction&entityId=${ca.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data?.length) {
          setTimeline(
            json.data.map((e: { action: string; createdAt: string }) => ({
              type: e.action === 'STATUS_CHANGE' ? ('status_change' as const) : ('update' as const),
              description: e.action,
              timestamp: e.createdAt,
            })),
          );
          return;
        }
      }
    } catch {}
    const entries: TimelineEntry[] = [
      { type: 'created', description: `CA opened by ${ca.operator.name}`, timestamp: ca.openedAt },
    ];
    if (ca.closedAt) {
      entries.push({ type: 'status_change', description: 'CA closed', timestamp: ca.closedAt });
    }
    setTimeline(entries);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/corrective-actions/${ca.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investigatorId: investigatorId || undefined,
          rootCause: rootCause || undefined,
          supportingEvidence: supportingEvidence || undefined,
          actionTaken: actionTaken || undefined,
          preventiveMeasure: preventiveMeasure || undefined,
          targetCompletionAt: targetCompletionAt
            ? new Date(targetCompletionAt).toISOString()
            : undefined,
          effectivenessCheck: effectivenessCheck || undefined,
          verifiedById: verifiedById || undefined,
          verificationAt: verificationAt ? new Date(verificationAt).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || 'Failed to save');
        return;
      }
      toast.success('Saved successfully');
      onUpdate(json.data);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(targetStatus: string) {
    if (targetStatus === 'IN_PROGRESS' && !investigatorId) {
      toast.error('Please assign an investigator before starting the investigation');
      return;
    }
    if (targetStatus === 'UNDER_VERIFICATION' && !actionTaken) {
      toast.error('Please document the action taken before completing the investigation');
      return;
    }
    if (targetStatus === 'CLOSED' && !effectivenessCheck) {
      toast.error('Please document the effectiveness check before closing');
      return;
    }

    setTransitioning(true);
    try {
      const res = await fetch(`/api/corrective-actions/${ca.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || 'Failed to transition status');
        return;
      }
      toast.success(`Status changed to ${targetStatus.replace(/_/g, ' ')}`);
      onStatusChange(json.data);
    } catch {
      toast.error('Failed to transition status');
    } finally {
      setTransitioning(false);
    }
  }

  const isOpen = ca.status === 'OPEN';
  const isInProgress = ca.status === 'IN_PROGRESS';
  const isUnderVerification = ca.status === 'UNDER_VERIFICATION';
  const isClosed = ca.status === 'CLOSED';
  const canEditSectionsCD = !isOpen;
  const canEditSectionD = isUnderVerification || isClosed;

  const config = statusConfig[ca.status] || { variant: 'neutral' as const, label: ca.status };
  const openedDate = new Date(ca.openedAt);

  const sections = [
    { id: 'identification', label: 'A - Identification' },
    { id: 'investigation', label: 'B - Investigation' },
    { id: 'action', label: 'C - Action Taken', disabled: !canEditSectionsCD },
    { id: 'verification', label: 'D - Verification', disabled: !canEditSectionD },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-lg flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-on-surface">{ca.caNumber}</h2>
            <p className="text-sm text-on-surface-variant">{ca.analyte}</p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 px-6 py-3 border-b border-border overflow-x-auto shrink-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              disabled={s.disabled}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                activeSection === s.id
                  ? 'bg-primary text-white'
                  : s.disabled
                    ? 'text-on-surface-variant/40 cursor-not-allowed'
                    : 'text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
          <Pill variant={config.variant} size="sm">
            {config.label}
          </Pill>
          <div className="flex gap-2">
            {isOpen && (
              <Button
                size="sm"
                onClick={() => handleTransition('IN_PROGRESS')}
                loading={transitioning}
              >
                Start Investigation
              </Button>
            )}
            {isInProgress && (
              <Button
                size="sm"
                onClick={() => handleTransition('UNDER_VERIFICATION')}
                loading={transitioning}
              >
                Complete Investigation
              </Button>
            )}
            {isUnderVerification && (
              <Button size="sm" onClick={() => handleTransition('CLOSED')} loading={transitioning}>
                Close Action
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeSection === 'identification' && (
            <div className="flex flex-col gap-4">
              <SectionGrid>
                <Field label="CA #" value={ca.caNumber} mono />
                <Field label="Date Opened" value={openedDate.toLocaleDateString('pt-BR')} />
                <Field label="Analyte" value={ca.analyte} />
                {ca.lot && (
                  <>
                    <Field label="Linked Lot" value={ca.lot.lotNumber} mono />
                    <Field label="Analyzer" value={ca.lot.analyzer.analyzerId} mono />
                    <Field label="Reagent" value={ca.lot.reagentName} />
                  </>
                )}
                <Field label="Equipment" value={ca.equipmentId} mono />
                <Field label="Rule Violated" value={ca.ruleViolated} mono />
                <Field label="Operator" value={ca.operator.name} />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Investigator
                  </span>
                  <select
                    value={investigatorId}
                    onChange={(e) => setInvestigatorId(e.target.value)}
                    className="h-10 px-3 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select investigator...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </SectionGrid>
            </div>
          )}

          {activeSection === 'investigation' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Root Cause
                </label>
                <textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Describe the root cause..."
                  rows={5}
                  className="w-full px-4 py-3 border border-border-variant rounded text-sm resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Supporting Evidence
                </label>
                <textarea
                  value={supportingEvidence}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="Describe supporting evidence..."
                  rows={5}
                  className="w-full px-4 py-3 border border-border-variant rounded text-sm resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          )}

          {activeSection === 'action' && (
            <div className="flex flex-col gap-5">
              {isOpen && (
                <div className="bg-warning-container px-4 py-3 rounded text-sm text-warning font-medium">
                  Assign an investigator and start the investigation to edit this section.
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Action Taken
                </label>
                <textarea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="Describe the action taken..."
                  rows={5}
                  disabled={isOpen}
                  className="w-full px-4 py-3 border border-border-variant rounded text-sm resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Preventive Measure
                </label>
                <textarea
                  value={preventiveMeasure}
                  onChange={(e) => setPreventiveMeasure(e.target.value)}
                  placeholder="Describe preventive measures..."
                  rows={5}
                  disabled={isOpen}
                  className="w-full px-4 py-3 border border-border-variant rounded text-sm resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={targetCompletionAt}
                  onChange={(e) => setTargetCompletionAt(e.target.value)}
                  disabled={isOpen}
                  className="h-12 px-4 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {activeSection === 'verification' && (
            <div className="flex flex-col gap-5">
              {!canEditSectionD && (
                <div className="bg-warning-container px-4 py-3 rounded text-sm text-warning font-medium">
                  Verification section will be available after completing the investigation.
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Effectiveness Check
                </label>
                <textarea
                  value={effectivenessCheck}
                  onChange={(e) => setEffectivenessCheck(e.target.value)}
                  placeholder="Describe how effectiveness was verified..."
                  rows={5}
                  disabled={!canEditSectionD}
                  className="w-full px-4 py-3 border border-border-variant rounded text-sm resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Verified By
                </span>
                <select
                  value={verifiedById}
                  onChange={(e) => setVerifiedById(e.target.value)}
                  disabled={!canEditSectionD}
                  className="h-12 px-4 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">Select...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Verification Date
                </label>
                <input
                  type="date"
                  value={verificationAt}
                  onChange={(e) => setVerificationAt(e.target.value)}
                  disabled={!canEditSectionD}
                  className="h-12 px-4 border border-border-variant rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {activeSection === 'timeline' && <CATimeline entries={timeline} />}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <div className="text-xs text-on-surface-variant">
            Updated: {new Date(ca.updatedAt).toLocaleString('pt-BR')}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
            {isUnderVerification && (
              <Button
                variant="primary"
                onClick={() => handleTransition('CLOSED')}
                loading={transitioning}
              >
                Close Action
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
