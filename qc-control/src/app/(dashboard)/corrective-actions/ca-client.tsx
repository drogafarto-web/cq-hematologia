'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CATable } from './components/ca-table';
import { CADetailPanel } from './components/ca-detail-panel';
import { CANewModal } from './components/ca-new-modal';

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

export interface CorrectiveAction {
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

const TABS = ['OPEN', 'IN_PROGRESS', 'UNDER_VERIFICATION', 'CLOSED', 'ALL'] as const;
type Tab = (typeof TABS)[number];

export default function CAClient({
  actions: initialActions,
  users,
  currentUserId,
}: {
  actions: CorrectiveAction[];
  users: User[];
  currentUserId: string;
}) {
  const searchParams = useSearchParams();

  const [actions, setActions] = useState(initialActions);
  const [selectedTab, setSelectedTab] = useState<Tab>('OPEN');
  const [selectedCA, setSelectedCA] = useState<CorrectiveAction | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const counts = useMemo(
    () => ({
      OPEN: actions.filter((a) => a.status === 'OPEN').length,
      IN_PROGRESS: actions.filter((a) => a.status === 'IN_PROGRESS').length,
      UNDER_VERIFICATION: actions.filter((a) => a.status === 'UNDER_VERIFICATION').length,
      CLOSED: actions.filter((a) => a.status === 'CLOSED').length,
      ALL: actions.length,
    }),
    [actions],
  );

  const filtered = useMemo(
    () => (selectedTab === 'ALL' ? actions : actions.filter((a) => a.status === selectedTab)),
    [actions, selectedTab],
  );

  const handleUpdate = useCallback((updated: CorrectiveAction) => {
    setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedCA(updated);
  }, []);

  const handleStatusChange = useCallback((updated: CorrectiveAction) => {
    setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedCA(updated);
  }, []);

  const handleCreated = useCallback((newAction: CorrectiveAction) => {
    setActions((prev) => [newAction, ...prev]);
    setShowNewModal(false);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-on-surface">Corrective Actions</h1>
        <Button onClick={() => setShowNewModal(true)}>New Action</Button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-3 text-sm font-semibold transition-colors relative ${
              selectedTab === tab ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.replace(/_/g, ' ')}
            <span className="ml-2 text-xs bg-surface-variant px-2 py-0.5 rounded-full">
              {counts[tab]}
            </span>
            {selectedTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      <CATable actions={filtered} onSelect={(a) => setSelectedCA(a as CorrectiveAction)} />

      <CANewModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        prefillLot={searchParams.get('prefillLot') || undefined}
        prefillRule={searchParams.get('prefillRule') || undefined}
        onCreated={(a) => handleCreated(a as CorrectiveAction)}
        users={users}
        currentUserId={currentUserId}
      />

      {selectedCA && (
        <CADetailPanel
          ca={selectedCA}
          users={users}
          onClose={() => setSelectedCA(null)}
          onUpdate={handleUpdate}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
