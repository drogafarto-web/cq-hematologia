/**
 * scheduledAuditReportJob.ts
 *
 * Cloud Function scheduled trigger (Cloud Scheduler) for daily/weekly/monthly
 * audit report generation. Aggregates alerts from the last period and generates
 * AI-summarized reports per lab.
 *
 * Schedule: 0 6 * * * (daily at 6 AM UTC = 3 AM São Paulo)
 *
 * RDC 978 Art. 107 — Audit trail monitoring
 * DICQ 4.4 — Compliance audit reporting
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { GoogleGenAI } from '@google/genai';

const db = admin.firestore();
const genaiClient = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

interface AuditAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  anomalyScore: {
    operatorId: string;
    overallScore: number;
    dimensions: Array<{
      dimension: string;
      score: number;
    }>;
  };
  status: 'active' | 'dismissed' | 'resolved';
  createdAt: number;
}

interface ReportSummary {
  entryCount: number;
  alertCount: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
  };
  topAnomalies: string[];
  neverDismissedCount: number;
}

interface AuditReport {
  id: string;
  labId: string;
  period: 'daily';
  summary: ReportSummary;
  nluSummary?: string;
  generatedAt: number;
  createdAt: number;
}

/**
 * Generates NLU summary via Gemini 2.5 Flash
 */
async function nlpSummarizer(summary: ReportSummary): Promise<string> {
  try {
    const prompt = `
You are a quality assurance auditor. Summarize this audit report in 2-3 sentences:
- Total alerts in period: ${summary.alertCount}
- Severity: ${summary.severityBreakdown.critical} critical, ${summary.severityBreakdown.high} high, ${summary.severityBreakdown.medium} medium
- Top anomalies: ${summary.topAnomalies.join(', ')}
- Active (not dismissed): ${summary.neverDismissedCount}

Provide actionable insight suitable for lab RT/admin review.
    `.trim();

    const response = await (genaiClient as any).generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const textContent = (response.candidates?.[0]?.content?.parts?.[0] as any);
    return textContent && 'text' in textContent ? textContent.text : '';
  } catch (error) {
    logger.warn(`NLP summarizer failed: ${error}. Falling back to empty summary.`);
    return '';
  }
}

/**
 * Fetches all active/dismissed alerts for a lab in the last 24 hours
 */
async function fetchRecentAlerts(labId: string, hoursBack: number = 24): Promise<AuditAlert[]> {
  const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;

  try {
    const alertsRef = db.collection(`audit-alerts/${labId}/alerts`);
    const snapshot = await alertsRef
      .where('createdAt', '>=', cutoffTime)
      .where('status', 'in', ['active', 'dismissed'])
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AuditAlert));
  } catch (error) {
    logger.warn(`Failed to fetch alerts for lab ${labId}: ${error}`);
    return [];
  }
}

/**
 * Aggregates metrics from alerts
 */
function aggregateMetrics(alerts: AuditAlert[]): ReportSummary {
  const severityBreakdown = { critical: 0, high: 0, medium: 0 };
  const anomalyCounts: Record<string, number> = {};
  let neverDismissedCount = 0;

  alerts.forEach((alert) => {
    severityBreakdown[alert.severity]++;
    if (alert.status === 'active') {
      neverDismissedCount++;
    }

    // Count top anomaly dimensions
    alert.anomalyScore.dimensions.forEach((dim) => {
      const key = dim.dimension;
      anomalyCounts[key] = (anomalyCounts[key] ?? 0) + 1;
    });
  });

  const topAnomalies = Object.entries(anomalyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return {
    entryCount: alerts.length,
    alertCount: alerts.length,
    severityBreakdown,
    topAnomalies,
    neverDismissedCount,
  };
}

/**
 * Creates a report document in Firestore
 */
async function createReportDoc(labId: string, summary: ReportSummary, nluSummary: string) {
  const reportId = `report-${Date.now()}`;
  const reportData: AuditReport = {
    id: reportId,
    labId,
    period: 'daily',
    summary,
    nluSummary: nluSummary || undefined,
    generatedAt: Date.now(),
    createdAt: admin.firestore.Timestamp.now() as any,
  };

  const reportRef = db.collection(`audit-reports/${labId}/reports`).doc(reportId);
  await reportRef.set(reportData);
  logger.info(`Created report ${reportId} for lab ${labId}`);
  return reportId;
}

/**
 * Main scheduled trigger: processes all labs
 */
export const scheduledAuditReportJob = onSchedule(
  {
    schedule: '0 6 * * *', // 6 AM UTC daily
    timeZone: 'UTC',
  },
  async () => {
    logger.info('Starting scheduled audit report job');

    try {
      // 1. Fetch all active labs
      const labsRef = db.collection('labs');
      const labsSnapshot = await labsRef.limit(500).get(); // Pagination if needed

      let processedCount = 0;
      let errorCount = 0;

      for (const labDoc of labsSnapshot.docs) {
        const labId = labDoc.id;

        try {
          // 2. Fetch recent alerts
          const alerts = await fetchRecentAlerts(labId, 24);

          // Skip labs with no recent alerts
          if (alerts.length === 0) {
            logger.debug(`No alerts for lab ${labId}, skipping report`);
            continue;
          }

          // 3. Aggregate metrics
          const summary = aggregateMetrics(alerts);

          // 4. Generate NLP summary
          const nluSummary = await nlpSummarizer(summary);

          // 5. Create report document
          await createReportDoc(labId, summary, nluSummary);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing lab ${labId}: ${error}`);
          errorCount++;
        }
      }

      logger.info(`Scheduled audit report job completed: ${processedCount} reports created, ${errorCount} errors`);
    } catch (error) {
      logger.error(`Scheduled audit report job failed: ${error}`);
      throw error;
    }
  },
);
