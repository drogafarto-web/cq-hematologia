import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { CriticoEscalacao } from '../types/threshold';

interface EscalacaoDashboardProps {
  labId: string;
}

/**
 * EscalacaoDashboard — Real-time SLA tracking and escalation management
 */
export const EscalacaoDashboard: React.FC<EscalacaoDashboardProps> = ({ labId }) => {
  const [escalacoes, setEscalacoes] = useState<CriticoEscalacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const escRef = collection(db, `labs/${labId}/criticos-escalacoes`);
    const q = query(
      escRef,
      where('deletadoEm', '==', null),
      where('status', '!=', 'ACKNOWLEDGED'),
      orderBy('slaDeadline', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as CriticoEscalacao[];
      setEscalacoes(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [labId]);

  const getStatusColor = (escalacao: CriticoEscalacao): string => {
    const now = new Date();
    const deadline = escalacao.slaDeadline.toDate();
    const timeLeft = deadline.getTime() - now.getTime();
    const minutesLeft = timeLeft / (1000 * 60);

    if (escalacao.status === 'EXPIRED') return 'bg-red-900';
    if (minutesLeft < 5) return 'bg-red-700'; // Red (urgent)
    if (minutesLeft < 15) return 'bg-amber-600'; // Amber (warning)
    return 'bg-emerald-700'; // Green (ok)
  };

  if (loading) return <div className="p-4 text-gray-400">Loading escalations...</div>;

  return (
    <div className="p-6 bg-[#141417] rounded-lg">
      <h2 className="text-2xl font-semibold text-white mb-4">Critical Value Escalations</h2>

      {escalacoes.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No pending escalations</div>
      ) : (
        <div className="space-y-3">
          {escalacoes.map((esc) => (
            <div key={esc.id} className={`p-4 rounded ${getStatusColor(esc)}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-white font-semibold">Laudo: {esc.laudoId}</p>
                  <p className="text-gray-200 text-sm mt-1">
                    {esc.criticalValues?.length || 0} critical value(s)
                  </p>
                  <p className="text-gray-300 text-xs mt-2">
                    Status: {esc.status} · Deadline: {esc.slaDeadline?.toDate().toLocaleTimeString()}
                  </p>
                </div>
                <button
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                  onClick={() => {
                    /* TODO: Open acknowledge modal */
                  }}
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
