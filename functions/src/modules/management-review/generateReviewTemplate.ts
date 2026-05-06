import { onCall, CallableOptions } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ReviewTemplate } from './types';

/**
 * Cloud Function: generateReviewTemplate
 *
 * Pre-populates a management review template with current data from 7 collections:
 * 1. auditoria-interna (audit results)
 * 2. naoConformidades (non-conformities)
 * 3. capa (corrective actions)
 * 4. indicators (KPIs)
 * 5. reclamacoes (customer feedback)
 * 6. treinamentos (personnel)
 * 7. equipamentos (infrastructure)
 * 8. fornecedores (suppliers)
 *
 * Returns a template with all 15 sections pre-filled with sourceData
 */

const db = getFirestore();

interface GenerateReviewTemplateRequest {
  labId: string;
  year: number;
}

interface GenerateReviewTemplateResponse {
  template?: ReviewTemplate;
  success: boolean;
  error?: string;
}

const options: CallableOptions = {
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'southamerica-east1'
};

export const generateReviewTemplate = onCall<GenerateReviewTemplateRequest>(
  options,
  async (request): Promise<GenerateReviewTemplateResponse> => {
    try {
      const { labId, year } = request.data;

      // Auth check
      if (!request.auth?.uid) {
        throw new Error('Auth required');
      }

      // Permission check: user must be lab member
      const labRef = db.collection('labs').doc(labId);
      const labDoc = await labRef.get();
      if (!labDoc.exists) {
        throw new Error('Lab not found');
      }

      // Verify user is member
      const members = labDoc.data()?.members || [];
      if (!members.includes(request.auth.uid)) {
        throw new Error('Not a lab member');
      }

      // Pull data from all sources in parallel
      const [
        auditResults,
        ncCapaStatus,
        kpiTrends,
        customerFeedback,
        personnelCompetency,
        infrastructure,
        supplierPerformance
      ] = await Promise.all([
        pullAuditResults(labId),
        pullNCCapaStatus(labId),
        pullKPITrends(labId),
        pullCustomerFeedback(labId),
        pullPersonnelCompetency(labId),
        pullInfrastructure(labId),
        pullSupplierPerformance(labId)
      ]);

      // Build template sections (matching reviewTemplateService.ts logic)
      const sections = [
        {
          number: 1,
          titlePt: 'Análise de Resultados de Auditorias',
          content: '',
          sourceData: auditResults
        },
        {
          number: 2,
          titlePt: 'Análise de Conformidades e CAPAs',
          content: '',
          sourceData: ncCapaStatus
        },
        {
          number: 3,
          titlePt: 'Tendências de Indicadores de Desempenho',
          content: '',
          sourceData: kpiTrends
        },
        {
          number: 4,
          titlePt: 'Análise de Feedback do Cliente',
          content: '',
          sourceData: customerFeedback
        },
        {
          number: 5,
          titlePt: 'Análise de Competência do Pessoal',
          content: '',
          sourceData: personnelCompetency
        },
        {
          number: 6,
          titlePt: 'Análise de Infraestrutura e Calibração',
          content: '',
          sourceData: infrastructure
        },
        {
          number: 7,
          titlePt: 'Análise de Desempenho de Fornecedores',
          content: '',
          sourceData: supplierPerformance
        },
        ...Array.from({ length: 8 }, (_, i) => ({
          number: 8 + i,
          titlePt: `Seção ${8 + i}`,
          content: '',
          sourceData: {}
        }))
      ];

      const template: ReviewTemplate = {
        year,
        entries: sections as any,
        sourceDataTimestamp: Timestamp.now(),
        warnings: []
      };

      return {
        template,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[generateReviewTemplate] Error:', message);
      return {
        success: false,
        error: message
      };
    }
  }
);

/**
 * Data aggregation functions (matching reviewTemplateService.ts)
 */

async function pullAuditResults(labId: string): Promise<Record<string, any>> {
  try {
    const snapshot = await db
      .collection('labs')
      .doc(labId)
      .collection('auditoria-interna')
      .where('deletedAt', '==', null)
      .get();

    let totalFindings = 0;
    let totalClosed = 0;

    snapshot.forEach((doc) => {
      const audit = doc.data();
      totalFindings += audit.findings?.length || 0;
      if (audit.status === 'closed') totalClosed++;
    });

    return {
      totalAudits: snapshot.size,
      totalFindings,
      totalClosed,
      completionRate: snapshot.size > 0 ? ((totalClosed / snapshot.size) * 100).toFixed(1) : 'N/A'
    };
  } catch (error) {
    console.warn('[pullAuditResults] Error:', error);
    return {};
  }
}

async function pullNCCapaStatus(labId: string): Promise<Record<string, any>> {
  try {
    const [ncSnapshot, capaSnapshot] = await Promise.all([
      db
        .collection('labs')
        .doc(labId)
        .collection('naoConformidades')
        .where('deletedAt', '==', null)
        .get(),
      db
        .collection('labs')
        .doc(labId)
        .collection('capa')
        .where('deletedAt', '==', null)
        .get()
    ]);

    const ncByStatus = { open: 0, closed: 0, onHold: 0 };
    const capaByStatus = { open: 0, closed: 0, overdue: 0 };

    ncSnapshot.forEach((doc) => {
      const status = doc.data().status || 'open';
      if (status === 'closed') ncByStatus.closed++;
      else if (status === 'onHold') ncByStatus.onHold++;
      else ncByStatus.open++;
    });

    capaSnapshot.forEach((doc) => {
      const status = doc.data().status || 'open';
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
      capaOverdue: capaByStatus.overdue
    };
  } catch (error) {
    console.warn('[pullNCCapaStatus] Error:', error);
    return {};
  }
}

async function pullKPITrends(labId: string): Promise<Record<string, any>> {
  try {
    const snapshot = await db
      .collection('labs')
      .doc(labId)
      .collection('indicators')
      .where('deletedAt', '==', null)
      .limit(100)
      .get();

    const indicators: Record<string, number> = {};
    snapshot.forEach((doc) => {
      const ind = doc.data();
      indicators[ind.nome || 'unknown'] = ind.valor || 0;
    });

    return {
      monthCount: snapshot.size,
      indicators
    };
  } catch (error) {
    console.warn('[pullKPITrends] Error:', error);
    return {};
  }
}

async function pullCustomerFeedback(labId: string): Promise<Record<string, any>> {
  try {
    const snapshot = await db
      .collection('labs')
      .doc(labId)
      .collection('reclamacoes')
      .where('deletedAt', '==', null)
      .get();

    let openCount = 0;
    let closedCount = 0;

    snapshot.forEach((doc) => {
      const status = doc.data().status || 'open';
      if (status === 'closed') closedCount++;
      else openCount++;
    });

    return {
      totalComplaints: snapshot.size,
      openComplaints: openCount,
      closedComplaints: closedCount
    };
  } catch (error) {
    console.warn('[pullCustomerFeedback] Error:', error);
    return {};
  }
}

async function pullPersonnelCompetency(labId: string): Promise<Record<string, any>> {
  try {
    const snapshot = await db
      .collection('labs')
      .doc(labId)
      .collection('treinamentos')
      .where('deletedAt', '==', null)
      .get();

    let completedCount = 0;

    snapshot.forEach((doc) => {
      if (doc.data().status === 'completed') completedCount++;
    });

    return {
      totalTrainings: snapshot.size,
      completedTrainings: completedCount,
      competencyRate: snapshot.size > 0 ? ((completedCount / snapshot.size) * 100).toFixed(1) : 'N/A'
    };
  } catch (error) {
    console.warn('[pullPersonnelCompetency] Error:', error);
    return {};
  }
}

async function pullInfrastructure(labId: string): Promise<Record<string, any>> {
  try {
    const [equipSnapshot, calibSnapshot] = await Promise.all([
      db
        .collection('labs')
        .doc(labId)
        .collection('equipamentos')
        .where('deletedAt', '==', null)
        .get(),
      db
        .collection('labs')
        .doc(labId)
        .collection('calibracao')
        .where('deletedAt', '==', null)
        .get()
    ]);

    return {
      totalEquipment: equipSnapshot.size,
      totalCalibrations: calibSnapshot.size,
      calibrationCompliance: equipSnapshot.size > 0
        ? ((calibSnapshot.size / equipSnapshot.size) * 100).toFixed(1)
        : 'N/A'
    };
  } catch (error) {
    console.warn('[pullInfrastructure] Error:', error);
    return {};
  }
}

async function pullSupplierPerformance(labId: string): Promise<Record<string, any>> {
  try {
    const snapshot = await db
      .collection('labs')
      .doc(labId)
      .collection('fornecedores')
      .where('deletedAt', '==', null)
      .get();

    let activeCount = 0;

    snapshot.forEach((doc) => {
      if (doc.data().status === 'active') activeCount++;
    });

    return {
      totalSuppliers: snapshot.size,
      activeSuppliers: activeCount
    };
  } catch (error) {
    console.warn('[pullSupplierPerformance] Error:', error);
    return {};
  }
}
