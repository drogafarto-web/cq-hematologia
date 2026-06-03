/**
 * personnelDossierService — REQ-403 fatia 1 + Point 5 (validade registros + certificações)
 *
 * `/labs/{labId}/personnelDossiers/{colaboradorId}`
 * Leitura/escrita client-side com rules: superadmin OU (membro ativo + admin|owner|rt).
 */

import { z } from 'zod';

import type {
  CertificacaoRegistro,
  LabId,
  PersonnelDossier,
  PersonnelDossierEditable,
} from '../types';
import {
  db,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';

const dossierDocRef = (labId: LabId, colaboradorId: string) =>
  doc(db, 'labs', labId, 'personnelDossiers', colaboradorId);

const certificacaoSchema = z.object({
  nome: z.string().min(1).max(256),
  numero: z.string().max(128),
  dataEmissao: z.instanceof(Timestamp),
  dataValidade: z.union([z.instanceof(Timestamp), z.null()]),
});

export const personnelDossierEditableSchema = z.object({
  cvUrl: z.union([z.string().max(2048), z.null()]),
  cvResumo: z.union([z.string().max(8000), z.null()]),
  registroCRF: z.union([z.string().max(128), z.null()]),
  registroCRBM: z.union([z.string().max(128), z.null()]),
  registroCREF: z.union([z.string().max(128), z.null()]),
  registroCRFValidade: z.union([z.instanceof(Timestamp), z.null()]),
  registroCRBMValidade: z.union([z.instanceof(Timestamp), z.null()]),
  registroCREFValidade: z.union([z.instanceof(Timestamp), z.null()]),
  certificacoesNotas: z.union([z.string().max(8000), z.null()]),
  certificacoes: z.array(certificacaoSchema).max(50).default([]),
});

function mapPersonnelDossier(snap: DocumentSnapshot): PersonnelDossier | null {
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    labId: String(d.labId ?? ''),
    colaboradorId: String(d.colaboradorId ?? snap.id),
    cvUrl: d.cvUrl != null ? String(d.cvUrl) : null,
    cvResumo: d.cvResumo != null ? String(d.cvResumo) : null,
    registroCRF: d.registroCRF != null ? String(d.registroCRF) : null,
    registroCRBM: d.registroCRBM != null ? String(d.registroCRBM) : null,
    registroCREF: d.registroCREF != null ? String(d.registroCREF) : null,
    registroCRFValidade: d.registroCRFValidade ?? null,
    registroCRBMValidade: d.registroCRBMValidade ?? null,
    registroCREFValidade: d.registroCREFValidade ?? null,
    certificacoesNotas: d.certificacoesNotas != null ? String(d.certificacoesNotas) : null,
    certificacoes: Array.isArray(d.certificacoes)
      ? (d.certificacoes as CertificacaoRegistro[])
      : [],
    criadoEm: d.criadoEm,
    updatedAt: d.updatedAt,
  };
}

export function subscribePersonnelDossier(
  labId: LabId,
  colaboradorId: string,
  onNext: (dossier: PersonnelDossier | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = dossierDocRef(labId, colaboradorId);
  return onSnapshot(
    ref,
    (snap) => {
      onNext(mapPersonnelDossier(snap));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/** Normaliza strings de formulário antes do Zod. */
export function normalizePersonnelDossierInput(raw: {
  cvUrl: string;
  cvResumo: string;
  registroCRF: string;
  registroCRBM: string;
  registroCREF: string;
  registroCRFValidade: Timestamp | null;
  registroCRBMValidade: Timestamp | null;
  registroCREFValidade: Timestamp | null;
  certificacoesNotas: string;
  certificacoes: CertificacaoRegistro[];
}): PersonnelDossierEditable {
  return personnelDossierEditableSchema.parse({
    cvUrl: emptyToNull(raw.cvUrl),
    cvResumo: emptyToNull(raw.cvResumo),
    registroCRF: emptyToNull(raw.registroCRF),
    registroCRBM: emptyToNull(raw.registroCRBM),
    registroCREF: emptyToNull(raw.registroCREF),
    registroCRFValidade: raw.registroCRFValidade,
    registroCRBMValidade: raw.registroCRBMValidade,
    registroCREFValidade: raw.registroCREFValidade,
    certificacoesNotas: emptyToNull(raw.certificacoesNotas),
    certificacoes: raw.certificacoes,
  });
}

export async function upsertPersonnelDossier(
  labId: LabId,
  colaboradorId: string,
  editable: PersonnelDossierEditable,
): Promise<void> {
  personnelDossierEditableSchema.parse(editable);
  const ref = dossierDocRef(labId, colaboradorId);
  const snap = await getDoc(ref);
  const ts = serverTimestamp();
  const payload = {
    labId,
    colaboradorId,
    cvUrl: editable.cvUrl,
    cvResumo: editable.cvResumo,
    registroCRF: editable.registroCRF,
    registroCRBM: editable.registroCRBM,
    registroCREF: editable.registroCREF,
    registroCRFValidade: editable.registroCRFValidade,
    registroCRBMValidade: editable.registroCRBMValidade,
    registroCREFValidade: editable.registroCREFValidade,
    certificacoesNotas: editable.certificacoesNotas,
    certificacoes: editable.certificacoes,
    updatedAt: ts,
    ...(snap.exists() ? {} : { criadoEm: ts }),
  };
  await setDoc(ref, payload, { merge: true });
}
