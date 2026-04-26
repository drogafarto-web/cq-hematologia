/**
 * useDocumentos — hook canônico do módulo SGQ.
 *
 * Fat hook: subscreve real-time, expõe ações com validação de RN-* e mantém
 * estado mínimo (loading + error). Service só faz CRUD bruto.
 *
 * RN-SGQ-01 — código único por lab dentro de não-deletados.
 * RN-SGQ-02 — transições válidas:
 *               em_revisao → vigente | obsoleto
 *               vigente    → em_revisao | obsoleto (com motivo)
 *               obsoleto   → ∅ (terminal)
 * RN-SGQ-03 — emitir revisão exige doc anterior em status `vigente`.
 * RN-SGQ-04 — soft-delete só permitido em `em_revisao`.
 * RN-SGQ-05 — versão monotônica: emitir revisão sobe versao em +1.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  documentoService,
} from '../services/documentoService';
import type {
  Documento,
  DocumentoFilters,
  DocumentoInput,
  StatusDocumento,
} from '../types/Documento';

import { useActiveLabId, useUser } from '../../../store/useAuthStore';

// ─── Transition graph ────────────────────────────────────────────────────────

const TRANSITIONS: Record<StatusDocumento, StatusDocumento[]> = {
  em_revisao: ['vigente', 'obsoleto'],
  vigente: ['em_revisao', 'obsoleto'],
  obsoleto: [],
};

export function isTransitionAllowed(
  from: StatusDocumento,
  to: StatusDocumento,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseDocumentosOptions {
  filters?: DocumentoFilters;
}

export interface UseDocumentosResult {
  documentos: Documento[];
  isLoading: boolean;
  error: string | null;

  /** Cadastra documento novo em `em_revisao`. Valida unicidade do código. */
  criar: (input: DocumentoInput) => Promise<string>;
  /** Atualiza metadata de um documento. */
  atualizar: (id: string, patch: Partial<DocumentoInput>) => Promise<void>;
  /** Transita status (com validação de transição válida). */
  mudarStatus: (
    id: string,
    toStatus: StatusDocumento,
    motivo?: string,
  ) => Promise<void>;
  /** Emite nova versão substituindo a anterior em batch atomic. */
  emitirRevisao: (anteriorId: string, novaInput: DocumentoInput) => Promise<string>;
  /** Soft-delete — só permitido em `em_revisao`. */
  remover: (id: string) => Promise<void>;
}

export function useDocumentos(
  options: UseDocumentosOptions = {},
): UseDocumentosResult {
  const labId = useActiveLabId();
  const user = useUser();
  const filters = options.filters ?? {};

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-render only when filter shape changes (não na referência).
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!labId) {
      setDocumentos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = documentoService.subscribe(labId, filters, (docs) => {
      setDocumentos(docs);
      setIsLoading(false);
    });

    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, filterKey]);

  const operator = useMemo(() => {
    if (!user) return null;
    return {
      uid: user.uid,
      name: user.displayName ?? user.email ?? 'Operador',
    };
  }, [user]);

  // ── Actions ────────────────────────────────────────────────────────────

  const criar = useCallback<UseDocumentosResult['criar']>(
    async (input) => {
      if (!labId) throw new Error('Sem laboratório ativo.');
      if (!operator) throw new Error('Sem usuário autenticado.');

      const duplicado = await documentoService.existeCodigoDuplicado(
        labId,
        input.codigo,
      );
      if (duplicado) {
        throw new Error(`Código ${input.codigo} já existe neste laboratório.`);
      }

      try {
        return await documentoService.create({ labId, input, operator });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao criar documento.';
        setError(msg);
        throw e;
      }
    },
    [labId, operator],
  );

  const atualizar = useCallback<UseDocumentosResult['atualizar']>(
    async (id, patch) => {
      if (!labId) throw new Error('Sem laboratório ativo.');
      if (!operator) throw new Error('Sem usuário autenticado.');

      // Se o código mudou, valida unicidade.
      if (patch.codigo) {
        const duplicado = await documentoService.existeCodigoDuplicado(
          labId,
          patch.codigo,
          id,
        );
        if (duplicado) {
          throw new Error(`Código ${patch.codigo} já existe.`);
        }
      }

      try {
        await documentoService.update({ labId, id, patch, operator });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao atualizar.';
        setError(msg);
        throw e;
      }
    },
    [labId, operator],
  );

  const mudarStatus = useCallback<UseDocumentosResult['mudarStatus']>(
    async (id, toStatus, motivo) => {
      if (!labId) throw new Error('Sem laboratório ativo.');
      if (!operator) throw new Error('Sem usuário autenticado.');

      const doc = documentos.find((d) => d.id === id);
      if (!doc) throw new Error('Documento não encontrado.');

      if (!isTransitionAllowed(doc.status, toStatus)) {
        throw new Error(
          `Transição inválida: ${doc.status} → ${toStatus}.`,
        );
      }

      // Volta a rascunho ou descarte exigem motivo.
      if (
        (doc.status === 'vigente' && toStatus === 'em_revisao') ||
        toStatus === 'obsoleto'
      ) {
        if (!motivo || motivo.trim().length < 10) {
          throw new Error(
            'Motivo obrigatório (≥10 caracteres) para esta transição.',
          );
        }
      }

      try {
        await documentoService.transitionStatus({
          labId,
          id,
          fromStatus: doc.status,
          toStatus,
          codigo: doc.codigo,
          versao: doc.versao,
          motivo,
          operator,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao mudar status.';
        setError(msg);
        throw e;
      }
    },
    [labId, operator, documentos],
  );

  const emitirRevisao = useCallback<UseDocumentosResult['emitirRevisao']>(
    async (anteriorId, novaInput) => {
      if (!labId) throw new Error('Sem laboratório ativo.');
      if (!operator) throw new Error('Sem usuário autenticado.');

      const anterior = documentos.find((d) => d.id === anteriorId);
      if (!anterior) throw new Error('Documento anterior não encontrado.');

      if (anterior.status !== 'vigente') {
        throw new Error(
          `Apenas documentos vigentes podem ser revisados (status atual: ${anterior.status}).`,
        );
      }

      if (novaInput.codigo !== anterior.codigo) {
        throw new Error(
          'Revisão deve manter o mesmo código do documento original.',
        );
      }

      try {
        return await documentoService.emitirRevisao({
          labId,
          documentoAnterior: anterior,
          novaInput,
          operator,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao emitir revisão.';
        setError(msg);
        throw e;
      }
    },
    [labId, operator, documentos],
  );

  const remover = useCallback<UseDocumentosResult['remover']>(
    async (id) => {
      if (!labId) throw new Error('Sem laboratório ativo.');
      if (!operator) throw new Error('Sem usuário autenticado.');

      const doc = documentos.find((d) => d.id === id);
      if (!doc) throw new Error('Documento não encontrado.');

      if (doc.status !== 'em_revisao') {
        throw new Error(
          'Apenas rascunhos podem ser removidos. Documentos publicados devem ir a obsoleto.',
        );
      }

      try {
        await documentoService.softDelete({ labId, id, operator });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao remover.';
        setError(msg);
        throw e;
      }
    },
    [labId, operator, documentos],
  );

  return {
    documentos,
    isLoading,
    error,
    criar,
    atualizar,
    mudarStatus,
    emitirRevisao,
    remover,
  };
}
