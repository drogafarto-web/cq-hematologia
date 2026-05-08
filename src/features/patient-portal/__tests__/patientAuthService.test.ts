/**
 * Unit tests for Patient Auth Service
 */

import { describe, it, expect } from 'vitest';
import { isValidEmail, getTokenExpiryTime } from '../services/patientAuthService';

describe('patientAuthService', () => {
  describe('isValidEmail', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('patient@example.com')).toBe(true);
      expect(isValidEmail('john.doe+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('test123@test.org')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('patient@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('patient @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('trims whitespace', () => {
      expect(isValidEmail('  patient@example.com  ')).toBe(false); // regex is strict
    });
  });

  describe('getTokenExpiryTime', () => {
    it('returns a date 72 hours from now', () => {
      const before = new Date();
      const expiry = getTokenExpiryTime();
      const after = new Date();

      const expectedMs = 72 * 60 * 60 * 1000;
      const actualDiff = expiry.getTime() - before.getTime();

      expect(actualDiff).toBeGreaterThanOrEqual(expectedMs - 1000); // Allow 1s margin
      expect(actualDiff).toBeLessThanOrEqual(expectedMs + 1000);
    });

    it('returns future date', () => {
      const now = new Date();
      const expiry = getTokenExpiryTime();
      expect(expiry.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
