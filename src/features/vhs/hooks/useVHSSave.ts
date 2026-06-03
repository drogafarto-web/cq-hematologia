import { useCallback, useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import type { VHSExamInput, VHSLeituraInput } from '../types/VHSExam';
import { useVHSSignature } from './useVHSSignature';
import { saveVHSExam, addLeitura2, liberarDivergente, cancelarExame } from '../services/vhsService';

// ─── Helper: build signature payload ───────────────────────────────────────
function buildSigPayload(
  amostra: string,
  leitura: VHSLeituraInput,
  metodo: 'westergren' | 'automatizado',
) {
  return {
    amostra,
    valor: leitura.valor,
    responsavel: leitura.responsavelNome,
    leituraEm: leitura.leituraEm.toISOString(),
    met: metodo,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useVHSSave(labId: string) {
  const user = useUser();
  const { sign } = useVHSSignature();

  const [saveLoading, setSaveLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // ── saveExam: cria exame com 1 ou 2 leituras ──────────────────────────
  const saveExam = useCallback(
    async (input: VHSExamInput): Promise<string | null> => {
      if (!user) {
        setSaveError('Usuário não autenticado');
        return null;
      }

      setSaveLoading(true);
      setSaveError(null);

      try {
        const sig1 = await sign(buildSigPayload(input.amostraId, input.leitura1, input.metodo));

        let sig2: string | undefined;
        if (input.leitura2) {
          sig2 = await sign(buildSigPayload(input.amostraId, input.leitura2, input.metodo));
        }

        const examId = await saveVHSExam(labId, input, sig1, user.uid, sig2);

        return examId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar exame';
        setSaveError(msg);
        return null;
      } finally {
        setSaveLoading(false);
      }
    },
    [user, labId, sign],
  );

  // ── completeExam: adiciona leitura 2 em exame pendente ────────────────
  const completeExam = useCallback(
    async (
      examId: string,
      leitura2: VHSLeituraInput,
      amostraId: string,
      metodo: 'westergren' | 'automatizado',
    ) => {
      if (!user) {
        setCompleteError('Usuário não autenticado');
        return false;
      }

      setCompleteLoading(true);
      setCompleteError(null);

      try {
        const sig2 = await sign(buildSigPayload(amostraId, leitura2, metodo));
        await addLeitura2(labId, examId, { leitura2 }, sig2, user.uid);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao completar exame';
        setCompleteError(msg);
        return false;
      } finally {
        setCompleteLoading(false);
      }
    },
    [user, labId, sign],
  );

  // ── approveDivergent: RT aprova exame divergente ───────────────────────
  const approveDivergent = useCallback(
    async (examId: string, motivo: string) => {
      if (!user) {
        setApproveError('Usuário não autenticado');
        return false;
      }

      if (!motivo || motivo.trim().length < 10) {
        setApproveError('Motivo deve ter pelo menos 10 caracteres');
        return false;
      }

      setApproveLoading(true);
      setApproveError(null);

      try {
        await liberarDivergente(labId, examId, user.uid, { motivo });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao aprovar exame';
        setApproveError(msg);
        return false;
      } finally {
        setApproveLoading(false);
      }
    },
    [user, labId],
  );

  // ── cancelExam: cancela exame ──────────────────────────────────────────
  const cancelExam = useCallback(
    async (examId: string, motivo: string) => {
      if (!user) {
        setCancelError('Usuário não autenticado');
        return false;
      }

      if (!motivo || motivo.trim().length < 5) {
        setCancelError('Motivo deve ter pelo menos 5 caracteres');
        return false;
      }

      setCancelLoading(true);
      setCancelError(null);

      try {
        await cancelarExame(labId, examId, user.uid, motivo);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao cancelar exame';
        setCancelError(msg);
        return false;
      } finally {
        setCancelLoading(false);
      }
    },
    [user, labId],
  );

  return {
    saveExam,
    completeExam,
    approveDivergent,
    cancelExam,
    saveLoading,
    completeLoading,
    approveLoading,
    cancelLoading,
    saveError,
    completeError,
    approveError,
    cancelError,
  };
}
