/**
 * Governance Checklist Service
 * Phase 9 — Manual Qualidade + Governance Framework
 *
 * Manages:
 * - Reading/writing governance items
 * - Calculating completion percentages
 * - Detecting overdue items
 * - Generating alerts
 * - Exporting for Management Review
 */

import { db } from '@/shared/services/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  GovernanceChecklist,
  GovernanceItem,
  GovernanceSummary,
  GovernanceAlertRule,
} from '../types/GovernanceChecklist';

const GOVERNANCE_COLLECTION = 'governance-checklist';
const OVERDUE_THRESHOLD_DAYS = 30;
const AT_RISK_THRESHOLD_DAYS = 7;

export class GovernanceChecklistService {
  /**
   * Load full governance checklist for a lab
   */
  static async loadChecklist(labId: string): Promise<GovernanceChecklist | null> {
    try {
      const checklistRef = doc(db, `labs/${labId}/${GOVERNANCE_COLLECTION}/config`);
      const snapshot = await getDoc(checklistRef);
      return snapshot.data() as GovernanceChecklist | null;
    } catch (error) {
      console.error('[GovernanceChecklist] Error loading checklist:', error);
      return null;
    }
  }

  /**
   * Initialize or update governance checklist from JSON template
   */
  static async initializeChecklist(
    labId: string,
    templateData: GovernanceChecklist,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const checklistRef = doc(db, `labs/${labId}/${GOVERNANCE_COLLECTION}/config`);

      // Timestamp metadata
      const updatedTemplate = {
        ...templateData,
        metadata: {
          ...templateData.metadata,
          lastUpdated: new Date().toISOString(),
        },
      };

      await updateDoc(checklistRef, updatedTemplate);

      return {
        success: true,
        message: `Checklist initialized for lab ${labId}`,
      };
    } catch (error) {
      console.error('[GovernanceChecklist] Error initializing checklist:', error);
      return {
        success: false,
        message: `Failed to initialize checklist: ${error}`,
      };
    }
  }

  /**
   * Get all items for a specific DICQ block
   */
  static async getItemsByBlock(
    labId: string,
    blockId: 'A' | 'D' | 'E' | 'G',
  ): Promise<GovernanceItem[]> {
    try {
      const checklist = await this.loadChecklist(labId);
      if (!checklist) return [];

      const blockKey = {
        A: 'A_GOVERNANCE',
        D: 'D_QUALITY_COMPLIANCE',
        E: 'E_PRE_ANALYTICAL',
        G: 'ADDITIONAL_GOVERNANCE',
      }[blockId];

      return checklist.categories[blockKey as keyof typeof checklist.categories]?.items || [];
    } catch (error) {
      console.error(`[GovernanceChecklist] Error fetching block ${blockId} items:`, error);
      return [];
    }
  }

  /**
   * Update a single governance item status
   */
  static async updateItem(
    labId: string,
    itemId: string,
    updates: Partial<GovernanceItem>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const itemRef = doc(db, `labs/${labId}/${GOVERNANCE_COLLECTION}/items/${itemId}`);

      const auditEntry = {
        itemId,
        previousStatus: null, // Will be set in audit trail
        newStatus: updates.status || null,
        completionPercentage: updates.compliance_percentage || null,
        updatedAt: serverTimestamp(),
        updatedBy: null, // Will be set from context.auth
      };

      const batch = writeBatch(db);
      batch.update(itemRef, {
        ...updates,
        lastUpdated: new Date().toISOString(),
      });

      // Audit trail entry
      const auditRef = doc(
        db,
        `labs/${labId}/${GOVERNANCE_COLLECTION}/audit/${`${itemId}-${Date.now()}`}`,
      );
      batch.set(auditRef, auditEntry);

      await batch.commit();

      return {
        success: true,
        message: `Item ${itemId} updated successfully`,
      };
    } catch (error) {
      console.error('[GovernanceChecklist] Error updating item:', error);
      return {
        success: false,
        message: `Failed to update item: ${error}`,
      };
    }
  }

  /**
   * Calculate completion percentage for a category or entire checklist
   */
  static calculateCompletionPercentage(items: GovernanceItem[]): number {
    if (items.length === 0) return 0;

    const completed = items.filter((item) => item.status === 'completed').length;
    const inProgress = items.filter((item) => item.status === 'in_progress').length;

    // Formula: completed 100%, in_progress 50%, pending 0%
    const score = (completed * 100 + inProgress * 50) / (items.length * 100);
    return Math.round(score * 100);
  }

  /**
   * Detect overdue items (due_date < today - cutoff_days)
   */
  static detectOverdueItems(
    items: GovernanceItem[],
    cutoffDays = OVERDUE_THRESHOLD_DAYS,
  ): GovernanceItem[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

    return items.filter((item) => {
      if (item.status === 'completed' || !item.due_date) return false;
      return new Date(item.due_date) < cutoffDate;
    });
  }

  /**
   * Detect items at risk (due within 7 days)
   */
  static detectAtRiskItems(
    items: GovernanceItem[],
    warningDays = AT_RISK_THRESHOLD_DAYS,
  ): GovernanceItem[] {
    const today = new Date();
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);

    return items.filter((item) => {
      if (item.status === 'completed' || !item.due_date) return false;
      const itemDate = new Date(item.due_date);
      return itemDate >= today && itemDate <= warningDate;
    });
  }

  /**
   * Generate summary for Management Review
   */
  static generateSummary(checklist: GovernanceChecklist): GovernanceSummary {
    const allItems = Object.values(checklist.categories).flatMap((cat) => cat.items);
    const completed = allItems.filter((item) => item.status === 'completed').length;
    const pending = allItems.filter((item) => item.status === 'pending').length;
    const overdue = this.detectOverdueItems(allItems).length;

    const completionPercentage = this.calculateCompletionPercentage(allItems);

    let status: GovernanceSummary['status'] = 'Not Started';
    if (completionPercentage >= 100) status = 'Complete';
    else if (completionPercentage >= 80) status = 'On Track';
    else if (overdue > 0) status = 'At Risk';
    else if (completionPercentage > 0) status = 'In Progress';

    return {
      total_items: allItems.length,
      completed,
      pending,
      overdue,
      completion_percentage: completionPercentage,
      status,
      last_review_date: checklist.summary.last_review_date,
      next_review_due: checklist.summary.next_review_due,
    };
  }

  /**
   * Export governance items for Management Review minutes
   */
  static exportForManagementReview(checklist: GovernanceChecklist): string {
    const summary = this.generateSummary(checklist);
    const allItems = Object.values(checklist.categories).flatMap((cat) => cat.items);
    const overdueItems = this.detectOverdueItems(allItems);
    const atRiskItems = this.detectAtRiskItems(allItems);

    let output = '# Governance Checklist — Management Review Input\n\n';
    output += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
    output += `**Completion:** ${summary.completion_percentage}% (${summary.completed}/${summary.total_items} completed)\n`;
    output += `**Status:** ${summary.status}\n\n`;

    if (overdueItems.length > 0) {
      output += '## ⚠️ OVERDUE ITEMS (>30 days)\n\n';
      overdueItems.forEach((item) => {
        output += `- **${item.id}:** ${item.requirement}\n`;
        output += `  - Owner: ${item.owner}\n`;
        output += `  - Due: ${item.due_date}\n\n`;
      });
    }

    if (atRiskItems.length > 0) {
      output += '## ⏰ AT RISK ITEMS (due within 7 days)\n\n';
      atRiskItems.forEach((item) => {
        output += `- **${item.id}:** ${item.requirement}\n`;
        output += `  - Owner: ${item.owner}\n`;
        output += `  - Due: ${item.due_date}\n\n`;
      });
    }

    output += '## Summary by DICQ Block\n\n';
    Object.entries(checklist.categories).forEach(([blockKey, category]) => {
      const blockCompletion = this.calculateCompletionPercentage(category.items);
      output += `**Block ${blockKey.split('_')[0]}** (${category.title})\n`;
      output += `- Completion: ${blockCompletion}% (${category.items.filter((i) => i.status === 'completed').length}/${category.items.length})\n`;
      output += `- Target: ${category.v14_target}\n\n`;
    });

    return output;
  }

  /**
   * Check if Phase 9 gate criteria are met
   * A-001..A-007, D-001..D-010, E-001..E-005 must be ≥80% complete
   */
  static async checkPhase9GateCriteria(labId: string): Promise<{
    gateMet: boolean;
    blockACompletion: number;
    blockDCompletion: number;
    blockECompletion: number;
    details: string;
  }> {
    try {
      const checklist = await this.loadChecklist(labId);
      if (!checklist)
        return {
          gateMet: false,
          blockACompletion: 0,
          blockDCompletion: 0,
          blockECompletion: 0,
          details: 'Checklist not found',
        };

      const blockA = checklist.categories.A_GOVERNANCE.items.slice(0, 7);
      const blockD = checklist.categories.D_QUALITY_COMPLIANCE.items.slice(0, 10);
      const blockE = checklist.categories.E_PRE_ANALYTICAL.items;

      const completionA = this.calculateCompletionPercentage(blockA);
      const completionD = this.calculateCompletionPercentage(blockD);
      const completionE = this.calculateCompletionPercentage(blockE);

      const gateMet = completionA >= 80 && completionD >= 80 && completionE >= 80;

      return {
        gateMet,
        blockACompletion: completionA,
        blockDCompletion: completionD,
        blockECompletion: completionE,
        details: `Block A: ${completionA}% | Block D: ${completionD}% | Block E: ${completionE}%`,
      };
    } catch (error) {
      console.error('[GovernanceChecklist] Error checking Phase 9 gate:', error);
      return {
        gateMet: false,
        blockACompletion: 0,
        blockDCompletion: 0,
        blockECompletion: 0,
        details: `Error: ${error}`,
      };
    }
  }
}
