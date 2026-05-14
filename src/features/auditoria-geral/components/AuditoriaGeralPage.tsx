import { useState } from 'react';
import { AuditoriasDashboard } from './AuditoriasDashboard';
import { WizardAuditoria } from './WizardAuditoria';

export default function AuditoriaGeralPage() {
  const [selectedAuditoriaId, setSelectedAuditoriaId] = useState<string | null>(null);

  if (selectedAuditoriaId) {
    return (
      <WizardAuditoria auditoriaId={selectedAuditoriaId} onBack={() => setSelectedAuditoriaId(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <AuditoriasDashboard onSelect={setSelectedAuditoriaId} />
    </div>
  );
}