/**
 * useCertificateUpload.ts
 *
 * Manages certificate file upload state and error handling.
 *
 * Returns: { file, progress, error, upload, clear }
 */

import { useState } from 'react';
import { uploadCertificate } from '../services/certificateUploadService';
import type { CertificateUpload } from '../types/index';

export interface UseCertificateUploadResult {
  file: File | null;
  progress: number; // 0-100
  error: Error | null;
  upload: (file: File, labId: string, equipId: string, operatorId: string) => Promise<CertificateUpload>;
  clear: () => void;
}

export function useCertificateUpload(): UseCertificateUploadResult {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const upload = async (
    selectedFile: File,
    labId: string,
    equipId: string,
    operatorId: string,
  ): Promise<CertificateUpload> => {
    try {
      setError(null);
      setProgress(0);
      setFile(selectedFile);

      const cert = await uploadCertificate(
        selectedFile,
        labId,
        equipId,
        operatorId,
        (pct) => setProgress(pct),
      );

      setProgress(100);
      return cert;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  };

  const clear = () => {
    setFile(null);
    setProgress(0);
    setError(null);
  };

  return { file, progress, error, upload, clear };
}
