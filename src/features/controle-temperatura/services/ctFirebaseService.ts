/**
 * ctFirebaseService.ts
 *
 * Camada de persistência multi-tenant do módulo Controle de Temperatura (FR-11).
 * Mirror do padrão `ecFirebaseService` — Educação Continuada é a referência
 * canônica de módulo auditável com softDelete + RN atômicas por batch.
 *
 * Paths:
 *   Root   : controleTemperatura/{labId}
 *   Subcols: equipamentos | leituras | leituras-previstas | ncs
 *            termometros | dispositivos-iot
 *
 * Regras implementadas aqui (não delegar pro caller):
 *   RN-01: `foraDosLimites` derivado no save + NC automática em batch
 *   RN-06: derivação de `online` para DispositivoIoT no read
 *   RN-07: deleção lógica — `deleteDoc` nunca é chamado
 *
 * RN-02 (assinatura obrigatória para manual) é validada no hook `useSaveLeitura`
 * porque depende do `operatorId` da sessão — service fica puro.
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import { firestoreErrorMessage } from '../../../shared/services/firebase';
import type {
  CertificadoCalibracao,
  CertificadoCalibracaoInput,
  DispositivoInput,
  DispositivoIoT,
  EquipamentoInput,
  EquipamentoMonitorado,
  LeituraInput,
  LeituraPrevista,
  LeituraPrevistaInput,
  LeituraTemperatura,
  LimiteViolado,
  LimitesAceitabilidade,
  NCInput,
  NaoConformidadeTemp,
  StatusCalibracao,
  StatusLeituraPrevista,
  StatusNC,
  Termometro,
  TermometroInput,
} from '../types/ControlTemperatura';
import type { LabId } from '../types/_shared_refs';

// ─── Root + paths ─────────────────────────────────────────────────────────────

const CT_ROOT = 'controleTemperatura';

const labRootDoc = (labId: LabId): DocumentReference => doc(db, CT_ROOT, labId);

const equipamentosCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'equipamentos');
const equipamentoDoc = (labId: LabId, id: string): DocumentReference =>
  doc(equipamentosCol(labId), id);

const leiturasCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'leituras');
const leituraDoc = (labId: LabId, id: string): DocumentReference =>
  doc(leiturasCol(labId), id);

const leiturasPrevistasCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'leituras-previstas');
const leituraPrevistaDoc = (labId: LabId, id: string): DocumentReference =>
  doc(leiturasPrevistasCol(labId), id);

const ncsCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'ncs');
const ncDoc = (labId: LabId, id: string): DocumentReference =>
  doc(ncsCol(labId), id);

const termometrosCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'termometros');
const termometroDoc = (labId: LabId, id: string): DocumentReference =>
  doc(termometrosCol(labId), id);

const dispositivosCol = (labId: LabId): CollectionReference =>
  collection(labRootDoc(labId), 'dispositivos-iot');
const dispositivoDoc = (labId: LabId, id: string): DocumentReference =>
  doc(dispositivosCol(labId), id);

/**
 * Garante doc raiz do tenant antes de escrever em subcoleções. Idempotente.
 */
async function ensureLabRoot(labId: LabId): Promise<void> {
  await setDoc(labRootDoc(labId), { labId }, { merge: true });
}

// ─── Utils de derivação (RN-01, RN-06) ───────────────────────────────────────

/**
 * Regra RN-01: deriva `foraDosLimites` comparando leitura contra limites.
 * Retorna o flag + qual limite foi violado (útil para criar NC).
 */
export function avaliarForaDosLimites(
  temperaturaAtual: number,
  umidade: number | undefined,
  limites: LimitesAceitabilidade,
): { fora: boolean; violado: LimiteViolado | null } {
  if (temperaturaAtual > limites.temperaturaMax) return { fora: true, violado: 'max' };
  if (temperaturaAtual < limites.temperaturaMin) return { fora: true, violado: 'min' };
  if (
    umidade !== undefined &&
    ((limites.umidadeMax !== undefined && umidade > limites.umidadeMax) ||
      (limites.umidadeMin !== undefined && umidade < limites.umidadeMin))
  ) {
    return { fora: true, violado: 'umidade' };
  }
  return { fora: false, violado: null };
}

