import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import {
  subscribeCertificados,
  type SubscribeCertificadosOptions,
} from '../services/ecFirebaseService';
import type { Certificado } from '../types/EducacaoContinuada';

export interface GerarCertificadoResult {
  certificadoId: string;
  pdfDownloadUrl: string;
  qrCodePayload: string;
}

export interface UseCertificadosResult {
  certificados: Certificado[];
  isLoading: boolean;
  error: Error | null;
  /** Gera certificado via callable (PDF + QR + Storage + doc). */
  gerar: (avaliacaoCompetenciaId: string) => Promise<GerarCertificadoResult>;
}

interface GerarWire {
  labId: string;
  avaliacaoCompetenciaId: string;
}
interface GerarResp {
  ok: true;
  certificadoId: string;
  pdfDownloadUrl: string;
  qrCodePayload: string;
}

const callGerar = httpsCallable<GerarWire, GerarResp>(functions, 'ec_gerarCertificado');

function unwrapErr(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(fallback);
}

export function useCertificados(
  options: SubscribeCertificadosOptions = {},
): UseCertificadosResult {
  const labId = useActiveLabId();
  const { colaboradorId, treinamentoId } = options;

  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setCertificados([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeCertificados(
      labId,
      { colaboradorId, treinamentoId },
      (list) => {
        setCertificados(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [labId, colaboradorId, treinamentoId]);

  const gerar = useCallback(
    async (avaliacaoCompetenciaId: string): Promise<GerarCertificadoResult> => {
      if (!labId) throw new Error('Sem lab ativo.');
      try {
        const resp = await callGerar({ labId, avaliacaoCompetenciaId });
        return {
          certificadoId: resp.data.certificadoId,
          pdfDownloadUrl: resp.data.pdfDownloadUrl,
          qrCodePayload: resp.data.qrCodePayload,
        };
      } catch (err) {
        throw unwrapErr(err, 'Erro ao gerar certificado.');
      }
    },
    [labId],
  );

  return { certificados, isLoading, error, gerar };
}
