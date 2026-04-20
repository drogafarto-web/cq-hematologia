/**
 * Composite Indexes necessários (criar em firestore.indexes.json):
 * 1. labs/{labId}/runs: confirmedAt ASC + labId ASC
 * 2. labs/{labId}/runs: confirmedAt ASC + labId ASC + level ASC
 * 3. labs/{labId}/runs: confirmedAt ASC + labId ASC + operatorId ASC
 * 4. labs/{labId}/runs: confirmedAt ASC + labId ASC + status ASC
 */

import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { CQRun, ReportFilters, ReportStats, OperatorStat } from '../../../types';

export function useRunReports(filters: ReportFilters) {
  const [runs, setRuns]       = useState<CQRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Desestruturar em primitivas para evitar infinite loop
  // (objeto filters recriado a cada render do pai causaria loop)
  const { labId, startDate, endDate, operatorId, level, status } = filters;

  useEffect(() => {
    let q: Query<DocumentData> = query(
      collection(db, `labs/${labId}/runs`),
      where('confirmedAt', '>=', startDate),
      where('confirmedAt', '<=', endDate),
      orderBy('confirmedAt', 'desc'),
      limit(500)
    );

    if (operatorId) q = query(q, where('operatorId', '==', operatorId));
    if (level)      q = query(q, where('level', '==', level));
    if (status)     q = query(q, where('status', '==', status));

    const fetchRuns = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          ...(doc.data() as CQRun),
          id: doc.id,
        }));
        setRuns(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
   
  }, [labId, startDate, endDate, operatorId, level, status]);

  const stats = useMemo((): ReportStats => {
    if (runs.length === 0) {
      return { totalRuns: 0, editedByHuman: 0, approvalRate: 0, westgardByRule: {}, byOperator: [] };
    }

    const totalRuns    = runs.length;
    const editedByHuman = runs.filter(r => r.isEdited).length;
    const approved     = runs.filter(r => r.status === 'Aprovada').length;
    const approvalRate = approved / totalRuns;

    const westgardByRule: Record<string, number> = {};
    runs.forEach(run => {
      run.westgardViolations?.forEach(v => {
        westgardByRule[v] = (westgardByRule[v] ?? 0) + 1;
      });
    });

    type OpAcc = OperatorStat & { approvedCount: number };

    const byOperator = Object.values(
      runs.reduce<Record<string, OpAcc>>((acc, run) => {
        if (!acc[run.operatorId]) {
          acc[run.operatorId] = {
            operatorId:    run.operatorId,
            operatorName:  run.operatorName,
            totalRuns:     0,
            editedRuns:    0,
            approvalRate:  0,
            approvedCount: 0,
          };
        }
        const op = acc[run.operatorId]!;
        op.totalRuns += 1;
        if (run.isEdited)              op.editedRuns += 1;
        if (run.status === 'Aprovada') op.approvedCount += 1;
        return acc;
      }, {})
    ).map(({ approvedCount, ...op }) => ({
      ...op,
      approvalRate: op.totalRuns > 0 ? approvedCount / op.totalRuns : 0,
    }));

    return { totalRuns, editedByHuman, approvalRate, westgardByRule, byOperator };
  }, [runs]);

  return { runs, loading, error, stats };
}