/**
 * Regra RN-06: dispositivo é considerado online quando `ultimaTransmissao`
 * está dentro de 2× o intervalo nominal. Cliente recalcula no read para
 * refletir o momento atual sem depender do campo persistido (que pode ficar
 * stale entre transmissões).
 */
export function computarOnline(
  ultimaTransmissao: Timestamp | null,
  intervaloEnvioMinutos: number,
  agora: Date = new Date(),
): boolean {
  if (!ultimaTransmissao) return false;
  const msTolerancia = intervaloEnvioMinutos * 2 * 60 * 1000;
  return agora.getTime() - ultimaTransmissao.toMillis() <= msTolerancia;
}

/**
 * Regra RN-05: status derivado da calibração vigente do termômetro.
 *  vencido   → validade < hoje (bloqueia emissão FR-11)
 *  vencendo  → validade ≤ hoje + 30 dias (alerta âmbar)
 *  valido    → resto
 */
export const DIAS_ALERTA_CALIBRACAO = 30;

export function computarStatusCalibracao(
  calibracaoAtual: CertificadoCalibracao,
  agora: Date = new Date(),
): StatusCalibracao {
  const agoraMs = agora.getTime();
  const validadeMs = calibracaoAtual.dataValidade.toMillis();
  if (validadeMs < agoraMs) return 'vencido';
  const limite = agoraMs + DIAS_ALERTA_CALIBRACAO * 24 * 60 * 60 * 1000;
  if (validadeMs <= limite) return 'vencendo';
  return 'valido';
}

// ─── Mappers snap → entidade ─────────────────────────────────────────────────

