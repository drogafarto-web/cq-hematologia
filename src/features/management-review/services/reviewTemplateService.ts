import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import {
  ReviewTemplate,
  createEmptyReviewTemplate,
  ReviewEntry,
  REVIEW_SECTIONS
} from '../types';

/**
 * ReviewTemplateService
 * Aggregates data from multiple collections to pre-populate review sections
 *
 * Data sources (one-time reads):
 * 1. auditoria-interna — audit results
 * 2. naoConformidades + capa — NC/CAPA counts
 * 3. indicators (KPIs) — trends over 12 months
 * 4. reclamacoes — customer feedback count
 * 5. treinamentos — personnel competency
 * 6. equipamentos + calibracao — infrastructure
 * 7. fornecedores — supplier names
 * (Regulatory changes and risks are manual entry — no system data source)
 *
 * Returns a ReviewTemplate with all 15 sections pre-populated with sourceData
 */

interface DataSources {
  auditResults: Record<string, any>;
  ncCapaStatus: Record<string, any>;
  kpiTrends: Record<string, any>;
  customerFeedback: Record<string, any>;
  personnelCompetency: Record<string, any>;
  infrastructure: Record<string, any>;
  supplierPerformance: Record<string, any>;
}

/**
 * Generate review template with all 15 sections pre-populated
 *
 * @param labId - Lab ID
 * @param year - Review year
 * @returns ReviewTemplate with sourceData filled in
 */
export async function generateReviewTemplate(
  labId: string,
  year: number
): Promise<ReviewTemplate> {
  const template = createEmptyReviewTemplate(year);
  const warnings: string[] = [];

  try {
    // Parallel data pulls
    const [
      auditResults,
      ncCapaStatus,
      kpiTrends,
      customerFeedback,
      personnelCompetency,
      infrastructure,
      supplierPerformance
    ] = await Promise.all([
      pullAuditResults(labId).catch((e) => {
        warnings.push('Auditoria Interna collection not accessible');
        return {};
      }),
      pullNCCapaStatus(labId).catch((e) => {
        warnings.push('Não-Conformidades or CAPA collections not accessible');
        return {};
      }),
      pullKPITrends(labId).catch((e) => {
        warnings.push('Indicators collection not accessible');
        return {};
      }),
      pullCustomerFeedback(labId).catch((e) => {
        warnings.push('Reclamações collection not accessible or not yet available');
        return {};
      }),
      pullPersonnelCompetency(labId).catch((e) => {
        warnings.push('Treinamentos collection not accessible');
        return {};
      }),
      pullInfrastructure(labId).catch((e) => {
        warnings.push('Equipamentos or Calibração collections not accessible');
        return {};
      }),
      pullSupplierPerformance(labId).catch((e) => {
        warnings.push('Fornecedores collection not accessible');
        return {};
      })
    ]);

    // Populate each section with aggregated data
    template.entries[0].sourceData = auditResults;     // Section 1
    template.entries[1].sourceData = ncCapaStatus;    // Section 2
    template.entries[2].sourceData = kpiTrends;       // Section 3
    template.entries[3].sourceData = customerFeedback; // Section 4
    template.entries[4].sourceData = personnelCompetency; // Section 5
    template.entries[5].sourceData = infrastructure;   // Section 6
    template.entries[6].sourceData = supplierPerformance; // Section 7
    // Sections 8-14: manual entry only (no system data source)
    // Section 15: attendees + signature (populated by form)

    template.warnings = warnings;
    template.sourceDataTimestamp = Timestamp.now();

    return template;
  } catch (error) {
    console.error('[ReviewTemplateService] Error generating template:', error);
    throw error;
  }
}

/**
 * Pull Section 1: Audit results summary
 */
