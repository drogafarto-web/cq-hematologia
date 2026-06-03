'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LotsTable } from './components/lots-table';
import { LotForm } from './components/lot-form';
import { PncqImportModal } from './components/pncq-import-modal';

const levelOptions = [
  { value: '', label: 'All Levels' },
  { value: '1', label: 'Level 1' },
  { value: '2', label: 'Level 2' },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function LotsClient({
  lots: initialLots,
  analyzers,
}: {
  lots: any[];
  analyzers: any[];
}) {
  const [lots, setLots] = useState(initialLots);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pncqOpen, setPncqOpen] = useState(false);

  const filteredLots = useMemo(() => {
    return lots.filter((lot: any) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        lot.lotNumber.toLowerCase().includes(q) ||
        lot.analyte.toLowerCase().includes(q) ||
        lot.reagentName.toLowerCase().includes(q);
      const matchesLevel = !selectedLevel || lot.level === Number.parseInt(selectedLevel);
      const matchesStatus = !selectedStatus || lot.status === selectedStatus;
      return matchesSearch && matchesLevel && matchesStatus;
    });
  }, [lots, searchQuery, selectedLevel, selectedStatus]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-on-surface">Lots</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setPncqOpen(true)}>
            Import from PNCQ
          </Button>
          <Button
            onClick={() => {
              setSelectedLot(null);
              setPanelOpen(true);
            }}
          >
            Add Lot
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-64">
          <Input
            label="Search"
            placeholder="Search by lot, analyte, reagent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            label="Level"
            options={levelOptions}
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            label="Status"
            options={statusOptions}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          />
        </div>
      </div>

      <LotsTable
        lots={filteredLots}
        onRowClick={(lot: any) => {
          setSelectedLot(lot);
          setPanelOpen(true);
        }}
      />

      <LotForm
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        lot={selectedLot}
        analyzers={analyzers}
        onSaved={(lot: any) => {
          if (selectedLot) {
            setLots((prev: any[]) => prev.map((l: any) => (l.id === lot.id ? lot : l)));
          } else {
            setLots((prev: any[]) => [lot, ...prev]);
          }
          setPanelOpen(false);
          setSelectedLot(null);
        }}
      />

      <PncqImportModal
        open={pncqOpen}
        onClose={() => setPncqOpen(false)}
        analyzers={analyzers}
        onImported={() => {
          setPncqOpen(false);
        }}
      />
    </div>
  );
}
