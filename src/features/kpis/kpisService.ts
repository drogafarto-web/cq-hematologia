import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import type { KPIDaily, KPIAlert, KPIDashboardData } from './types/KPI';

const kpiCollection = (labId: string) => collection(db, `labs/${labId}/kpi-metrics`);
const alertCollection = (labId: string) => collection(db, `labs/${labId}/kpi-alerts`);

export function subscribeLatestKPI(
  labId: string,
  callback: (kpi: KPIDaily | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(kpiCollection(labId), orderBy('data', 'desc'), limit(1));

  return onSnapshot(
    q,
    (snap) => {
      const kpi = snap.empty ? null : (snap.docs[0].data() as KPIDaily);
      callback(kpi);
    },
    onError,
  );
}

export function subscribeKPIHistory(
  labId: string,
  days: number = 30,
  callback?: (kpis: KPIDaily[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(kpiCollection(labId), orderBy('data', 'desc'), limit(days));

  return onSnapshot(
    q,
    (snap) => {
      const kpis = snap.docs.map((d) => d.data() as KPIDaily);
      callback?.(kpis);
    },
    onError,
  );
}

export function subscribeActiveAlerts(
  labId: string,
  callback?: (alerts: KPIAlert[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(alertCollection(labId), where('lida', '==', false), orderBy('acionada_em', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const alerts = snap.docs.map((d) => d.data() as KPIAlert);
      callback?.(alerts);
    },
    onError,
  );
}

export async function getKPIDashboardData(labId: string): Promise<KPIDashboardData | null> {
  // Get latest KPI
  const q = query(kpiCollection(labId), orderBy('data', 'desc'), limit(2));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const dataAtual = snap.docs[0].data() as KPIDaily;
  const dataAnterior = snap.docs[1]?.data() as KPIDaily | undefined;

  // Determine trend
  let tendencia: 'mejora' | 'deterioro' | 'estavel' = 'estavel';
  if (dataAnterior) {
    if (dataAtual.documentacao_percentual > dataAnterior.documentacao_percentual) {
      tendencia = 'mejora';
    } else if (dataAtual.documentacao_percentual < dataAnterior.documentacao_percentual) {
      tendencia = 'deterioro';
    }
  }

  // Get active alerts
  const alertsQ = query(alertCollection(labId), where('lida', '==', false), limit(5));
  const alertsSnap = await getDocs(alertsQ);
  const alertas = alertsSnap.docs.map((d) => d.data() as KPIAlert);

  return {
    dataAtual,
    dataAnterior,
    tendencia,
    alertas,
  };
}