async function pullAuditResults(labId: string): Promise<Record<string, any>> {
  const path = collection(db, 'labs', labId, 'auditoria-interna');
  const q = query(path, where('deletedAt', '==', null));
  const snapshot = await getDocs(q);

  const audits = [];
  let totalFindings = 0;
  let totalClosed = 0;

  snapshot.forEach((doc) => {
    const audit = doc.data();
    audits.push({
      id: doc.id,
      dataAuditoria: audit.dataAuditoria?.toDate?.() || null,
      tipo: audit.tipo,
      escopo: audit.escopo,
      findingsCount: audit.findings?.length || 0
    });
    totalFindings += audit.findings?.length || 0;
    if (audit.status === 'closed') totalClosed++;
  });

  return {
    totalAudits: audits.length,
    totalFindings,
    totalClosed,
    mostRecent: audits.sort(
      (a, b) => (b.dataAuditoria?.getTime() || 0) - (a.dataAuditoria?.getTime() || 0)
    )[0] || null,
    byType: aggregateBy(audits, 'tipo')
  };
}

/**
 * Pull Section 2: NC and CAPA status
 */
async function pullNCCapaStatus(labId: string): Promise<Record<string, any>> {
  const ncPath = collection(db, 'labs', labId, 'naoConformidades');
  const capaPath = collection(db, 'labs', labId, 'capa');

  const [ncSnapshot, capaSnapshot] = await Promise.all([
    getDocs(query(ncPath, where('deletedAt', '==', null))),
    getDocs(query(capaPath, where('deletedAt', '==', null)))
  ]);

  const ncByStatus = { open: 0, closed: 0, onHold: 0 };
  const capaByStatus = { open: 0, closed: 0, overdue: 0 };

  ncSnapshot.forEach((doc) => {
    const nc = doc.data();
    const status = nc.status || 'open';
    if (status === 'closed') ncByStatus.closed++;
    else if (status === 'onHold') ncByStatus.onHold++;
    else ncByStatus.open++;
  });

  capaSnapshot.forEach((doc) => {
    const capa = doc.data();
    const status = capa.status || 'open';
    if (status === 'closed') capaByStatus.closed++;
    else if (status === 'overdue') capaByStatus.overdue++;
    else capaByStatus.open++;
  });

  return {
    ncOpen: ncByStatus.open,
    ncClosed: ncByStatus.closed,
    ncOnHold: ncByStatus.onHold,
    capaOpen: capaByStatus.open,
    capaClosed: capaByStatus.closed,
    capaOverdue: capaByStatus.overdue,
    totalNC: ncByStatus.open + ncByStatus.closed + ncByStatus.onHold,
    totalCapa: capaByStatus.open + capaByStatus.closed + capaByStatus.overdue
  };
}

/**
 * Pull Section 3: KPI trends (last 12 months)
 */
async function pullKPITrends(labId: string): Promise<Record<string, any>> {
  const path = collection(db, 'labs', labId, 'indicators');
  const snapshot = await getDocs(query(path, where('deletedAt', '==', null)));

  const kpiData: Record<string, any[]> = {};

  snapshot.forEach((doc) => {
    const indicator = doc.data();
    const month = indicator.mes || 'unknown';

    if (!kpiData[month]) {
      kpiData[month] = [];
    }
    kpiData[month].push({
      name: indicator.nome,
      value: indicator.valor,
      target: indicator.meta
    });
  });

  return {
    monthCount: Object.keys(kpiData).length,
    indicators: kpiData,
    lastUpdated: Timestamp.now().toDate().toISOString()
  };
}

/**
 * Pull Section 4: Customer feedback (complaints)
 */