function mapEquipamento(snap: QueryDocumentSnapshot): EquipamentoMonitorado {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    tipo: d.tipo as EquipamentoMonitorado['tipo'],
    localizacao: d.localizacao as string,
    termometroId: d.termometroId as string,
    limites: d.limites as LimitesAceitabilidade,
    calendario: d.calendario as EquipamentoMonitorado['calendario'],
    status: d.status as EquipamentoMonitorado['status'],
    dispositivoIoTId: (d.dispositivoIoTId ?? undefined) as string | undefined,
    observacoes: (d.observacoes ?? undefined) as string | undefined,
    criadoEm: d.criadoEm as Timestamp,
    atualizadoEm: d.atualizadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapLeitura(snap: QueryDocumentSnapshot): LeituraTemperatura {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    equipamentoId: d.equipamentoId as string,
    dataHora: d.dataHora as Timestamp,
    turno: d.turno as LeituraTemperatura['turno'],
    temperaturaAtual: d.temperaturaAtual as number,
    umidade: (d.umidade ?? undefined) as number | undefined,
    temperaturaMax: d.temperaturaMax as number,
    temperaturaMin: d.temperaturaMin as number,
    foraDosLimites: Boolean(d.foraDosLimites),
    origem: d.origem as LeituraTemperatura['origem'],
    dispositivoIoTId: (d.dispositivoIoTId ?? undefined) as string | undefined,
    status: d.status as LeituraTemperatura['status'],
    justificativaPerdida: (d.justificativaPerdida ?? undefined) as string | undefined,
    assinatura: (d.assinatura ?? undefined) as LeituraTemperatura['assinatura'],
    observacao: (d.observacao ?? undefined) as string | undefined,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapLeituraPrevista(snap: QueryDocumentSnapshot): LeituraPrevista {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    equipamentoId: d.equipamentoId as string,
    dataHoraPrevista: d.dataHoraPrevista as Timestamp,
    turno: d.turno as LeituraPrevista['turno'],
    status: d.status as StatusLeituraPrevista,
    leituraId: (d.leituraId ?? undefined) as string | undefined,
  };
}

function mapNC(snap: QueryDocumentSnapshot): NaoConformidadeTemp {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    leituraId: d.leituraId as string,
    equipamentoId: d.equipamentoId as string,
    temperaturaRegistrada: d.temperaturaRegistrada as number,
    limiteViolado: d.limiteViolado as LimiteViolado,
    descricao: d.descricao as string,
    acaoImediata: d.acaoImediata as string,
    acaoCorretiva: (d.acaoCorretiva ?? undefined) as string | undefined,
    responsavelAcao: d.responsavelAcao as string,
    dataAbertura: d.dataAbertura as Timestamp,
    dataResolucao: (d.dataResolucao ?? undefined) as Timestamp | undefined,
    status: d.status as StatusNC,
    assinatura: d.assinatura as NaoConformidadeTemp['assinatura'],
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapCertificado(raw: unknown): CertificadoCalibracao {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    versao: d.versao as number,
    dataEmissao: d.dataEmissao as Timestamp,
    dataValidade: d.dataValidade as Timestamp,
    certificadoUrl: (d.certificadoUrl ?? undefined) as string | undefined,
    laboratorioCalibrador: d.laboratorioCalibrador as string,
    numeroCertificado: d.numeroCertificado as string,
    arquivadoEm: (d.arquivadoEm ?? undefined) as Timestamp | undefined,
  };
}

function mapTermometro(snap: QueryDocumentSnapshot): Termometro {
  const d = snap.data();
  const historico = Array.isArray(d.historicoCalibracoes)
    ? (d.historicoCalibracoes as unknown[]).map(mapCertificado)
    : [];
  return {
    id: snap.id,
    labId: d.labId as LabId,
    numeroSerie: d.numeroSerie as string,
    modelo: d.modelo as string,
    fabricante: d.fabricante as string,
    incertezaMedicao: d.incertezaMedicao as number,
    calibracaoAtual: mapCertificado(d.calibracaoAtual),
    historicoCalibracoes: historico,
    ativo: d.ativo as boolean,
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapDispositivo(snap: QueryDocumentSnapshot): DispositivoIoT {
  const d = snap.data();
  const ultima = (d.ultimaTransmissao ?? null) as Timestamp | null;
  const intervalo = d.intervaloEnvioMinutos as number;
  return {
    id: snap.id,
    labId: d.labId as LabId,
    equipamentoId: d.equipamentoId as string,
    macAddress: d.macAddress as string,
    modelo: d.modelo as string,
    intervaloEnvioMinutos: intervalo,
    ultimaTransmissao: ultima,
    online: computarOnline(ultima, intervalo),
    firmwareVersao: d.firmwareVersao as string,
    tokenAcesso: d.tokenAcesso as string,
    ativo: d.ativo as boolean,
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// ─── API: Equipamentos ───────────────────────────────────────────────────────

export async function createEquipamento(
  labId: LabId,
  input: EquipamentoInput,
): Promise<string> {
  try {
    await ensureLabRoot(labId);
    const ref = doc(equipamentosCol(labId));
    await setDoc(ref, {
      labId,
      ...input,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      deletadoEm: null,
    });
    return ref.id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function updateEquipamento(
  labId: LabId,
  id: string,
  patch: Partial<EquipamentoInput>,
): Promise<void> {
  try {
    await updateDoc(equipamentoDoc(labId, id), {
      ...patch,
      atualizadoEm: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function softDeleteEquipamento(labId: LabId, id: string): Promise<void> {
  await updateDoc(equipamentoDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export async function restoreEquipamento(labId: LabId, id: string): Promise<void> {
  await updateDoc(equipamentoDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeEquipamentosOptions {
  includeDeleted?: boolean;
  status?: EquipamentoMonitorado['status'];
}

export function subscribeEquipamentos(
  labId: LabId,
  options: SubscribeEquipamentosOptions,
  callback: (list: EquipamentoMonitorado[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(equipamentosCol(labId), orderBy('nome', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapEquipamento);
      const filtered = all.filter((e) => {
        if (!options.includeDeleted && e.deletadoEm !== null) return false;
        if (options.status && e.status !== options.status) return false;
        return true;
      });
      callback(filtered);
    },
    (err) => onError?.(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── API: Leituras ────────────────────────────────────────────────────────────

/**
 * Cria uma leitura aplicando RN-01 atomicamente:
 *  1. deriva `foraDosLimites` vs `limites`
 *  2. escreve a leitura
 *  3. se fora dos limites, cria a NC correspondente
 *  4. se `leituraPrevistaId` fornecido, marca a previsão como realizada
 *
 * `writeBatch` garante que ou tudo vira, ou nada — impossível ter leitura fora
 * do limite sem a NC sombra, cenário que quebraria auditoria RDC 978.
 */
export async function createLeituraComNC(
  labId: LabId,
  input: LeituraInput,
  limites: LimitesAceitabilidade,
  ncDefaults: Pick<NCInput, 'assinatura' | 'responsavelAcao'> & {
    descricao?: string;
    acaoImediata?: string;
  },
  leituraPrevistaId?: string,
): Promise<{ leituraId: string; ncId: string | null }> {
  try {
    await ensureLabRoot(labId);
    const avaliacao = avaliarForaDosLimites(input.temperaturaAtual, input.umidade, limites);

    const batch = writeBatch(db);
    const leituraRef = doc(leiturasCol(labId));

    batch.set(leituraRef, {
      labId,
      equipamentoId: input.equipamentoId,
      dataHora: input.dataHora,
      turno: input.turno,
      temperaturaAtual: input.temperaturaAtual,
      umidade: input.umidade ?? null,
      temperaturaMax: input.temperaturaMax,
      temperaturaMin: input.temperaturaMin,
      foraDosLimites: avaliacao.fora,
      origem: input.origem,
      dispositivoIoTId: input.dispositivoIoTId ?? null,
      status: input.status,
      justificativaPerdida: input.justificativaPerdida ?? null,
      assinatura: input.assinatura ?? null,
      observacao: input.observacao ?? null,
      deletadoEm: null,
    });

    let ncId: string | null = null;
    if (avaliacao.fora && avaliacao.violado !== null) {
      const ncRef = doc(ncsCol(labId));
      ncId = ncRef.id;
      batch.set(ncRef, {
        labId,
        leituraId: leituraRef.id,
        equipamentoId: input.equipamentoId,
        temperaturaRegistrada: input.temperaturaAtual,
        limiteViolado: avaliacao.violado,
        descricao:
          ncDefaults.descricao ??
          `Leitura fora dos limites (${avaliacao.violado}). Valor: ${input.temperaturaAtual}.`,
        acaoImediata:
          ncDefaults.acaoImediata ??
          'Ação imediata pendente de registro pelo responsável.',
        responsavelAcao: ncDefaults.responsavelAcao,
        dataAbertura: serverTimestamp(),
        status: 'aberta' as StatusNC,
        assinatura: ncDefaults.assinatura,
        deletadoEm: null,
      });
    }

    if (leituraPrevistaId) {
      batch.update(leituraPrevistaDoc(labId, leituraPrevistaId), {
        status: 'realizada' as StatusLeituraPrevista,
        leituraId: leituraRef.id,
      });
    }

    await batch.commit();
    return { leituraId: leituraRef.id, ncId };
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function softDeleteLeitura(labId: LabId, id: string): Promise<void> {
  await updateDoc(leituraDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export async function restoreLeitura(labId: LabId, id: string): Promise<void> {
  await updateDoc(leituraDoc(labId, id), { deletadoEm: null });
}

export interface SubscribeLeiturasOptions {
  includeDeleted?: boolean;
  equipamentoId?: string;
  inicio?: Timestamp;
  fim?: Timestamp;
}

/**
 * ⚠️ Para evitar índice composto, filtro por equipamentoId fica client-side
 * quando combinado com orderBy('dataHora'). Revisar se um tenant passar de
 * ~10k leituras/mês por equipamento.
 */
export function subscribeLeituras(
  labId: LabId,
  options: SubscribeLeiturasOptions,
  callback: (list: LeituraTemperatura[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(leiturasCol(labId), orderBy('dataHora', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapLeitura);
      const filtered = all.filter((l) => {
        if (!options.includeDeleted && l.deletadoEm !== null) return false;
        if (options.equipamentoId && l.equipamentoId !== options.equipamentoId) return false;
        if (options.inicio && l.dataHora.toMillis() < options.inicio.toMillis()) return false;
        if (options.fim && l.dataHora.toMillis() > options.fim.toMillis()) return false;
        return true;
      });
      callback(filtered);
    },
    (err) => onError?.(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── API: Leituras Previstas ─────────────────────────────────────────────────

export async function createLeiturasPrevistasBatch(
  labId: LabId,
  inputs: LeituraPrevistaInput[],
): Promise<void> {
  try {
    if (inputs.length === 0) return;
    await ensureLabRoot(labId);
    const batch = writeBatch(db);
    for (const input of inputs) {
      const ref = doc(leiturasPrevistasCol(labId));
      batch.set(ref, {
        labId,
        equipamentoId: input.equipamentoId,
        dataHoraPrevista: input.dataHoraPrevista,
        turno: input.turno,
        status: input.status,
        leituraId: input.leituraId ?? null,
      });
    }
    await batch.commit();
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function updateLeituraPrevistaStatus(
  labId: LabId,
  id: string,
  status: StatusLeituraPrevista,
  leituraId?: string,
): Promise<void> {
  await updateDoc(leituraPrevistaDoc(labId, id), {
    status,
    leituraId: leituraId ?? null,
  });
}

export interface SubscribeLeiturasPrevistasOptions {
  equipamentoId?: string;
  status?: StatusLeituraPrevista;
  inicio?: Timestamp;
  fim?: Timestamp;
}

export function subscribeLeiturasPrevistas(
  labId: LabId,
  options: SubscribeLeiturasPrevistasOptions,
  callback: (list: LeituraPrevista[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(leiturasPrevistasCol(labId), orderBy('dataHoraPrevista', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapLeituraPrevista);
      const filtered = all.filter((p) => {
        if (options.equipamentoId && p.equipamentoId !== options.equipamentoId) return false;
        if (options.status && p.status !== options.status) return false;
        if (options.inicio && p.dataHoraPrevista.toMillis() < options.inicio.toMillis()) return false;
        if (options.fim && p.dataHoraPrevista.toMillis() > options.fim.toMillis()) return false;
        return true;
      });
      callback(filtered);
    },
    (err) => onError?.(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── API: NCs ────────────────────────────────────────────────────────────────

export async function createNC(labId: LabId, input: NCInput): Promise<string> {
  try {
    await ensureLabRoot(labId);
    const ref = doc(ncsCol(labId));
    await setDoc(ref, {
      labId,
      ...input,
      acaoCorretiva: input.acaoCorretiva ?? null,
      dataResolucao: input.dataResolucao ?? null,
      dataAbertura: serverTimestamp(),
      deletadoEm: null,
    });
    return ref.id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function updateNC(
  labId: LabId,
  id: string,
  patch: Partial<NCInput>,
): Promise<void> {
  await updateDoc(ncDoc(labId, id), { ...patch });
}

export async function resolverNC(
  labId: LabId,
  id: string,
  acaoCorretiva: string,
): Promise<void> {
  await updateDoc(ncDoc(labId, id), {
    status: 'resolvida' as StatusNC,
    acaoCorretiva,
    dataResolucao: serverTimestamp(),
  });
}

export async function softDeleteNC(labId: LabId, id: string): Promise<void> {
  await updateDoc(ncDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export interface SubscribeNCsOptions {
  includeDeleted?: boolean;
  equipamentoId?: string;
  status?: StatusNC;
}

export function subscribeNCs(
  labId: LabId,
  options: SubscribeNCsOptions,
  callback: (list: NaoConformidadeTemp[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(ncsCol(labId), orderBy('dataAbertura', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapNC);
      const filtered = all.filter((n) => {
        if (!options.includeDeleted && n.deletadoEm !== null) return false;
        if (options.equipamentoId && n.equipamentoId !== options.equipamentoId) return false;
        if (options.status && n.status !== options.status) return false;
        return true;
      });
      callback(filtered);
    },
    (err) => onError?.(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── API: Termômetros ────────────────────────────────────────────────────────

function toCertificadoV1(input: CertificadoCalibracaoInput): CertificadoCalibracao {
  return {
    versao: 1,
    dataEmissao: input.dataEmissao,
    dataValidade: input.dataValidade,
    certificadoUrl: input.certificadoUrl,
    laboratorioCalibrador: input.laboratorioCalibrador,
    numeroCertificado: input.numeroCertificado,
  };
}

function certificadoDoc(c: CertificadoCalibracao): Record<string, unknown> {
  return {
    versao: c.versao,
    dataEmissao: c.dataEmissao,
    dataValidade: c.dataValidade,
    certificadoUrl: c.certificadoUrl ?? null,
    laboratorioCalibrador: c.laboratorioCalibrador,
    numeroCertificado: c.numeroCertificado,
    arquivadoEm: c.arquivadoEm ?? null,
  };
}

export async function createTermometro(
  labId: LabId,
  input: TermometroInput,
): Promise<string> {
  try {
    await ensureLabRoot(labId);
    const ref = doc(termometrosCol(labId));
    const primeira = toCertificadoV1(input.calibracaoAtual);
    await setDoc(ref, {
      labId,
      numeroSerie: input.numeroSerie,
      modelo: input.modelo,
      fabricante: input.fabricante,
      incertezaMedicao: input.incertezaMedicao,
      calibracaoAtual: certificadoDoc(primeira),
      historicoCalibracoes: [certificadoDoc(primeira)],
      ativo: input.ativo,
      criadoEm: serverTimestamp(),
      deletadoEm: null,
    });
    return ref.id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Update parcial de campos estáticos (numeroSerie, modelo, fabricante,
 * incertezaMedicao, ativo). Calibração segue fluxo exclusivo de
 * `registrarNovaCalibracao` — RN-09 impede "editar" calibração existente.
 */
export async function updateTermometro(
  labId: LabId,
  id: string,
  patch: Partial<Omit<TermometroInput, 'calibracaoAtual'>>,
): Promise<void> {
  await updateDoc(termometroDoc(labId, id), { ...patch });
}

/**
 * RN-09: registrar nova calibração do termômetro.
 *  1. Lê o termômetro em transaction.
 *  2. Arquiva a calibração vigente (`arquivadoEm = now()`).
 *  3. Cria nova com `versao = anterior.versao + 1`.
 *  4. Atualiza `calibracaoAtual` + anexa ao `historicoCalibracoes`.
 *
 * Nunca remove histórico — requisito de rastreabilidade metrológica
 * (ISO 15189:2022 cl. 5.3.1).
 */
export async function registrarNovaCalibracao(
  labId: LabId,
  termometroId: string,
  input: CertificadoCalibracaoInput,
): Promise<number> {
  try {
    const ref = termometroDoc(labId, termometroId);
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('Termômetro não encontrado.');
      }
      const data = snap.data();
      const atual = mapCertificado(data.calibracaoAtual);
      const historico: CertificadoCalibracao[] = Array.isArray(data.historicoCalibracoes)
        ? (data.historicoCalibracoes as unknown[]).map(mapCertificado)
        : [];

      const nowTs = Timestamp.now();
      const atualArquivada: CertificadoCalibracao = { ...atual, arquivadoEm: nowTs };
      const novaVersao = atual.versao + 1;
      const nova: CertificadoCalibracao = {
        versao: novaVersao,
        dataEmissao: input.dataEmissao,
        dataValidade: input.dataValidade,
        certificadoUrl: input.certificadoUrl,
        laboratorioCalibrador: input.laboratorioCalibrador,
        numeroCertificado: input.numeroCertificado,
      };

      // historico[0..n] = versões anteriores (já arquivadas) + atual (ainda sem arquivadoEm).
      // Substitui a última (anterior atual) pela versão arquivada e anexa a nova.
      const historicoAtualizado = historico
        .map((h) => (h.versao === atual.versao ? atualArquivada : h))
        .concat([nova]);

      tx.update(ref, {
        calibracaoAtual: certificadoDoc(nova),
        historicoCalibracoes: historicoAtualizado.map(certificadoDoc),
      });
      return novaVersao;
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/** Atualiza apenas o URL do PDF no certificado vigente (pós-upload). */
export async function atualizarUrlCertificadoAtual(
  labId: LabId,
  termometroId: string,
  certificadoUrl: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = termometroDoc(labId, termometroId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const atual = mapCertificado(data.calibracaoAtual);
    const historico: CertificadoCalibracao[] = Array.isArray(data.historicoCalibracoes)
      ? (data.historicoCalibracoes as unknown[]).map(mapCertificado)
      : [];
    const atualNovo = { ...atual, certificadoUrl };
    tx.update(ref, {
      calibracaoAtual: certificadoDoc(atualNovo),
      historicoCalibracoes: historico
        .map((h) => (h.versao === atual.versao ? atualNovo : h))
        .map(certificadoDoc),
    });
  });
}

export async function softDeleteTermometro(labId: LabId, id: string): Promise<void> {
  await updateDoc(termometroDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export interface SubscribeTermometrosOptions {
  includeDeleted?: boolean;
  somenteAtivos?: boolean;
}

export function subscribeTermometros(
  labId: LabId,
  options: SubscribeTermometrosOptions,
  callback: (list: Termometro[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(termometrosCol(labId), orderBy('proximaCalibracao', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapTermometro);
      const filtered = all.filter((t) => {
        if (!options.includeDeleted && t.deletadoEm !== null) return false;
        if (options.somenteAtivos && !t.ativo) return false;
        return true;
      });
      callback(filtered);
    },
    (err) => onError?.(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── API: Dispositivos IoT ───────────────────────────────────────────────────

/**
 * Cria dispositivo guardando apenas o hash SHA-256 do token. O plain token
 * é entregue uma única vez ao operador (pra flashear no ESP32) e nunca
 * persistido. Chamador deve exibir imediatamente após `createDispositivo`.
 */
export async function createDispositivo(
  labId: LabId,
  input: DispositivoInput,
): Promise<string> {
  try {
    await ensureLabRoot(labId);
    const ref = doc(dispositivosCol(labId));
    await setDoc(ref, {
      labId,
      ...input,
      ultimaTransmissao: null,
      criadoEm: serverTimestamp(),
      deletadoEm: null,
    });
    return ref.id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function updateDispositivo(
  labId: LabId,
  id: string,
  patch: Partial<DispositivoInput>,
): Promise<void> {
  await updateDoc(dispositivoDoc(labId, id), { ...patch });
}

export async function softDeleteDispositivo(labId: LabId, id: string): Promise<void> {
  await updateDoc(dispositivoDoc(labId, id), { deletadoEm: serverTimestamp() });
}

export interface SubscribeDispositivosOptions {
  includeDeleted?: boolean;
  somenteAtivos?: boolean;
  equipamentoId?: string;
}

export function subscribeDispositivos(
  labId: LabId,
  options: SubscribeDispositivosOptions,
  callback: (list: DispositivoIoT[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(dispositivosCol(labId), orderBy('criadoEm', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapDispositivo);
      const filtered = all.filter((d) => {
        if (!options.includeDeleted && d.deletadoEm !== null) return false;
        if (options.somenteAtivos && !d.ativo) return false;
        if (options.equipamentoId && d.equipamentoId !== options.equipamentoId) return false;
        return true;
      });
      callback(filtered);
    },
    (err) => onError?.(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

// ─── API: Import em lote (RN-10) ─────────────────────────────────────────────

export interface ImportItemEquipamento {
  input: EquipamentoInput;
  /** `termometroId` será resolvido via `termometroChaveDeImport`. */
  termometroChaveDeImport: string;
}

export interface ImportItemTermometro {
  chaveDeImport: string; // numeroSerie, usado pra linkar com equipamentos
  input: TermometroInput;
}

export interface ImportResultado {
  termometrosCriados: number;
  equipamentosCriados: number;
  previstasGeradas: number;
}

/**
 * RN-10: import em lote atômico — equipamentos + termômetros + leituras
 * previstas dos próximos 7 dias. Caller já validou linha-a-linha em
 * `ctXlsxService#parseImportXlsx`. Tudo roda em writeBatch único — ou tudo
 * vira, ou nada. `chaveDeImport` (numeroSerie do termômetro) é o que permite
 * o relacionamento equipamento→termômetro antes do Firestore atribuir IDs.
 */
export async function importarXlsxBatch(
  labId: LabId,
  termometros: ImportItemTermometro[],
  equipamentos: ImportItemEquipamento[],
): Promise<ImportResultado> {
  await ensureLabRoot(labId);
  const batch = writeBatch(db);

  const termometroIdPorChave = new Map<string, string>();
  for (const t of termometros) {
    const ref = doc(termometrosCol(labId));
    termometroIdPorChave.set(t.chaveDeImport, ref.id);
    const primeira = toCertificadoV1(t.input.calibracaoAtual);
    batch.set(ref, {
      labId,
      numeroSerie: t.input.numeroSerie,
      modelo: t.input.modelo,
      fabricante: t.input.fabricante,
      incertezaMedicao: t.input.incertezaMedicao,
      calibracaoAtual: certificadoDoc(primeira),
      historicoCalibracoes: [certificadoDoc(primeira)],
      ativo: t.input.ativo,
      criadoEm: serverTimestamp(),
      deletadoEm: null,
    });
  }

  const equipamentoIds: { id: string; input: EquipamentoInput }[] = [];
  for (const e of equipamentos) {
    const termometroId = termometroIdPorChave.get(e.termometroChaveDeImport);
    if (!termometroId) {
      throw new Error(
        `Termômetro com série "${e.termometroChaveDeImport}" não encontrado na Aba 2.`,
      );
    }
    const ref = doc(equipamentosCol(labId));
    equipamentoIds.push({ id: ref.id, input: e.input });
    batch.set(ref, {
      labId,
      ...e.input,
      termometroId,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      deletadoEm: null,
    });
  }

  // Gera previsões para os próximos 7 dias com base no calendário do equipamento.
  let previstasGeradas = 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 7; offset++) {
    const dia = new Date(hoje.getTime() + offset * 24 * 60 * 60 * 1000);
    const w = dia.getDay();
    for (const { id, input } of equipamentoIds) {
      const cal = input.calendario;
      const bucket =
        w === 0 ? cal.domingo : w === 6 ? cal.sabado : cal.diasUteis;
      if (!bucket.obrigatorio) continue;
      for (const hora of bucket.horarios) {
        const [h, m] = hora.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const dt = new Date(dia);
        dt.setHours(h, m, 0, 0);
        if (dt.getTime() < Date.now()) continue; // pula horários que já passaram hoje
        const pRef = doc(leiturasPrevistasCol(labId));
        batch.set(pRef, {
          labId,
          equipamentoId: id,
          dataHoraPrevista: Timestamp.fromDate(dt),
          turno: h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite',
          status: 'pendente' as StatusLeituraPrevista,
          leituraId: null,
        });
        previstasGeradas += 1;
      }
    }
  }

  await batch.commit();
  return {
    termometrosCriados: termometros.length,
    equipamentosCriados: equipamentoIds.length,
    previstasGeradas,
  };
}
