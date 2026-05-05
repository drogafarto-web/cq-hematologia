import { describe, it, expect } from 'vitest';
import {
  isDownloadExpiringsome,
  formatFileSize,
  formatDuration,
} from '../../../src/features/export/hooks/useExportJobs';

describe('useExportJobs helpers', () => {
  it('detects download expiring within 24h', () => {
    const job = {
      expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000), // 10h from now
    } as any;

    expect(isDownloadExpiringsome(job)).toBe(true);
  });

  it('detects download not expiring soon', () => {
    const job = {
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h from now
    } as any;

    expect(isDownloadExpiringsome(job)).toBe(false);
  });

  it('returns false for null job', () => {
    expect(isDownloadExpiringsome(null)).toBe(false);
  });

  it('formats file size in MB', () => {
    expect(formatFileSize(1024 * 1024)).toContain('1.0');
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });

  it('formats small file size', () => {
    expect(formatFileSize(512 * 1024)).toBe('0.5 MB');
  });

  it('formats processing duration in seconds', () => {
    expect(formatDuration(12000)).toBe('12s');
  });

  it('formats processing duration in minutes and seconds', () => {
    expect(formatDuration(125000)).toContain('m');
  });

  it('formats 2 minute duration', () => {
    expect(formatDuration(120000)).toBe('2m 0s');
  });

  it('handles undefined duration', () => {
    expect(formatDuration(undefined)).toBe('Calculating...');
  });

  it('handles undefined file size', () => {
    expect(formatFileSize(undefined)).toBe('Unknown size');
  });

  it('formats large file size', () => {
    expect(formatFileSize(1024 * 1024 * 100)).toBe('100.0 MB');
  });
});
