/**
 * aggregateManagementReviewData — Cloud Function callable v2 for annual management review
 * Phase 8 Wave 3 — SA-26
 *
 * Aggregates 15 data entries from various modules for annual management review.
 * Queries data sources and gracefully handles errors (returns data: {error} instead of failing).
 * Always returns 15 entries, padding manual entries (14, 15) if needed.
 *
 * Input: { labId, startDate, endDate }
 * Output: { entries: ManagementReviewEntry[] } (exactly 15 entries)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const aggregateManagementReviewDataInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  startDate: z.number().int(),
  endDate: z.number().int(),
});

export interface ManagementReviewEntry {
  entryNumber: number;
  title: string;
  source: 'auto-aggregated' | 'manual';
  data: Record<string, unknown>;
  error?: string;
}

export interface AggregateManagementReviewDataOutput {
  entries: ManagementReviewEntry[];
}

const ENTRY_TITLES: Record<number, string> = {
  1: 'NC Trends',
  2: 'CAPA Status',
  3: 'Training Hours',
  4: 'CEQ Results',
  5: 'Audit Findings',
  6: 'KPI Trends',
  7: 'Complaints',
  8: 'Suppliers',
  9: 'Improvements',
  10: 'Personnel Changes',
  11: 'Equipment Calibration',
  12: 'Incidents',
  13: 'Risk Management',
  14: 'PGRSS',
  15: 'Compliance Gaps',
};

async function queryDataSource(
  db: admin.firestore.Firestore,
  labId: string,
  entryNumber: number,
  startDate: number,
  endDate: number,
): Promise<ManagementReviewEntry> {
  try {
    const title = ENTRY_TITLES[entryNumber];

    switch (entryNumber) {
      case 1: {
        // NC Trends
        const ncs = await db
          .collection('labs')
          .doc(labId)
          .collection('naoConformidades')
          .where('criadoEm', '>=', startDate)
          .where('criadoEm', '<=', endDate)
          .get();

        const bySeverity: Record<string, number> = {};
        ncs.docs.forEach((doc) => {
          const severity = doc.data()?.severity || 'unknown';
          bySeverity[severity] = (bySeverity[severity] || 0) + 1;
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalCount: ncs.size,
            bySeverity,
          },
        };
      }

      case 2: {
        // CAPA Status
        const capas = await db
          .collection('labs')
          .doc(labId)
          .collection('capa-tracking')
          .get();

        const byState: Record<string, number> = {};
        capas.docs.forEach((doc) => {
          const state = doc.data()?.state || 'unknown';
          byState[state] = (byState[state] || 0) + 1;
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalCount: capas.size,
            byState,
          },
        };
      }

      case 3: {
        // Training Hours
        const trainings = await db
          .collection('labs')
          .doc(labId)
          .collection('educacao-execucoes')
          .where('dataExecucao', '>=', startDate)
          .where('dataExecucao', '<=', endDate)
          .get();

        let totalHours = 0;
        trainings.docs.forEach((doc) => {
          totalHours += doc.data()?.duracaoHoras || 0;
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalHours,
            sessionCount: trainings.size,
          },
        };
      }

      case 4: {
        // CEQ Results
        const ceqs = await db
          .collection('labs')
          .doc(labId)
          .collection('ceq-resultados')
          .where('dataResultado', '>=', startDate)
          .where('dataResultado', '<=', endDate)
          .get();

        let acceptableCount = 0;
        ceqs.docs.forEach((doc) => {
          if (doc.data()?.zscore !== undefined && Math.abs(doc.data().zscore) <= 2) {
            acceptableCount++;
          }
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalResults: ceqs.size,
            acceptableCount,
            acceptablePercent: ceqs.size > 0 ? Math.round((acceptableCount / ceqs.size) * 100) : 0,
          },
        };
      }

      case 5: {
        // Audit Findings
        const findings = await db
          .collection('labs')
          .doc(labId)
          .collection('auditoria-achados')
          .where('dataAchado', '>=', startDate)
          .where('dataAchado', '<=', endDate)
          .get();

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalFindings: findings.size,
          },
        };
      }

      case 6: {
        // KPI Trends
        const kpiSnaps = await db
          .collection('labs')
          .doc(labId)
          .collection('kpi-snapshots')
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        const latestKPI = kpiSnaps.empty ? {} : kpiSnaps.docs[0].data();

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: latestKPI || {},
        };
      }

      case 7: {
        // Complaints
        const complaints = await db
          .collection('labs')
          .doc(labId)
          .collection('reclamacoes')
          .where('dataReclamacao', '>=', startDate)
          .where('dataReclamacao', '<=', endDate)
          .get();

        let resolvedCount = 0;
        complaints.docs.forEach((doc) => {
          if (doc.data()?.status === 'resolvida') {
            resolvedCount++;
          }
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalComplaints: complaints.size,
            resolvedCount,
            resolutionPercent: complaints.size > 0 ? Math.round((resolvedCount / complaints.size) * 100) : 0,
          },
        };
      }

      case 8: {
        // Suppliers
        const suppliers = await db
          .collection('labs')
          .doc(labId)
          .collection('fornecedores')
          .where('ativo', '==', true)
          .get();

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            activeSuppliers: suppliers.size,
          },
        };
      }

      case 9: {
        // Improvements
        const improvements = await db
          .collection('labs')
          .doc(labId)
          .collection('sugestoes')
          .where('dataSugestao', '>=', startDate)
          .where('dataSugestao', '<=', endDate)
          .get();

        let implementedCount = 0;
        improvements.docs.forEach((doc) => {
          if (doc.data()?.status === 'implementada') {
            implementedCount++;
          }
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalSuggestions: improvements.size,
            implementedCount,
            implementationPercent: improvements.size > 0 ? Math.round((implementedCount / improvements.size) * 100) : 0,
          },
        };
      }

      case 10: {
        // Personnel Changes
        const designacoes = await db
          .collection('labs')
          .doc(labId)
          .collection('personnel')
          .doc('designacoes')
          .collection('registros')
          .where('dataDesignacao', '>=', startDate)
          .where('dataDesignacao', '<=', endDate)
          .get();

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            designationChanges: designacoes.size,
          },
        };
      }

      case 11: {
        // Equipment Calibration
        const calibracoes = await db
          .collection('labs')
          .doc(labId)
          .collection('calibracao')
          .get();

        let overdueCount = 0;
        const now = Date.now();
        calibracoes.docs.forEach((doc) => {
          if (doc.data()?.nextDueDate < now) {
            overdueCount++;
          }
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalEquipment: calibracoes.size,
            overdueCount,
          },
        };
      }

      case 12: {
        // Incidents
        const incidents = await db
          .collection('labs')
          .doc(labId)
          .collection('incidents')
          .where('dataIncidente', '>=', startDate)
          .where('dataIncidente', '<=', endDate)
          .get();

        const bySeverity: Record<string, number> = {};
        incidents.docs.forEach((doc) => {
          const severity = doc.data()?.severity || 'unknown';
          bySeverity[severity] = (bySeverity[severity] || 0) + 1;
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalIncidents: incidents.size,
            bySeverity,
          },
        };
      }

      case 13: {
        // Risk Management
        const risks = await db
          .collection('labs')
          .doc(labId)
          .collection('risks')
          .get();

        let highNPRCount = 0;
        risks.docs.forEach((doc) => {
          const npr = (doc.data()?.probability || 1) * (doc.data()?.severity || 1) * (doc.data()?.detectability || 1);
          if (npr > 75) {
            highNPRCount++;
          }
        });

        return {
          entryNumber,
          title,
          source: 'auto-aggregated',
          data: {
            totalRisks: risks.size,
            highNPRCount,
          },
        };
      }

      case 14: {
        // PGRSS (manual)
        return {
          entryNumber,
          title,
          source: 'manual',
          data: {},
        };
      }

      case 15: {
        // Compliance Gaps (manual)
        return {
          entryNumber,
          title,
          source: 'manual',
          data: {},
        };
      }

      default:
        return {
          entryNumber,
          title,
          source: 'manual',
          data: {},
        };
    }
  } catch (error) {
    const title = ENTRY_TITLES[entryNumber] || `Entry ${entryNumber}`;
    return {
      entryNumber,
      title,
      source: 'auto-aggregated',
      data: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const aggregateManagementReviewData = onCall<
  z.infer<typeof aggregateManagementReviewDataInputSchema>,
  Promise<AggregateManagementReviewDataOutput>
>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<AggregateManagementReviewDataOutput> => {
    // ========== 1. Validate request ==========
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const input = aggregateManagementReviewDataInputSchema.parse(request.data);
    const { labId, startDate, endDate } = input;
    const uid = request.auth.uid;

    // Validate date range
    if (endDate <= startDate) {
      throw new HttpsError('invalid-argument', 'endDate must be after startDate');
    }

    const db = admin.firestore();

    // ========== 2. Authorization check ==========
    const memberDoc = await db
      .collection('labs')
      .doc(labId)
      .collection('members')
      .doc(uid)
      .get();

    if (!memberDoc.exists) {
      throw new HttpsError('permission-denied', `User is not a member of lab ${labId}`);
    }

    // ========== 3. Query all 15 data sources ==========
    const entries: ManagementReviewEntry[] = [];

    for (let entryNumber = 1; entryNumber <= 15; entryNumber++) {
      const entry = await queryDataSource(db, labId, entryNumber, startDate, endDate);
      entries.push(entry);
    }

    // ========== 4. Log to Cloud Logs ==========
    console.log(
      JSON.stringify({
        event: 'management_review_aggregated',
        labId,
        entryCount: entries.length,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        requestedBy: uid,
        timestamp: new Date(Date.now()).toISOString(),
      }),
    );

    return { entries };
  }
);
