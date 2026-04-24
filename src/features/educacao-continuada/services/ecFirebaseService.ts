/**
 * ecFirebaseService.ts
 *
 * Camada de persistência multi-tenant do módulo Educação Continuada.
 * Toda operação recebe `labId` explicitamente — não há caminho que permita
 * escrita sem tenant. Documentos também carregam `labId` redundante para
 * defense-in-depth nas security rules e habilitar auditoria via
 * `collectionGroup` pelo superadmin.
 *
 * Deleção é sempre lógica (RN-06) — nenhuma função deste arquivo invoca
 * `deleteDoc`. Guarda de 5 anos conforme RDC 978/2025.
 */

import {
  Timestamp,
  collection,
  db,
  deleteObject,
  doc,
  getDoc,
  getDownloadURL,
  onSnapshot,
  orderBy,
  query,
  ref as storageRef,
  serverTimestamp,
  setDoc,
  storage,
  updateDoc,
  uploadBytesResumable,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  type UploadTaskSnapshot,
} from '../../../shared/services/firebase';
import type {
  AlertaVencimento,
  AlertaVencimentoInput,
  AvaliacaoCompetencia,
  AvaliacaoCompetenciaInput,
  AvaliacaoEficacia,
  AvaliacaoEficaciaInput,
  AvaliacaoTeste,
  Certificado,
  CertificadoConfig,
  CertificadoConfigInput,
  Colaborador,
  ColaboradorInput,
  ConfiguracaoAlerta,
  ConfiguracaoAlertaInput,
  Execucao,
  ExecucaoInput,
  KitIntegracao,
  KitIntegracaoInput,
  NcOrigemColecao,
  Participante,
  ParticipanteInput,
  Periodicidade,
  ProgressoTrilha,
  ProgressoTrilhaInput,
  Questao,
  RespostaAvaliacao,
  StatusAlertaVencimento,
  TemplateTreinamento,
  TemplateTreinamentoInput,
  TipoTreinamento,
  Treinamento,
  TreinamentoInput,
  TrilhaAprendizado,
  TrilhaAprendizadoInput,
} from '../types/EducacaoContinuada';
import type { LabId } from '../types/_shared_refs';

// ─── Raiz e caminhos ──────────────────────────────────────────────────────────

const EC_ROOT = 'educacaoContinuada';

/**
 * Documento raiz do tenant no módulo. Não armazena dados próprios — existe
 * apenas como âncora de subcoleções. Rules impedem leitura/escrita fora do
 * próprio labId.
 */
const labRootDoc = (labId: LabId): DocumentReference =>
  doc(db, EC_ROOT, labId);

export const colaboradoresCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'colaboradores');

const colaboradorDoc = (labId: LabId, id: string): DocumentReference =>
  doc(colaboradoresCol(labId), id);

/**
 * Garante que o doc raiz do tenant existe antes de escrever em subcoleções.
 * `merge: true` torna a operação idempotente. Chamada apenas em criação —
 * updates/deletes não precisam porque assumem doc raiz já criado.
 */
async function ensureLabRoot(labId: LabId): Promise<void> {
  await setDoc(labRootDoc(labId), { labId }, { merge: true });
}

// ─── Mapping snapshot → entidade ──────────────────────────────────────────────
// Centralizado para que qualquer divergência entre o shape persistido e o
// tipo TS seja descoberta em um único ponto, não em cada consumidor.

