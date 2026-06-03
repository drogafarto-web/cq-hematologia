/**
 * Phase 4 Plan 01 (CLEAN-01): Analytics + Export-Jobs Membership Hardening Tests
 *
 * Validates that TEMP-IMPLANTACAO markers have been replaced with real membership rules.
 * Tests cover rules file validation to ensure membership gates are properly configured.
 *
 * Run: npm run test:unit -- test/integration/cleanup-01-membership-hardening.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Phase 4 (CLEAN-01): Analytics + Export-Jobs Membership Hardening', () => {
  let rulesContent: string;

  beforeEach(() => {
    // Read the firestore.rules file for validation
    const rulesPath = join(process.cwd(), 'firestore.rules');
    rulesContent = readFileSync(rulesPath, 'utf-8');
  });

  describe('Rules File Compliance (CLEAN-01)', () => {
    it('should have no TEMP-IMPLANTACAO markers remaining', () => {
      expect(rulesContent).not.toContain('TEMP-IMPLANTACAO');
    });

    it('should have analytics collection match block', () => {
      expect(rulesContent).toContain('match /analytics/{document=**}');
    });

    it('should have export-jobs collection match block', () => {
      expect(rulesContent).toContain('match /export-jobs/{jobId}');
    });
  });

  describe('Analytics Collection Membership Gate', () => {
    it('should use isActiveMemberOfLab for analytics read access', () => {
      // Extract analytics rule section
      const analyticsMatch = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{([^}]+)\}/s,
      );

      expect(analyticsMatch).toBeTruthy();
      expect(analyticsMatch![1]).toContain(
        'allow read: if isSuperAdmin() || isActiveMemberOfLab(labId)',
      );
    });

    it('should forbid analytics create', () => {
      const analyticsMatch = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{([^}]+)\}/s,
      );

      expect(analyticsMatch).toBeTruthy();
      expect(analyticsMatch![1]).toContain('allow create: if false');
    });

    it('should forbid analytics update', () => {
      const analyticsMatch = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{([^}]+)\}/s,
      );

      expect(analyticsMatch).toBeTruthy();
      expect(analyticsMatch![1]).toContain('allow update: if false');
    });

    it('should forbid analytics delete', () => {
      const analyticsMatch = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{([^}]+)\}/s,
      );

      expect(analyticsMatch).toBeTruthy();
      expect(analyticsMatch![1]).toContain('allow delete: if false');
    });

    it('should document that analytics writes are Cloud Function only', () => {
      expect(rulesContent).toContain('// Via scheduled Cloud Functions only');
    });
  });

  describe('Export-Jobs Collection Membership Gate', () => {
    it('should use isActiveMemberOfLab for export-jobs read access', () => {
      // Extract export-jobs rule section
      const exportMatch = rulesContent.match(/match \/export-jobs\/\{jobId\}\s*\{([^}]+)\}/s);

      expect(exportMatch).toBeTruthy();
      expect(exportMatch![1]).toContain(
        'allow read: if isSuperAdmin() || isActiveMemberOfLab(labId)',
      );
    });

    it('should forbid export-jobs create', () => {
      const exportMatch = rulesContent.match(/match \/export-jobs\/\{jobId\}\s*\{([^}]+)\}/s);

      expect(exportMatch).toBeTruthy();
      expect(exportMatch![1]).toContain('allow create: if false');
    });

    it('should forbid export-jobs update', () => {
      const exportMatch = rulesContent.match(/match \/export-jobs\/\{jobId\}\s*\{([^}]+)\}/s);

      expect(exportMatch).toBeTruthy();
      expect(exportMatch![1]).toContain('allow update: if false');
    });

    it('should forbid export-jobs delete', () => {
      const exportMatch = rulesContent.match(/match \/export-jobs\/\{jobId\}\s*\{([^}]+)\}/s);

      expect(exportMatch).toBeTruthy();
      expect(exportMatch![1]).toContain('allow delete: if false');
    });

    it('should document that export-jobs create is via callable only', () => {
      expect(rulesContent).toContain('// Via callable initiateExport only');
    });

    it('should document that export-jobs update is via Cloud Function only', () => {
      expect(rulesContent).toContain('// Via exportWorker Cloud Function only');
    });

    it('should document that export-jobs delete is never allowed', () => {
      expect(rulesContent).toContain('// Never delete export job records');
    });
  });

  describe('Membership Gate Consistency', () => {
    it('should have identical membership rules for both collections', () => {
      const analyticsMatch = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{([^}]+allow read:[^;]+;)/s,
      );
      const exportMatch = rulesContent.match(
        /match \/export-jobs\/\{jobId\}\s*\{([^}]+allow read:[^;]+;)/s,
      );

      expect(analyticsMatch).toBeTruthy();
      expect(exportMatch).toBeTruthy();

      // Extract the read rules
      const analyticsRead = analyticsMatch![1].match(/allow read:[^;]+;/)?.[0];
      const exportRead = exportMatch![1].match(/allow read:[^;]+;/)?.[0];

      expect(analyticsRead).toBe(exportRead);
      expect(analyticsRead).toContain('isSuperAdmin() || isActiveMemberOfLab(labId)');
    });

    it('should prefer isActiveMemberOfLab over isAuthenticated', () => {
      // Ensure we're not using the old temporary bypass
      const analyticsSection = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{([^}]+)\}/s,
      )?.[1];
      const exportSection = rulesContent.match(
        /match \/export-jobs\/\{jobId\}\s*\{([^}]+)\}/s,
      )?.[1];

      expect(analyticsSection).not.toContain('isAuthenticated()');
      expect(exportSection).not.toContain('isAuthenticated()');
    });
  });

  describe('Compliance Validation (Auditor Review)', () => {
    it('should pass auditor review for CLEAN-01 requirement', () => {
      // Simulates what an auditor would check:
      // 1. No TEMP-IMPLANTACAO markers
      expect(rulesContent).not.toContain('TEMP-IMPLANTACAO');

      // 2. Analytics uses membership gate
      const analyticsRule = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{\s*allow read: if ([^;]+);/,
      )?.[1];
      expect(analyticsRule).toContain('isSuperAdmin()');
      expect(analyticsRule).toContain('isActiveMemberOfLab(labId)');

      // 3. Export-jobs uses membership gate
      const exportRule = rulesContent.match(
        /match \/export-jobs\/\{jobId\}\s*\{\s*allow read: if ([^;]+);/,
      )?.[1];
      expect(exportRule).toContain('isSuperAdmin()');
      expect(exportRule).toContain('isActiveMemberOfLab(labId)');

      // 4. Both follow multi-tenant isolation pattern
      // (no cross-tenant data leakage via isAuthenticated bypass)
      expect(analyticsRule).not.toContain('isAuthenticated()');
      expect(exportRule).not.toContain('isAuthenticated()');
    });

    it('should enforce soft-delete for analytics (no hard delete)', () => {
      const analyticsDelete = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{([^}]+allow delete:[^;]+;)/s,
      )?.[1];

      expect(analyticsDelete).toContain('allow delete: if false');
    });

    it('should enforce soft-delete for export-jobs (audit trail required)', () => {
      const exportDelete = rulesContent.match(
        /match \/export-jobs\/\{jobId\}\s*\{([^}]+allow delete:[^;]+;)/s,
      )?.[1];

      expect(exportDelete).toContain('allow delete: if false');
      expect(rulesContent).toContain('// Never delete export job records');
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing member access to analytics', () => {
      // The rule allows members to read analytics
      const rule = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{\s*allow read: if ([^;]+);/,
      )?.[1];

      // isActiveMemberOfLab(labId) evaluates to true for lab members
      expect(rule).toContain('isActiveMemberOfLab(labId)');
    });

    it('should not break existing member access to export-jobs', () => {
      // The rule allows members to read export-jobs
      const rule = rulesContent.match(
        /match \/export-jobs\/\{jobId\}\s*\{\s*allow read: if ([^;]+);/,
      )?.[1];

      // isActiveMemberOfLab(labId) evaluates to true for lab members
      expect(rule).toContain('isActiveMemberOfLab(labId)');
    });

    it('should allow super admins to read analytics (unchanged)', () => {
      const rule = rulesContent.match(
        /match \/analytics\/\{document=\*\*\}\s*\{\s*allow read: if ([^;]+);/,
      )?.[1];

      expect(rule).toContain('isSuperAdmin()');
    });

    it('should allow super admins to read export-jobs (unchanged)', () => {
      const rule = rulesContent.match(
        /match \/export-jobs\/\{jobId\}\s*\{\s*allow read: if ([^;]+);/,
      )?.[1];

      expect(rule).toContain('isSuperAdmin()');
    });
  });
});
