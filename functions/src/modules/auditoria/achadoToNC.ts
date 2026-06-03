import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import type { Achado, SeveridadeAchado, LogicalSignature } from './types';

const db = admin.firestore();

interface NaoConformidade {
  id: string;
  labId: string;
  titulo: string;
  descricao: string;
  origem: 'auditoria-interna' | 'cliente' | 'interno' | 'externo';
  achadoId: string;
  auditoriaId: string;
  severidade: string;
  status: 'aberta' | 'fechada' | 'em_plano';
  assinatura: LogicalSignature;
  criadoEm: admin.firestore.Timestamp;
  criadoPor: string;
  deletadoEm: null;
}

const SEVERIDADE_MAP: Record<SeveridadeAchado, string> = {
  crítica: 'crítica',
  grave: 'grave',
  moderada: 'moderada',
  leve: 'leve',
  observação: 'observação',
};

export async function createNCFromAchado(
  labId: string,
  achado: Achado,
  auditoriaId: string,
  sessaoId: string,
  operatorId: string,
): Promise<{ ncId: string }> {
  // CRITICAL: Cross-tenant validation
  if (achado.labId !== labId) {
    throw new Error(
      `Cross-tenant violation: achado.labId=${achado.labId} does not match labId=${labId}`,
    );
  }

  const ncRef = db.collection(`labs/${labId}/naoConformidades`).doc();
  const ncId = ncRef.id;

  // Map severidade to NC severity
  const prioridade = SEVERIDADE_MAP[achado.severidade] || 'moderada';

  // Canonical payload for signature with deterministic field ordering
  const canonicalPayload = {
    achadoId: achado.id,
    auditoriaId,
    descricao: achado.descricao,
    origem: 'auditoria-interna',
    severidade: prioridade,
  };

  const sortedKeys = Object.keys(canonicalPayload).sort();
  const canonicalJson =
    '{' +
    sortedKeys.map((k) => `"${k}":${JSON.stringify((canonicalPayload as any)[k])}`).join(',') +
    '}';

  const hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

  const assinatura: LogicalSignature = {
    hash,
    operatorId,
    ts: admin.firestore.Timestamp.now(),
  };

  const nc: NaoConformidade = {
    id: ncId,
    labId,
    titulo: `Achado auditoria: ${achado.descricao.substring(0, 60)}`,
    descricao: achado.descricao,
    origem: 'auditoria-interna',
    achadoId: achado.id,
    auditoriaId,
    severidade: prioridade,
    status: 'aberta',
    assinatura,
    criadoEm: admin.firestore.Timestamp.now(),
    criadoPor: operatorId,
    deletadoEm: null,
  };

  await ncRef.set(nc);

  return { ncId };
}
