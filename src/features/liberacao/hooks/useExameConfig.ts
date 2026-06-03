import { useEffect, useState } from 'react';
import { ExameConfig } from '../types/exameConfig';
import { subscribeExameConfigs, getExameConfig } from '../services/exameConfigService';
import { useActiveLabId } from '../../../store/useAuthStore';

/**
 * Hook para gerenciar configurações de exame em tempo real
 */
export function useExameConfigs() {
  const [configs, setConfigs] = useState<ExameConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const currentLabId = useActiveLabId();

  useEffect(() => {
    if (!currentLabId) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeExameConfigs(
      currentLabId,
      (data) => {
        setConfigs(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [currentLabId]);

  return { configs, loading, error };
}

/**
 * Hook para buscar config de exame por código
 */
export function useExameConfigByCode(examCode: string) {
  const [config, setConfig] = useState<ExameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const currentLabId = useActiveLabId();

  useEffect(() => {
    if (!currentLabId || !examCode) {
      setConfig(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getExameConfig(currentLabId, examCode)
      .then((config) => {
        setConfig(config);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [currentLabId, examCode]);

  return { config, loading, error };
}
