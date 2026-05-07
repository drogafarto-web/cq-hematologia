/**
 * Management Review Types
 * Phase 9 — Governance Framework
 *
 * Implements DICQ 4.15 — Management Review
 * 15 mandatory inputs per DICQ specification
 */

export interface ManagementReviewInput {
  // 1. Audit findings & follow-up status
  auditFindings?: {
    internalAudits: number;
    externalAudits: number;
    openFindings: number;
    capaClosureRate: number; // percentage
  };

  // 2. Internal and external complaints / customer feedback
  complaints?: {
    newComplaints: number;
    totalOpen: number;
    resolutionRate: number; // percentage
    criticalComplaints: number;
  };

  // 3. Non-conformances and CAPA effectiveness
  nonConformances?: {
    newNC: number;
    totalOpen: number;
    capaImplemented: number;
    capaEffectivenessRate: number; // percentage
  };

  // 4. Proficiency testing results (CEQ)
  proficiencyTesting?: {
    roundsCompleted: number;
    passedRounds: number;
    failedRounds: number;
    averageZScore: number;
  };

  // 5. Quality indicators
  qualityIndicators?: {
    turnaroundTime: number; // hours
    errorRate: number; // percentage
    retestPercentage: number;
    reworkPercentage: number;
    ncOrigin: {
      internal: number;
      external: number;
      supplier: number;
    };
  };

  // 6. Equipment performance and maintenance status
  equipment?: {
    totalEquipment: number;
    equipmentUptime: number; // percentage
    calibrationCompliance: number; // percentage
    maintenanceOverdue: number;
  };

  // 7. Risk assessment and mitigation actions
  risksAndMitigation?: {
    totalRisks: number;
    highRiskCount: number;
    mitigationImplemented: number;
    riskReviewDate: string;
  };

  // 8. Staff training and competency assessment
  trainingCompetency?: {
    trainingCompletionRate: number; // percentage
    competencyAssessmentRate: number; // percentage
    trainingGaps: string[];
  };

  // 9. Resource adequacy (budget, equipment, personnel)
  resources?: {
    budgetStatus: 'adequate' | 'at_risk' | 'insufficient';
    equipmentNeeds: string[];
    staffingNeeds: string[];
    safetyIssues: string[];
  };

  // 10. Regulatory changes and compliance status
  regulatory?: {
    newRegulatoryChanges: string[];
    implementationStatus: string;
    complianceGaps: string[];
  };

  // 11. Customer satisfaction and market feedback
  customerSatisfaction?: {
    satisfactionScore: number; // 0-100
    surveyResponseRate: number; // percentage
    marketPositioning: string;
  };

  // 12. Strategic initiatives and progress
  strategicInitiatives?: {
    activeInitiatives: string[];
    completedMilestones: string[];
    delayedItems: string[];
  };

  // 13. Succession planning and organizational changes
  succession?: {
    staffChanges: string[];
    crossTrainingProgress: string;
    keyPersonRisks: string[];
  };

  // 14. Procurement and supplier performance
  procurementSupplier?: {
    supplierCount: number;
    performanceIssues: string[];
    auditsPending: number;
  };

  // 15. Actions from previous management reviews
  priorActions?: {
    totalPriorActions: number;
    closedActions: number;
    overdueActions: number;
  };
}

export interface ManagementReviewMinutes {
  id: string;
  labId: string;
  meetingNumber: string; // e.g., "Q1-2026", "Q2-2026"
  scheduledDate: string; // ISO 8601
  actualDate: string; // ISO 8601
  status: 'scheduled' | 'held' | 'cancelled';
  location: string;
  chair: {
    name: string;
    email: string;
    role: string;
  };
  recorder: {
    name: string;
    email: string;
    role: string;
  };
  attendees: Array<{
    name: string;
    email: string;
    role: string;
    present: boolean;
  }>;
  // 15 DICQ 4.15 mandatory inputs
  inputs: ManagementReviewInput;
  decisions: Array<{
    topic: string;
    decision: string;
    approval: boolean;
    notes: string;
  }>;
  actionItems: Array<{
    id: string;
    description: string;
    owner: string;
    targetDate: string;
    successCriteria: string;
    status: 'open' | 'in_progress' | 'completed';
  }>;
  qualityPlanUpdates?: {
    objectivesUpdated: boolean;
    kpiTargetsUpdated: boolean;
    staffingChanges: boolean;
    otherChanges: string;
  };
  // Metadata
  createdAt: string; // ISO 8601
  createdBy: string; // uid
  lastModifiedAt: string; // ISO 8601
  lastModifiedBy: string; // uid
  signedAt?: string;
  signedBy?: string; // uid of QD/Chair
  deletedAt?: string;
}

export interface ManagementReviewCalendar {
  id: string;
  labId: string;
  year: number;
  meetings: Array<{
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    scheduledDate: string; // ISO 8601
    chair: string; // name
    primaryFocus: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
