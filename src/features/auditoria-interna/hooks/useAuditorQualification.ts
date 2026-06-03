import { useState, useEffect, useCallback } from 'react';
import type { AuditorQualification, AuditorImpediment } from '../types/auditor';
import {
  subscribeAuditores,
  checkImpediment,
  validateQualification,
} from '../services/auditorQualificationService';

export function useAuditorQualification(labId: string) {
  const [auditores, setAuditores] = useState<AuditorQualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) return;
    setLoading(true);
    const unsubscribe = subscribeAuditores(labId, (data) => {
      setAuditores(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [labId]);

  const getImpediment = useCallback(
    (auditorId: string, bloco: string): AuditorImpediment | null => {
      const auditor = auditores.find((a) => a.id === auditorId);
      if (!auditor) return null;
      return checkImpediment(auditor, bloco);
    },
    [auditores],
  );

  const getValidation = useCallback(
    (auditorId: string) => {
      const auditor = auditores.find((a) => a.id === auditorId);
      if (!auditor) return { valid: false, issues: ['Auditor não encontrado'] };
      return validateQualification(auditor);
    },
    [auditores],
  );

  const qualifiedAuditors = auditores.filter((a) => {
    const { valid } = validateQualification(a);
    return valid && a.status === 'ativo';
  });

  return {
    auditores,
    qualifiedAuditors,
    loading,
    error,
    getImpediment,
    getValidation,
  };
}
