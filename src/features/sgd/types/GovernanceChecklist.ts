/**
 * Governance Checklist Type Definitions
 * Phase 9 — Manual Qualidade + Governance Framework
 *
 * Maps to PHASE_9_GOVERNANCE_CHECKLIST.json
 * Integration points: sgd, labSettings, auditoria, educacao-continuada, kpis
 */

export interface GovernanceItem {
  id: string; // e.g., "A-001", "D-003", "E-004", "G-001"
  requirement: string; // Plain-text requirement description
  dicq_ref: string; // e.g., "4.1.1.2", "4.14.6"
  rdc_ref: string; // e.g., "RDC 978 Art. 77"
  description: string; // Detailed explanation
  owner: string; // Assigned role or name
  status: 'pending' | 'in_progress' | 'completed'; // Current status
  due_date: string; // ISO 8601 date
  completion_date: string | null; // ISO 8601 date when completed
  evidence: string; // Where evidence is stored (module path or Drive link)
  frequency: string; // e.g., "Annual review", "Quarterly execution"
  last_verified: string | null; // Last audit/verification date
  notes: string; // Additional context
  compliance_percentage: number; // 0-100
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface GovernanceCategory {
  title: string;
  dicq_sections: string[];
  v13_baseline: string; // e.g., "78%"
  v14_target: string; // e.g., "92%"
  items: GovernanceItem[];
}

export interface GovernanceStructure {
  quality_director: {
    name: string;
    email: string;
    phone: string;
    crea_crmv: string;
    since: string;
    substitutes: Array<{
      name: string;
      crea_crmv: string;
      since: string;
    }>;
  };
  management_review_chair: {
    name: string;
    email: string;
    frequency: string;
    next_scheduled: string;
    minutes_template_url: string;
  };
  internal_audit_coordinator: {
    name: string;
    email: string;
    since: string;
    audit_plan_url: string;
  };
  document_controller: {
    name: string;
    email: string;
    since: string;
    sgd_access: 'admin' | 'editor' | 'viewer';
  };
}

export interface GovernanceSummary {
  total_items: number;
  completed: number;
  pending: number;
  overdue: number;
  completion_percentage: number;
  status: 'Not Started' | 'In Progress' | 'On Track' | 'At Risk' | 'Complete';
  last_review_date: string | null;
  next_review_due: string;
}

export interface GovernanceAlertRule {
  threshold_days: number;
  severity: 'green' | 'yellow' | 'orange' | 'red';
  trigger: string; // Boolean expression
  action: string; // Escalation action
}

export interface GovernanceChecklist {
  metadata: {
    version: string;
    phase: string;
    created: string;
    lastUpdated: string;
    project: string;
    compliance_frameworks: string[];
    dicq_blocks: string[];
    total_items: number;
    cutoff_overdue_days: number;
  };
  summary: GovernanceSummary;
  governance_structure: GovernanceStructure;
  categories: {
    A_GOVERNANCE: GovernanceCategory;
    D_QUALITY_COMPLIANCE: GovernanceCategory;
    E_PRE_ANALYTICAL: GovernanceCategory;
    ADDITIONAL_GOVERNANCE: GovernanceCategory;
  };
  alert_rules: {
    overdue: GovernanceAlertRule;
    at_risk: GovernanceAlertRule;
    completion_lag: GovernanceAlertRule;
  };
  export_formats: {
    pdf_report: string;
    excel_tracker: string;
    management_review_input: string;
  };
  integration_points: {
    educacao_continuada: string;
    sgd: string;
    auditoria: string;
    capa: string;
    kpis: string;
    labSettings: string;
    complaints: string;
  };
  success_criteria: {
    phase_9_gate: string;
    audit_readiness: string;
    governance_maturity: string;
  };
}
