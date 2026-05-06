/**
 * usePrivacyPolicy hook — Real-time subscription to current privacy policy
 */

import { useEffect, useState } from 'react';
import { subscribeCurrentPolicy } from '../services/lgpdService';
import type { PolicyVersion } from '../types';

interface UsePrivacyPolicyResult {
  policy: PolicyVersion | null;
  loading: boolean;
}

export function usePrivacyPolicy(labId: string): UsePrivacyPolicyResult {
  const [policy, setPolicy] = useState<PolicyVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeCurrentPolicy(
      labId,
      (data) => {
        setPolicy(data);
        setLoading(false);
      },
      (err) => {
        console.error('[usePrivacyPolicy] subscription error:', err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId]);

  return { policy, loading };
}