async function pullCustomerFeedback(labId: string): Promise<Record<string, any>> {
  const path = collection(db, 'labs', labId, 'reclamacoes');
  const q = query(path, where('deletedAt', '==', null));
  const snapshot = await getDocs(q);

  let totalComplaints = 0;
  let openCount = 0;
  let closedCount = 0;
  const byType: Record<string, number> = {};

  snapshot.forEach((doc) => {
    const complaint = doc.data();
    totalComplaints++;

    const status = complaint.status || 'open';
    if (status === 'closed') closedCount++;
    else openCount++;

    const type = complaint.tipo || 'unclassified';
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    totalComplaints,
    openComplaints: openCount,
    closedComplaints: closedCount,
    byType,
    closureRate: totalComplaints > 0 ? ((closedCount / totalComplaints) * 100).toFixed(1) : 'N/A'
  };
}

/**
 * Pull Section 5: Personnel competency
 */
async function pullPersonnelCompetency(labId: string): Promise<Record<string, any>> {
  const path = collection(db, 'labs', labId, 'treinamentos');
  const snapshot = await getDocs(query(path, where('deletedAt', '==', null)));

  let totalTrainings = 0;
  let completedCount = 0;
  const byRole: Record<string, number> = {};

  snapshot.forEach((doc) => {
    const training = doc.data();
    totalTrainings++;

    if (training.status === 'completed') completedCount++;

    const role = training.cargoAlvo || 'unspecified';
    byRole[role] = (byRole[role] || 0) + 1;
  });

  return {
    totalTrainings,
    completedTrainings: completedCount,
    competencyRate: totalTrainings > 0 ? ((completedCount / totalTrainings) * 100).toFixed(1) : 'N/A',
    byRole
  };
}

/**
 * Pull Section 6: Infrastructure + Calibration
 */
async function pullInfrastructure(labId: string): Promise<Record<string, any>> {
  const equipPath = collection(db, 'labs', labId, 'equipamentos');
  const calibPath = collection(db, 'labs', labId, 'calibracao');

  const [equipSnapshot, calibSnapshot] = await Promise.all([
    getDocs(query(equipPath, where('deletedAt', '==', null))),
    getDocs(query(calibPath, where('deletedAt', '==', null)))
  ]);

  let totalEquipment = 0;
  let calibratedCount = 0;
  let overdueCalibration = 0;
  const equipmentStatus: Record<string, number> = {};

  equipSnapshot.forEach((doc) => {
    totalEquipment++;
    const equip = doc.data();
    const status = equip.status || 'operational';
    equipmentStatus[status] = (equipmentStatus[status] || 0) + 1;
  });

  const now = Timestamp.now();

  calibSnapshot.forEach((doc) => {
    const calib = doc.data();
    calibratedCount++;

    const dueDate = calib.dataPrevista?.toDate?.() || null;
    if (dueDate && dueDate < now.toDate()) {
      overdueCalibration++;
    }
  });

  return {
    totalEquipment,
    equipmentStatus,
    totalCalibrations: calibratedCount,
    overdueCalibrations: overdueCalibration,
    calibrationCompliance: totalEquipment > 0
      ? ((calibratedCount / totalEquipment) * 100).toFixed(1)
      : 'N/A'
  };
}

/**
 * Pull Section 7: Supplier performance
 */
async function pullSupplierPerformance(labId: string): Promise<Record<string, any>> {
  const path = collection(db, 'labs', labId, 'fornecedores');
  const snapshot = await getDocs(query(path, where('deletedAt', '==', null)));

  const suppliers = [];
  let activeCount = 0;

  snapshot.forEach((doc) => {
    const supplier = doc.data();
    suppliers.push({
      id: doc.id,
      nome: supplier.nome,
      status: supplier.status,
      ultimaAvaliacao: supplier.ultimaAvaliacao?.toDate?.() || null
    });

    if (supplier.status === 'active') activeCount++;
  });

  return {
    totalSuppliers: suppliers.length,
    activeSuppliers: activeCount,
    suppliers: suppliers.map((s) => ({
      name: s.nome,
      status: s.status,
      lastEvaluation: s.ultimaAvaliacao?.toISOString?.() || 'Never'
    }))
  };
}

/**
 * Helper: Aggregate array by property
 */
function aggregateBy(
  items: any[],
  key: string
): Record<string, number> {
  const result: Record<string, number> = {};
  items.forEach((item) => {
    const value = item[key] || 'unknown';
    result[value] = (result[value] || 0) + 1;
  });
  return result;
}