function mapColaborador(snap: QueryDocumentSnapshot): Colaborador {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    cargo: d.cargo as string,
    setor: d.setor as string,
    ativo: d.ativo as boolean,
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// ─── API: Colaborador ─────────────────────────────────────────────────────────

/**
 * Cria um novo colaborador no tenant. O service é a única fonte de `labId`,
 * `criadoEm` e `deletadoEm` — o caller envia apenas campos de negócio via
 * `ColaboradorInput`. Retorna o ID gerado pelo Firestore.
 */
export async function createColaborador(
  labId: LabId,
  input: ColaboradorInput,
): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(colaboradoresCol(labId));
  await setDoc(ref, {
    labId,
    nome: input.nome,
    cargo: input.cargo,
    setor: input.setor,
    ativo: input.ativo,
    criadoEm: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

/**
 * Atualiza campos de negócio do colaborador. Portas oficiais para mudar estado
 * de deleção são `softDeleteColaborador` e `restoreColaborador` — o tipo
 * `Partial<ColaboradorInput>` impede por construção que o caller toque em
 * `deletadoEm`, `labId`, `id` ou `criadoEm`.
 */
export async function updateColaborador(
  labId: LabId,
  id: string,
  patch: Partial<ColaboradorInput>,
): Promise<void> {
  await updateDoc(colaboradorDoc(labId, id), { ...patch });
}

/**
 * Deleção lógica (RN-06). Marca `deletadoEm` com timestamp do servidor.
 * Nunca remove o documento — mantém guarda de 5 anos (RDC 978/2025).
 */
export async function softDeleteColaborador(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(colaboradorDoc(labId, id), {
    deletadoEm: serverTimestamp(),
  });
}

/** Reverte deleção lógica. */
export async function restoreColaborador(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(colaboradorDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeColaboradoresOptions {
  /** Quando true inclui registros com `deletadoEm !== null`. Default: false. */
  includeDeleted?: boolean;
  /** Quando true filtra por `ativo === true`. Default: sem filtro. */
  somenteAtivos?: boolean;
}

/**
 * Assina a lista de colaboradores do tenant, ordenada por nome.
 *
 * ⚠️ Filtro `deletadoEm == null` é aplicado client-side por omissão —
 * Firestore não permite combinar inequality em `deletadoEm` com
 * `orderBy('nome')` sem índice composto. Se um tenant ultrapassar ~1k
 * colaboradores, migrar para índice composto + filtro server-side.
 *
 * Retorna a função `Unsubscribe` — chamar no cleanup do effect é obrigatório.
 */
export function subscribeColaboradores(
  labId: LabId,
  options: SubscribeColaboradoresOptions,
  callback: (colaboradores: Colaborador[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = options.somenteAtivos
    ? query(colaboradoresCol(labId), where('ativo', '==', true), orderBy('nome', 'asc'))
    : query(colaboradoresCol(labId), orderBy('nome', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapColaborador);
      const filtered = options.includeDeleted
        ? all
        : all.filter((c) => c.deletadoEm === null);
      callback(filtered);
    },
    (err) => onError?.(err),
  );
}

// ─── API: Treinamento (FR-027) ────────────────────────────────────────────────

export const treinamentosCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'treinamentos');

const treinamentoDoc = (labId: LabId, id: string): DocumentReference =>
  doc(treinamentosCol(labId), id);

function mapTreinamento(snap: QueryDocumentSnapshot): Treinamento {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    titulo: d.titulo as string,
    tema: d.tema as string,
    cargaHoraria: d.cargaHoraria as number,
    modalidade: d.modalidade as Treinamento['modalidade'],
    unidade: d.unidade as Treinamento['unidade'],
    responsavel: d.responsavel as string,
    // Periodicidade agora é opcional (Fase 10): obrigatória apenas quando tipo='periodico'.
    periodicidade: d.periodicidade as Periodicidade | undefined,
    ativo: d.ativo as boolean,
    // Fase 10 — tipo regulatório. Fallback 'periodico' para docs antigos sem o campo.
    tipo: (d.tipo ?? 'periodico') as TipoTreinamento,
    colaboradorAlvoId: d.colaboradorAlvoId as string | undefined,
    popVersao: d.popVersao as string | undefined,
    equipamentoNome: d.equipamentoNome as string | undefined,
    ncOrigemId: d.ncOrigemId as string | undefined,
    ncOrigemColecao: d.ncOrigemColecao as NcOrigemColecao | undefined,
    certificadoExternoUrl: d.certificadoExternoUrl as string | undefined,
    // Bug R4 fix: templateId (Fase 6) nunca era lido do Firestore. Corrigido junto com Fase 10.
    templateId: d.templateId as string | undefined,
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

export async function createTreinamento(
  labId: LabId,
  input: TreinamentoInput,
): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(treinamentosCol(labId));
  // `ignoreUndefinedProperties: true` está setado em firebase.config.ts — campos
  // undefined são descartados automaticamente pelo SDK. Mantém o write enxuto
  // para os tipos que não usam certos campos (ex: capacitacao_externa sem
  // periodicidade).
  await setDoc(ref, {
    labId,
    titulo: input.titulo,
    tema: input.tema,
    cargaHoraria: input.cargaHoraria,
    modalidade: input.modalidade,
    unidade: input.unidade,
    responsavel: input.responsavel,
    periodicidade: input.periodicidade,
    ativo: input.ativo,
    // Fase 10 — tipo regulatório + campos condicionais por tipo
    tipo: input.tipo,
    colaboradorAlvoId: input.colaboradorAlvoId,
    popVersao: input.popVersao,
    equipamentoNome: input.equipamentoNome,
    ncOrigemId: input.ncOrigemId,
    ncOrigemColecao: input.ncOrigemColecao,
    certificadoExternoUrl: input.certificadoExternoUrl,
    // Bug R4 fix: persistir templateId (Fase 6) — antes era recebido mas não gravado
    templateId: input.templateId,
    criadoEm: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

export async function updateTreinamento(
  labId: LabId,
  id: string,
  patch: Partial<TreinamentoInput>,
): Promise<void> {
  await updateDoc(treinamentoDoc(labId, id), { ...patch });
}

export async function softDeleteTreinamento(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(treinamentoDoc(labId, id), {
    deletadoEm: serverTimestamp(),
  });
}

export async function restoreTreinamento(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(treinamentoDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeTreinamentosOptions {
  /** Quando true inclui registros com `deletadoEm !== null`. Default: false. */
  includeDeleted?: boolean;
  /** Quando true filtra por `ativo === true`. Default: sem filtro. */
  somenteAtivos?: boolean;
  /** Filtro por tipo regulatório (Fase 10). Default: sem filtro. */
  tipo?: TipoTreinamento;
}

/**
 * Assina a lista de treinamentos do tenant, ordenada por título.
 *
 * ⚠️ Mesma limitação de escala do `subscribeColaboradores`: filtro de
 * `deletadoEm` é client-side.
 */
export function subscribeTreinamentos(
  labId: LabId,
  options: SubscribeTreinamentosOptions,
  callback: (treinamentos: Treinamento[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = options.somenteAtivos
    ? query(treinamentosCol(labId), where('ativo', '==', true), orderBy('titulo', 'asc'))
    : query(treinamentosCol(labId), orderBy('titulo', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapTreinamento);
      let filtered = options.includeDeleted
        ? all
        : all.filter((t) => t.deletadoEm === null);
      if (options.tipo) filtered = filtered.filter((t) => t.tipo === options.tipo);
      callback(filtered);
    },
    (err) => onError?.(err),
  );
}

// ─── API: Execucao (FR-001) ───────────────────────────────────────────────────

export const execucoesCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'execucoes');

const execucaoDoc = (labId: LabId, id: string): DocumentReference =>
  doc(execucoesCol(labId), id);

function mapExecucao(snap: QueryDocumentSnapshot): Execucao {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    treinamentoId: d.treinamentoId as string,
    dataPlanejada: d.dataPlanejada as Timestamp,
    dataAplicacao: (d.dataAplicacao ?? null) as Timestamp | null,
    ministrante: d.ministrante as string,
    pauta: d.pauta as string,
    status: d.status as Execucao['status'],
    origemReagendamento: d.origemReagendamento as string | undefined,
    assinatura: d.assinatura as Execucao['assinatura'],
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

/**
 * Serializa um `ExecucaoInput` para payload Firestore, normalizando campos
 * opcionais (undefined vira omissão, null persiste). Reusado por create e
 * pela orquestração atomic.
 */
function execucaoPayload(input: ExecucaoInput): Record<string, unknown> {
  const base: Record<string, unknown> = {
    treinamentoId: input.treinamentoId,
    dataPlanejada: input.dataPlanejada,
    dataAplicacao: input.dataAplicacao,
    ministrante: input.ministrante,
    pauta: input.pauta,
    status: input.status,
    assinatura: input.assinatura,
  };
  if (input.origemReagendamento !== undefined) {
    base.origemReagendamento = input.origemReagendamento;
  }
  return base;
}

export async function createExecucao(
  labId: LabId,
  input: ExecucaoInput,
): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(execucoesCol(labId));
  await setDoc(ref, {
    labId,
    ...execucaoPayload(input),
    criadoEm: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

export async function updateExecucao(
  labId: LabId,
  id: string,
  patch: Partial<ExecucaoInput>,
): Promise<void> {
  await updateDoc(execucaoDoc(labId, id), { ...patch });
}

export async function softDeleteExecucao(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(execucaoDoc(labId, id), {
    deletadoEm: serverTimestamp(),
  });
}

export async function restoreExecucao(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(execucaoDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeExecucoesOptions {
  treinamentoId?: string;
  status?: Execucao['status'];
  includeDeleted?: boolean;
}

/**
 * Assina execuções do tenant, ordenadas por `dataPlanejada` descendente.
 *
 * ⚠️ Índice composto será necessário se filtrar por `status` ou
 * `treinamentoId` combinado com orderBy — Firestore exige declaração no
 * `firestore.indexes.json`. Hoje fazemos filtro client-side em cima do set
 * bruto para postergar essa decisão; se o volume por tenant passar de ~5k
 * execuções, migrar para queries server-side com índice composto.
 */
export function subscribeExecucoes(
  labId: LabId,
  options: SubscribeExecucoesOptions,
  callback: (execucoes: Execucao[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(execucoesCol(labId), orderBy('dataPlanejada', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapExecucao);
      if (!options.includeDeleted) {
        list = list.filter((e) => e.deletadoEm === null);
      }
      if (options.treinamentoId) {
        list = list.filter((e) => e.treinamentoId === options.treinamentoId);
      }
      if (options.status) {
        list = list.filter((e) => e.status === options.status);
      }
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── API: Participante ────────────────────────────────────────────────────────

export const participantesCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'participantes');

const participanteDoc = (labId: LabId, id: string): DocumentReference =>
  doc(participantesCol(labId), id);

function mapParticipante(snap: QueryDocumentSnapshot): Participante {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    execucaoId: d.execucaoId as string,
    colaboradorId: d.colaboradorId as string,
    presente: d.presente as boolean,
    assinatura: d.assinatura as Participante['assinatura'],
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

export async function softDeleteParticipante(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(participanteDoc(labId, id), {
    deletadoEm: serverTimestamp(),
  });
}

export interface SubscribeParticipantesOptions {
  execucaoId?: string;
  colaboradorId?: string;
  includeDeleted?: boolean;
}

export function subscribeParticipantes(
  labId: LabId,
  options: SubscribeParticipantesOptions,
  callback: (participantes: Participante[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(participantesCol(labId));

  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapParticipante);
      if (!options.includeDeleted) {
        list = list.filter((p) => p.deletadoEm === null);
      }
      if (options.execucaoId) {
        list = list.filter((p) => p.execucaoId === options.execucaoId);
      }
      if (options.colaboradorId) {
        list = list.filter((p) => p.colaboradorId === options.colaboradorId);
      }
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── API: AlertaVencimento ────────────────────────────────────────────────────

export const alertasVencimentoCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'alertasVencimento');

// ─── Orquestrações atomic (removidas na limpeza pós-Fase 0c) ─────────────────
// `commitExecucaoRealizada`, `commitExecucaoAdiada`, `createAvaliacaoEficacia`,
// `updateAvaliacaoEficacia`, `createAvaliacaoCompetencia`,
// `updateAvaliacaoCompetencia` foram removidas em 2026-04-24 após 0 callers
// remanescentes. Tudo passa pelos callables `ec_commit*` / `ec_registrar*` /
// `ec_fechar*` que escrevem via Admin SDK bypassando rules. Rollback histórico:
// `git log --diff-filter=D` + revert do commit de limpeza.

// ─── API: AvaliacaoEficacia (FR-001 bloco inferior) ──────────────────────────

export const avaliacoesEficaciaCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'avaliacoesEficacia');

const avaliacaoEficaciaDoc = (labId: LabId, id: string): DocumentReference =>
  doc(avaliacoesEficaciaCol(labId), id);

function mapAvaliacaoEficacia(snap: QueryDocumentSnapshot): AvaliacaoEficacia {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    execucaoId: d.execucaoId as string,
    resultado: d.resultado as AvaliacaoEficacia['resultado'],
    evidencia: d.evidencia as string,
    dataAvaliacao: d.dataAvaliacao as Timestamp,
    dataFechamento: (d.dataFechamento ?? null) as Timestamp | null,
    acaoCorretiva: d.acaoCorretiva as string | undefined,
    assinatura: d.assinatura as AvaliacaoEficacia['assinatura'],
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// createAvaliacaoEficacia + updateAvaliacaoEficacia removidas em 2026-04-24.
// Criação via `ec_registrarAvaliacaoEficacia`, transição de fechamento via
// `ec_fecharAvaliacaoEficacia`. Soft-delete/restore seguem abaixo.

export async function softDeleteAvaliacaoEficacia(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(avaliacaoEficaciaDoc(labId, id), {
    deletadoEm: serverTimestamp(),
  });
}

export async function restoreAvaliacaoEficacia(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(avaliacaoEficaciaDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeAvaliacoesEficaciaOptions {
  execucaoId?: string;
  includeDeleted?: boolean;
}

export function subscribeAvaliacoesEficacia(
  labId: LabId,
  options: SubscribeAvaliacoesEficaciaOptions,
  callback: (avaliacoes: AvaliacaoEficacia[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(avaliacoesEficaciaCol(labId));

  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapAvaliacaoEficacia);
      if (!options.includeDeleted) list = list.filter((a) => a.deletadoEm === null);
      if (options.execucaoId) list = list.filter((a) => a.execucaoId === options.execucaoId);
      list.sort((a, b) => b.dataAvaliacao.toMillis() - a.dataAvaliacao.toMillis());
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── API: AvaliacaoCompetencia (ISO 15189:2022 cl. 6.2.4) ────────────────────

export const avaliacoesCompetenciaCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'avaliacoesCompetencia');

const avaliacaoCompetenciaDoc = (labId: LabId, id: string): DocumentReference =>
  doc(avaliacoesCompetenciaCol(labId), id);

function mapAvaliacaoCompetencia(snap: QueryDocumentSnapshot): AvaliacaoCompetencia {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    execucaoId: d.execucaoId as string,
    colaboradorId: d.colaboradorId as string,
    metodo: d.metodo as AvaliacaoCompetencia['metodo'],
    resultado: d.resultado as AvaliacaoCompetencia['resultado'],
    avaliadorId: d.avaliadorId as string,
    dataAvaliacao: d.dataAvaliacao as Timestamp,
    evidencia: d.evidencia as string,
    proximaAvaliacaoEm: d.proximaAvaliacaoEm as Timestamp | undefined,
    assinatura: d.assinatura as AvaliacaoCompetencia['assinatura'],
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// createAvaliacaoCompetencia + updateAvaliacaoCompetencia removidas em 2026-04-24.
// Criação via `ec_registrarAvaliacaoCompetencia` (server auto-injeta
// avaliadorId, valida FK Participante.presente). Soft-delete/restore abaixo.

export async function softDeleteAvaliacaoCompetencia(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(avaliacaoCompetenciaDoc(labId, id), {
    deletadoEm: serverTimestamp(),
  });
}

export async function restoreAvaliacaoCompetencia(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(avaliacaoCompetenciaDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeAvaliacoesCompetenciaOptions {
  execucaoId?: string;
  colaboradorId?: string;
  includeDeleted?: boolean;
}

export function subscribeAvaliacoesCompetencia(
  labId: LabId,
  options: SubscribeAvaliacoesCompetenciaOptions,
  callback: (avaliacoes: AvaliacaoCompetencia[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(avaliacoesCompetenciaCol(labId));

  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapAvaliacaoCompetencia);
      if (!options.includeDeleted) list = list.filter((a) => a.deletadoEm === null);
      if (options.execucaoId) list = list.filter((a) => a.execucaoId === options.execucaoId);
      if (options.colaboradorId) list = list.filter((a) => a.colaboradorId === options.colaboradorId);
      list.sort((a, b) => b.dataAvaliacao.toMillis() - a.dataAvaliacao.toMillis());
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── API: AlertaVencimento ────────────────────────────────────────────────────
// Alertas são criados pelo commit atomic em `commitExecucaoRealizada` (RN-05).
// Este bloco expõe leitura e transições de status — nunca criação direta.

const alertaVencimentoDoc = (labId: LabId, id: string): DocumentReference =>
  doc(alertasVencimentoCol(labId), id);

function mapAlertaVencimento(snap: QueryDocumentSnapshot): AlertaVencimento {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    treinamentoId: d.treinamentoId as string,
    dataVencimento: d.dataVencimento as Timestamp,
    status: d.status as StatusAlertaVencimento,
    diasAntecedencia: d.diasAntecedencia as number,
  };
}

export async function updateAlertaVencimentoStatus(
  labId: LabId,
  id: string,
  status: StatusAlertaVencimento,
): Promise<void> {
  await updateDoc(alertaVencimentoDoc(labId, id), { status });
}

export interface SubscribeAlertasVencimentoOptions {
  status?: StatusAlertaVencimento;
  treinamentoId?: string;
}

/**
 * Assina alertas de vencimento ordenados por `dataVencimento` ascendente —
 * o mais iminente primeiro. Sem `deletadoEm` nesta entidade (ciclo de vida
 * via status: pendente → notificado → resolvido).
 */
export function subscribeAlertasVencimento(
  labId: LabId,
  options: SubscribeAlertasVencimentoOptions,
  callback: (alertas: AlertaVencimento[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(alertasVencimentoCol(labId), orderBy('dataVencimento', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapAlertaVencimento);
      if (options.status) list = list.filter((a) => a.status === options.status);
      if (options.treinamentoId) list = list.filter((a) => a.treinamentoId === options.treinamentoId);
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 6 — TemplateTreinamento ────────────────────────────────────────────

export const templatesCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'templates');

const templateDoc = (labId: LabId, id: string): DocumentReference =>
  doc(templatesCol(labId), id);

function mapTemplate(snap: QueryDocumentSnapshot): TemplateTreinamento {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    titulo: d.titulo as string,
    tema: d.tema as string,
    objetivo: d.objetivo as string,
    cargaHoraria: d.cargaHoraria as number,
    modalidade: d.modalidade as TemplateTreinamento['modalidade'],
    periodicidade: d.periodicidade as TemplateTreinamento['periodicidade'],
    pauta: d.pauta as string,
    tags: (d.tags ?? []) as string[],
    versao: (d.versao ?? 1) as number,
    materialDidatico: (d.materialDidatico ?? []) as TemplateTreinamento['materialDidatico'],
    ativo: d.ativo as boolean,
    criadoEm: d.criadoEm as Timestamp,
    atualizadoEm: d.atualizadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

export async function createTemplate(
  labId: LabId,
  input: TemplateTreinamentoInput,
): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(templatesCol(labId));
  const now = serverTimestamp();
  await setDoc(ref, {
    labId,
    titulo: input.titulo,
    tema: input.tema,
    objetivo: input.objetivo,
    cargaHoraria: input.cargaHoraria,
    modalidade: input.modalidade,
    periodicidade: input.periodicidade,
    pauta: input.pauta,
    tags: input.tags,
    materialDidatico: input.materialDidatico,
    ativo: input.ativo,
    versao: 1,
    criadoEm: now,
    atualizadoEm: now,
    deletadoEm: null,
  });
  return ref.id;
}

/**
 * Atualiza template. Incrementa `versao` em +1 a cada chamada (contador
 * incremental, sem snapshot histórico — audit-friendly sem complexidade de
 * versões imutáveis). Caller passa os campos alterados via `patch`.
 */
export async function updateTemplate(
  labId: LabId,
  id: string,
  patch: Partial<TemplateTreinamentoInput>,
  versaoAtual: number,
): Promise<void> {
  await updateDoc(templateDoc(labId, id), {
    ...patch,
    versao: versaoAtual + 1,
    atualizadoEm: serverTimestamp(),
  });
}

export async function softDeleteTemplate(labId: LabId, id: string): Promise<void> {
  await updateDoc(templateDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export async function restoreTemplate(labId: LabId, id: string): Promise<void> {
  await updateDoc(templateDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeTemplatesOptions {
  includeDeleted?: boolean;
  somenteAtivos?: boolean;
  /** Filtro por tag (case-insensitive). */
  tag?: string;
}

export function subscribeTemplates(
  labId: LabId,
  options: SubscribeTemplatesOptions,
  callback: (list: TemplateTreinamento[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(templatesCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapTemplate);
      if (!options.includeDeleted) list = list.filter((t) => t.deletadoEm === null);
      if (options.somenteAtivos) list = list.filter((t) => t.ativo);
      if (options.tag) {
        const needle = options.tag.toLowerCase();
        list = list.filter((t) => t.tags.some((tag) => tag.toLowerCase().includes(needle)));
      }
      list.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 6 — KitIntegracao ──────────────────────────────────────────────────

export const kitsCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'kitsIntegracao');

const kitDoc = (labId: LabId, id: string): DocumentReference =>
  doc(kitsCol(labId), id);

function mapKit(snap: QueryDocumentSnapshot): KitIntegracao {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    cargo: d.cargo as string,
    templateIds: (d.templateIds ?? []) as string[],
    ativo: d.ativo as boolean,
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

export async function createKit(labId: LabId, input: KitIntegracaoInput): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(kitsCol(labId));
  await setDoc(ref, {
    labId,
    nome: input.nome,
    cargo: input.cargo,
    templateIds: input.templateIds,
    ativo: input.ativo,
    criadoEm: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

export async function updateKit(
  labId: LabId,
  id: string,
  patch: Partial<KitIntegracaoInput>,
): Promise<void> {
  await updateDoc(kitDoc(labId, id), { ...patch });
}

export async function softDeleteKit(labId: LabId, id: string): Promise<void> {
  await updateDoc(kitDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export async function restoreKit(labId: LabId, id: string): Promise<void> {
  await updateDoc(kitDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeKitsOptions {
  includeDeleted?: boolean;
  somenteAtivos?: boolean;
}

export function subscribeKits(
  labId: LabId,
  options: SubscribeKitsOptions,
  callback: (list: KitIntegracao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(kitsCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapKit);
      if (!options.includeDeleted) list = list.filter((k) => k.deletadoEm === null);
      if (options.somenteAtivos) list = list.filter((k) => k.ativo);
      list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 6 — Firebase Storage helpers para MaterialDidatico ─────────────────

export interface UploadMaterialResult {
  downloadUrl: string;
  storagePath: string;
  tamanhoBytes: number;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Upload de arquivo para `educacaoContinuada/{labId}/materiais/{templateId}/{autoId}_{filename}`.
 * Usa `uploadBytesResumable` para permitir progress tracking. Rejeita arquivos
 * acima de 50MB client-side (duplica a verificação nas Storage rules).
 *
 * `onProgress(pct)` recebe inteiro 0-100. Callers devem gerenciar state próprio.
 */
export async function uploadMaterialToStorage(
  labId: LabId,
  templateId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadMaterialResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Arquivo excede 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB). Reduza o tamanho antes de enviar.`,
    );
  }

  const randomId = Math.random().toString(36).slice(2, 10);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `educacaoContinuada/${labId}/materiais/${templateId}/${randomId}_${safeName}`;
  const fileRef = storageRef(storage, path);

  const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

  return new Promise<UploadMaterialResult>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap: UploadTaskSnapshot) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      (err) => reject(err),
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve({ downloadUrl, storagePath: path, tamanhoBytes: file.size });
        } catch (err) {
          reject(err as Error);
        }
      },
    );
  });
}

/**
 * Remove material do Storage. Chamar quando material é removido da lista dentro
 * de um template — evita acúmulo de objetos órfãos. Falha silenciosa se o path
 * não existir mais (idempotente).
 */
export async function deleteMaterialFromStorage(storagePath: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch (err) {
    // object-not-found é aceitável (idempotente); outros erros propagam
    const code = (err as { code?: string })?.code;
    if (code !== 'storage/object-not-found') throw err;
  }
}

// ─── FASE 7 — TrilhaAprendizado ──────────────────────────────────────────────

export const trilhasCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'trilhas');

const trilhaDoc = (labId: LabId, id: string): DocumentReference =>
  doc(trilhasCol(labId), id);

function mapTrilha(snap: QueryDocumentSnapshot): TrilhaAprendizado {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    descricao: d.descricao as string,
    cargo: d.cargo as string,
    etapas: (d.etapas ?? []) as TrilhaAprendizado['etapas'],
    ativo: d.ativo as boolean,
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

export async function createTrilha(
  labId: LabId,
  input: TrilhaAprendizadoInput,
): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(trilhasCol(labId));
  await setDoc(ref, {
    labId,
    ...input,
    criadoEm: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

export async function updateTrilha(
  labId: LabId,
  id: string,
  patch: Partial<TrilhaAprendizadoInput>,
): Promise<void> {
  await updateDoc(trilhaDoc(labId, id), { ...patch });
}

export async function softDeleteTrilha(labId: LabId, id: string): Promise<void> {
  await updateDoc(trilhaDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export async function restoreTrilha(labId: LabId, id: string): Promise<void> {
  await updateDoc(trilhaDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeTrilhasOptions {
  includeDeleted?: boolean;
  somenteAtivas?: boolean;
  cargo?: string;
}

export function subscribeTrilhas(
  labId: LabId,
  options: SubscribeTrilhasOptions,
  callback: (list: TrilhaAprendizado[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(trilhasCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapTrilha);
      if (!options.includeDeleted) list = list.filter((t) => t.deletadoEm === null);
      if (options.somenteAtivas) list = list.filter((t) => t.ativo);
      if (options.cargo) {
        const needle = options.cargo.toLowerCase();
        list = list.filter((t) => t.cargo.toLowerCase() === needle);
      }
      list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 7 — ProgressoTrilha ────────────────────────────────────────────────

export const progressosTrilhaCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'progressosTrilha');

const progressoTrilhaDoc = (labId: LabId, id: string): DocumentReference =>
  doc(progressosTrilhaCol(labId), id);

function mapProgresso(snap: QueryDocumentSnapshot): ProgressoTrilha {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    colaboradorId: d.colaboradorId as string,
    trilhaId: d.trilhaId as string,
    dataInicio: d.dataInicio as Timestamp,
    status: d.status as ProgressoTrilha['status'],
    etapas: (d.etapas ?? []) as ProgressoTrilha['etapas'],
    percentualConcluido: d.percentualConcluido as number,
    dataConclusao: d.dataConclusao as Timestamp | undefined,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

export async function createProgressoTrilha(
  labId: LabId,
  input: ProgressoTrilhaInput,
): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(progressosTrilhaCol(labId));
  await setDoc(ref, {
    labId,
    ...input,
    deletadoEm: null,
  });
  return ref.id;
}

export async function updateProgressoTrilha(
  labId: LabId,
  id: string,
  patch: Partial<ProgressoTrilhaInput>,
): Promise<void> {
  await updateDoc(progressoTrilhaDoc(labId, id), { ...patch });
}

export async function softDeleteProgressoTrilha(
  labId: LabId,
  id: string,
): Promise<void> {
  await updateDoc(progressoTrilhaDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export interface SubscribeProgressosOptions {
  includeDeleted?: boolean;
  colaboradorId?: string;
  trilhaId?: string;
  status?: ProgressoTrilha['status'];
}

export function subscribeProgressos(
  labId: LabId,
  options: SubscribeProgressosOptions,
  callback: (list: ProgressoTrilha[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(progressosTrilhaCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapProgresso);
      if (!options.includeDeleted) list = list.filter((p) => p.deletadoEm === null);
      if (options.colaboradorId) list = list.filter((p) => p.colaboradorId === options.colaboradorId);
      if (options.trilhaId) list = list.filter((p) => p.trilhaId === options.trilhaId);
      if (options.status) list = list.filter((p) => p.status === options.status);
      list.sort((a, b) => b.dataInicio.toMillis() - a.dataInicio.toMillis());
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 8 — Questao (somente leitura + soft-delete no client) ──────────────

export const questoesCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'questoes');

function mapQuestao(snap: QueryDocumentSnapshot): Questao {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    templateId: d.templateId as string,
    enunciado: d.enunciado as string,
    tipo: d.tipo as Questao['tipo'],
    opcoes: d.opcoes as Questao['opcoes'],
    pontuacao: d.pontuacao as number,
    ordem: d.ordem as number,
    ativo: d.ativo as boolean,
    criadoEm: d.criadoEm as Timestamp,
  };
}

/** Archive — rules permitem diff hasOnly(['ativo']). */
export async function archiveQuestao(labId: LabId, id: string): Promise<void> {
  await updateDoc(doc(questoesCol(labId), id), { ativo: false });
}

export interface SubscribeQuestoesOptions {
  templateId?: string;
  somenteAtivas?: boolean;
}

export function subscribeQuestoes(
  labId: LabId,
  options: SubscribeQuestoesOptions,
  callback: (list: Questao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(questoesCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapQuestao);
      if (options.templateId) list = list.filter((q) => q.templateId === options.templateId);
      if (options.somenteAtivas) list = list.filter((q) => q.ativo);
      list.sort((a, b) => a.ordem - b.ordem);
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 8 — AvaliacaoTeste (leitura client) ────────────────────────────────

export const avaliacoesTesteCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'avaliacoesTeste');

function mapAvaliacaoTeste(snap: QueryDocumentSnapshot): AvaliacaoTeste {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    execucaoId: d.execucaoId as string,
    colaboradorId: d.colaboradorId as string,
    status: d.status as AvaliacaoTeste['status'],
    pontuacaoTotal: d.pontuacaoTotal as number,
    percentualAcerto: d.percentualAcerto as number,
    aprovado: d.aprovado as boolean,
    iniciadoEm: d.iniciadoEm as Timestamp,
    submetidoEm: d.submetidoEm as Timestamp | undefined,
    corrigidoEm: d.corrigidoEm as Timestamp | undefined,
  };
}

export interface SubscribeAvaliacoesTesteOptions {
  execucaoId?: string;
  colaboradorId?: string;
}

export function subscribeAvaliacoesTeste(
  labId: LabId,
  options: SubscribeAvaliacoesTesteOptions,
  callback: (list: AvaliacaoTeste[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(avaliacoesTesteCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapAvaliacaoTeste);
      if (options.execucaoId) list = list.filter((a) => a.execucaoId === options.execucaoId);
      if (options.colaboradorId) list = list.filter((a) => a.colaboradorId === options.colaboradorId);
      list.sort((a, b) => b.iniciadoEm.toMillis() - a.iniciadoEm.toMillis());
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 8 — RespostaAvaliacao (leitura client) ─────────────────────────────

export const respostasAvaliacaoCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'respostasAvaliacao');

function mapResposta(snap: QueryDocumentSnapshot): RespostaAvaliacao {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    avaliacaoTesteId: d.avaliacaoTesteId as string,
    colaboradorId: d.colaboradorId as string,
    questaoId: d.questaoId as string,
    respostaTexto: d.respostaTexto as string | undefined,
    opcaoId: d.opcaoId as string | undefined,
    correta: d.correta as boolean | null,
    pontuacaoObtida: d.pontuacaoObtida as number,
    respondidaEm: d.respondidaEm as Timestamp,
  };
}

export function subscribeRespostas(
  labId: LabId,
  avaliacaoTesteId: string,
  callback: (list: RespostaAvaliacao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(respostasAvaliacaoCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(mapResposta)
        .filter((r) => r.avaliacaoTesteId === avaliacaoTesteId);
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 9 — Certificado (leitura client, escrita via callable) ─────────────

export const certificadosCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'certificados');

function mapCertificado(snap: QueryDocumentSnapshot): Certificado {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    colaboradorId: d.colaboradorId as string,
    treinamentoId: d.treinamentoId as string,
    execucaoId: d.execucaoId as string,
    avaliacaoCompetenciaId: d.avaliacaoCompetenciaId as string,
    qrCodePayload: d.qrCodePayload as string,
    pdfStoragePath: d.pdfStoragePath as string,
    pdfDownloadUrl: d.pdfDownloadUrl as string,
    emitidoEm: d.emitidoEm as Timestamp,
    geradoPor: d.geradoPor as Certificado['geradoPor'],
  };
}

export interface SubscribeCertificadosOptions {
  colaboradorId?: string;
  treinamentoId?: string;
}

export function subscribeCertificados(
  labId: LabId,
  options: SubscribeCertificadosOptions,
  callback: (list: Certificado[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(certificadosCol(labId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(mapCertificado);
      if (options.colaboradorId) list = list.filter((c) => c.colaboradorId === options.colaboradorId);
      if (options.treinamentoId) list = list.filter((c) => c.treinamentoId === options.treinamentoId);
      list.sort((a, b) => b.emitidoEm.toMillis() - a.emitidoEm.toMillis());
      callback(list);
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 9 — CertificadoConfig (singleton por lab) ──────────────────────────

const CERTIFICADO_CONFIG_ID = 'config';

const certificadoConfigDoc = (labId: LabId): DocumentReference =>
  doc(labRootDoc(labId), 'certificadoConfig', CERTIFICADO_CONFIG_ID);

export async function getCertificadoConfig(labId: LabId): Promise<CertificadoConfig | null> {
  const snap = await getDoc(certificadoConfigDoc(labId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    labId,
    nomeDoLab: d.nomeDoLab as string,
    logoUrl: d.logoUrl as string | undefined,
    assinaturaResponsavelUrl: d.assinaturaResponsavelUrl as string | undefined,
    textoRodape: d.textoRodape as string,
  };
}

export async function saveCertificadoConfig(
  labId: LabId,
  input: CertificadoConfigInput,
): Promise<void> {
  await ensureLabRoot(labId);
  await setDoc(certificadoConfigDoc(labId), { labId, ...input }, { merge: true });
}

export function subscribeCertificadoConfig(
  labId: LabId,
  callback: (config: CertificadoConfig | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    certificadoConfigDoc(labId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const d = snap.data();
      callback({
        labId,
        nomeDoLab: d.nomeDoLab as string,
        logoUrl: d.logoUrl as string | undefined,
        assinaturaResponsavelUrl: d.assinaturaResponsavelUrl as string | undefined,
        textoRodape: d.textoRodape as string,
      });
    },
    (err) => onError?.(err),
  );
}

// ─── FASE 9 — ConfiguracaoAlerta (singleton por lab) ─────────────────────────

const CONFIG_ALERTA_ID = 'config';

const configAlertaDoc = (labId: LabId): DocumentReference =>
  doc(labRootDoc(labId), 'configAlertas', CONFIG_ALERTA_ID);

export async function getConfigAlerta(labId: LabId): Promise<ConfiguracaoAlerta | null> {
  const snap = await getDoc(configAlertaDoc(labId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    labId,
    diasAntecedenciaVencimento: d.diasAntecedenciaVencimento as number,
    emailResponsavel: d.emailResponsavel as boolean,
    emailColaborador: d.emailColaborador as boolean,
    horaEnvio: d.horaEnvio as string,
    emailsCopia: d.emailsCopia as string[] | undefined,
  };
}

export async function saveConfigAlerta(
  labId: LabId,
  input: ConfiguracaoAlertaInput,
): Promise<void> {
  await ensureLabRoot(labId);
  await setDoc(configAlertaDoc(labId), { labId, ...input }, { merge: true });
}

export function subscribeConfigAlerta(
  labId: LabId,
  callback: (config: ConfiguracaoAlerta | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    configAlertaDoc(labId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const d = snap.data();
      callback({
        labId,
        diasAntecedenciaVencimento: d.diasAntecedenciaVencimento as number,
        emailResponsavel: d.emailResponsavel as boolean,
        emailColaborador: d.emailColaborador as boolean,
        horaEnvio: d.horaEnvio as string,
        emailsCopia: d.emailsCopia as string[] | undefined,
      });
    },
    (err) => onError?.(err),
  );
}
