'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ReportForm } from './components/report-form';
import { RecentReportsTable } from './components/recent-reports-table';
import { ReportPreviewModal } from './components/report-preview-modal';

type ReportType = 'MONTHLY_QC_SUMMARY' | 'LOT_PERFORMANCE' | 'CORRECTIVE_ACTIONS' | 'EQUIPMENT';

interface SerializedReport {
  id: string;
  type: ReportType;
  periodStart: string;
  periodEnd: string;
  scope: Record<string, unknown>;
  s3Key: string | null;
  generatedById: string;
  generatedAt: string;
  generatedBy: { name: string };
}

interface ReportsClientProps {
  reports: SerializedReport[];
}

export default function ReportsClient({ reports }: ReportsClientProps) {
  const [selectedType, setSelectedType] = useState<ReportType>('MONTHLY_QC_SUMMARY');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodPreset, setPeriodPreset] = useState<string | null>('LAST_MONTH');
  const [scope, setScope] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportList, setReportList] = useState<SerializedReport[]>(reports);
  const [previewReport, setPreviewReport] = useState<SerializedReport | null>(null);

  function applyPreset(preset: string) {
    const now = new Date();
    let start: Date;
    let end = now;

    switch (preset) {
      case 'LAST_MONTH':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'LAST_QUARTER':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'LAST_YEAR':
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      default:
        return;
    }

    setPeriodPreset(preset);
    setPeriodStart(start.toISOString().slice(0, 10));
    setPeriodEnd(end.toISOString().slice(0, 10));
  }

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          scope,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || 'Failed to generate report');
        return;
      }
      toast.success('Report generated');
      const refresh = await fetch('/api/reports');
      const refreshed = await refresh.json();
      if (refreshed.success) setReportList(refreshed.data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload(reportId: string, format: 'pdf' | 'excel') {
    try {
      const res = await fetch(`/api/reports/${reportId}/download/${format}`);
      if (!res.ok) {
        toast.error('Download failed');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-on-surface">Reports</h1>

      <ReportForm
        selectedType={selectedType}
        onSelectType={setSelectedType}
        periodStart={periodStart}
        periodEnd={periodEnd}
        periodPreset={periodPreset}
        onApplyPreset={applyPreset}
        onPeriodStartChange={setPeriodStart}
        onPeriodEndChange={setPeriodEnd}
        scope={scope}
        onScopeChange={setScope}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
      />

      <RecentReportsTable
        reports={reportList}
        onView={(r) => setPreviewReport(r)}
        onDownload={handleDownload}
      />

      {previewReport && (
        <ReportPreviewModal
          report={previewReport}
          onClose={() => setPreviewReport(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
