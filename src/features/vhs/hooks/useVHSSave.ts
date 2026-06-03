import { useCallback, useState } from 'react';
import { useUser, useActiveLab } from '../../../store/useAuthStore';
import { useVHSSignature } from './useVHSSignature';
import {
  saveLeitura1,
  saveLeitura2,
  liberarDivergente,
  cancelarExame,
  getVHSExam,
} from '../services/vhsService';
import { VHS_TOLERANCIA_MM_H } from '../constants/vhsConstants';
import type {
  VHSExam,
  VHSExamInputLeitura1,
  VHSExamInputLeitura2,
  VHSDivergencia,
} from '../types/VHSExam';

export interface UseVHSSaveResult {
  /** Executa a primeira leitura do exame (operador 1). */
  saveFirstReading: (input: VHSExamInputLeitura1) => Promise<VHSExam>;
  /** Executa a segunda leitura e resolve divergência automaticamente. */
  saveSecondReading: (examId: string, input: VHSExamInputLeitura2) => Promise<VHSExam>;
  /** Libera exame divergente manualmente pelo RT/admin. */
  approveDivergent: (examId: string, motivo: string) => Promise<void>;
  /** Cancela um exame. */
  cancelExam: (examId: string, motivo: string) => Promise<void>;
  oneLoading: boolean;
  twoLoading: boolean;
  approveLoading: boolean;
  cancelLoading: boolean;
  errors: Record<string, string | null>;
}

/**
 * Hook que orquestra o fluxo de dupla verificação de VHS.
 *
 * Implementa as quatro ações regulatórias do módulo, incluindo geração
 * de assinatura SHA-256, cálculo de divergência e validações de negócio
 * exigidas pela RDC 978 Art. 128 (dupla conferência).
 */
export function useVHSSave(): UseVHSSaveResult {
  const user = useUser();
  const activeLab = useActiveLab();
  const { sign } = useVHSSignature();

  const [oneLoading, setOneLoading] = useState(false);
  const [twoLoading, setTwoLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const setError = useCallback((key: string, message: string | null) => {
    setErrors((prev) => ({ ...prev, [key]: message }));
  }, []);

  const clearError = useCallback(
    (key: string) => {
      setError(key, null);
    },
    [setError],
  );

  /**
   * Operador 1 registra o exame com a primeira leitura.
   *
   * Gera assinatura lógica SHA-256 sobre o payload canônico
   * (amostra, valor, operador, método, data) e persiste o documento.
   */
  const saveFirstReading = useCallback(
    async (input: VHSExamInputLeitura1): Promise<VHSExam> => {
      if (!user) throw new Error('Usuário não autenticado');
      if (!activeLab?.id) throw new Error('Laboratório ativo não selecionado');

      setOneLoading(true);
      clearError('one');

      try {
        const today = new Date().toISOString().slice(0, 10);
        const sigResult = await sign({
          amostra: input.amostraId,
          v1: input.leitura1.valor,
          op: input.leitura1.operadorId,
          met: input.metodo,
          date: today,
        });

        const exam = await saveLeitura1(activeLab.id, input, sigResult.logicalSignature);
        return exam;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar primeira leitura';
        setError('one', message);
        throw new Error(message);
      } finally {
        setOneLoading(false);
      }
    },
    [user, activeLab, sign, clearError, setError],
  );

  /**
   * Operador 2 registra a segunda leitura.
   *
   * Regras:
   * - Exame deve estar com status 'pendente'.
   * - Operador 2 deve ser diferente do operador 1 (RDC 978 Art. 128).
   * - Calcula delta entre leitura 2 e leitura 1.
   * - Se |delta| ≤ 3 mm/h: status 'liberado'.
   * - Se |delta| > 3 mm/h: status 'divergente' com registro da divergência.
   */
  const saveSecondReading = useCallback(
    async (examId: string, input: VHSExamInputLeitura2): Promise<VHSExam> => {
      if (!user) throw new Error('Usuário não autenticado');
      if (!activeLab?.id) throw new Error('Laboratório ativo não selecionado');

      setTwoLoading(true);
      clearError('two');

      try {
        const exam = await getVHSExam(activeLab.id, examId);
        if (!exam) throw new Error('Exame não encontrado');
        if (exam.status !== 'pendente')
          throw new Error('O exame não está pendente de segunda leitura');
        if (input.leitura2.operadorId === exam.leitura1.operadorId) {
          throw new Error('O segundo operador deve ser diferente do primeiro (RDC 978 Art. 128)');
        }

        const delta = input.leitura2.valor - exam.leitura1.valor;
        const withinTolerance = Math.abs(delta) <= VHS_TOLERANCIA_MM_H;

        const status = withinTolerance ? 'liberado' : 'divergente';
        let divergencia: VHSDivergencia | undefined;
        if (!withinTolerance) {
          divergencia = { delta, tolerancia: VHS_TOLERANCIA_MM_H };
        }

        const today = new Date().toISOString().slice(0, 10);
        const sigResult = await sign({
          amostra: exam.amostraId,
          v1: input.leitura2.valor,
          op: input.leitura2.operadorId,
          met: exam.metodo,
          date: today,
        });

        await saveLeitura2(
          activeLab.id,
          examId,
          input,
          sigResult.logicalSignature,
          status,
          divergencia,
        );

        const updated = await getVHSExam(activeLab.id, examId);
        if (!updated) throw new Error('Erro ao recuperar exame atualizado');
        return updated;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar segunda leitura';
        setError('two', message);
        throw new Error(message);
      } finally {
        setTwoLoading(false);
      }
    },
    [user, activeLab, sign, clearError, setError],
  );

  /**
   * RT ou admin libera um exame marcado como divergente.
   *
   * Exige justificativa documentada com no mínimo 10 caracteres,
   * conforme RDC 978 Art. 128.
   */
  const approveDivergent = useCallback(
    async (examId: string, motivo: string): Promise<void> => {
      if (!user) throw new Error('Usuário não autenticado');
      if (!activeLab?.id) throw new Error('Laboratório ativo não selecionado');
      if (motivo.length < 10) throw new Error('Motivo deve ter no mínimo 10 caracteres');

      setApproveLoading(true);
      clearError('approve');

      try {
        await liberarDivergente(activeLab.id, examId, user.uid, motivo);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao liberar exame divergente';
        setError('approve', message);
        throw new Error(message);
      } finally {
        setApproveLoading(false);
      }
    },
    [user, activeLab, clearError, setError],
  );

  /**
   * Cancela um exame.
   *
   * Exige motivo com no mínimo 5 caracteres.
   */
  const cancelExam = useCallback(
    async (examId: string, motivo: string): Promise<void> => {
      if (!user) throw new Error('Usuário não autenticado');
      if (!activeLab?.id) throw new Error('Laboratório ativo não selecionado');
      if (motivo.length < 5) throw new Error('Motivo deve ter no mínimo 5 caracteres');

      setCancelLoading(true);
      clearError('cancel');

      try {
        await cancelarExame(activeLab.id, examId, user.uid, motivo);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao cancelar exame';
        setError('cancel', message);
        throw new Error(message);
      } finally {
        setCancelLoading(false);
      }
    },
    [user, activeLab, clearError, setError],
  );

  return {
    saveFirstReading,
    saveSecondReading,
    approveDivergent,
    cancelExam,
    oneLoading,
    twoLoading,
    approveLoading,
    cancelLoading,
    errors,
  };
}
