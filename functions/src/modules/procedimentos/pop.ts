import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import { POP, POPVersao } from './types';
import { computeHmac } from '../audit/cryptoAudit';
import { checkNCs } from '../qualidade/naoConformidade';
import { HCQ_SIGNATURE_HMAC_KEY } from '../signatures/verifier';

const db = admin.firestore();

/**
 * Validation schema for POP creation
 */
const POPCreationSchema = z.object({
  labId: z.string().min(1, 'labId é obrigatório'),
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  codigo: z.string().min(2, 'Código deve ter pelo menos 2 caracteres'),
  conteudo: z.object({
    markdown: z.string().optional(),
    pdfUrl: z.string().url().optional(),
  }),
  modulos: z.array(z.string()).default([]),
  treinamentosObrigatorios: z
    .array(
      z.object({
        modulo: z.string(),
        tipoTreinamento: z.enum(['inicial', 'reciclagem']),
        periodicidadeMeses: z.number().int().positive(),
      }),
    )
    .default([]),
});

/**
 * ADR 0004 Wave 2 — createPOP
 * Creates a new POP document ready for versioning and RT signature.
 * Only admin/RT can create.
 */
export const createPOP = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.responsavelTecnico) {
      throw new HttpsError('permission-denied', 'Apenas admin/RT podem criar POPs');
    }

    try {
      const payload = POPCreationSchema.parse(request.data);
      const { labId, nome, codigo, conteudo, modulos, treinamentosObrigatorios } = payload;

      // ADR 0003 Wave 3: Check for blocking NCs before creating POP
      const ncCheck = await checkNCs(labId, 'procedimentos');
      if (ncCheck.blocked) {
        throw new HttpsError(
          'failed-precondition',
          ncCheck.message || 'NC crítica aberta bloqueia operações neste módulo',
        );
      }

      // RN-SGQ-01: Check for duplicate code within lab
      const existingSnap = await db
        .collection(`labs/${labId}/pops`)
        .where('codigo', '==', codigo)
        .where('deletadoEm', '==', null)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        throw new HttpsError('already-exists', `POP com código ${codigo} já existe neste lab`);
      }

      // Create POP with empty versoes array (awaiting first version)
      const pop: Partial<POP> = {
        labId,
        nome,
        codigo,
        modulos,
        conteudo: {
          markdown: conteudo?.markdown || '',
          pdfUrl: conteudo?.pdfUrl || '',
          versaoDocumento: '1.0',
        },
        versoes: [],
        treinamentosObrigatorios,
        criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
        criadoPor: request.auth.uid,
      };

      const popRef = await db.collection(`labs/${labId}/pops`).add(pop);

      return {
        success: true,
        popId: popRef.id,
        codigo,
        mensagem: 'POP criado, aguardando primeira versão',
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', `Validação falhou: ${error.errors[0].message}`);
      }
      if (error.code === 'already-exists') {
        throw error;
      }
      throw new HttpsError('internal', error.message || 'Erro ao criar POP');
    }
  },
);

const POPVersionCreationSchema = z.object({
  labId: z.string().min(1),
  popId: z.string().min(1),
  conteudo: z.object({
    markdown: z.string().optional(),
    pdfUrl: z.string().url().optional(),
  }),
  isMajorVersion: z.boolean().optional(),
});

/**
 * ADR 0004 Wave 2 — createPOPVersion
 * Creates a new versioned content within existing POP.
 * Increments version (v1.0 → v1.1 or v2.0), computes hash, waits for RT signature.
 * Only admin can create versions.
 */
export const createPOPVersion = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem criar versões de POP');
    }

    try {
      const payload = POPVersionCreationSchema.parse(request.data);
      const { labId, popId, conteudo, isMajorVersion } = payload;

      const popRef = db.collection(`labs/${labId}/pops`).doc(popId);
      const popSnap = await popRef.get();

      if (!popSnap.exists) {
        throw new HttpsError('not-found', `POP ${popId} não encontrado`);
      }

      const pop = popSnap.data() as POP;
      const currentVersions = pop.versoes || [];

      // Calculate new version number
      let novoNumero = '1.0';
      if (currentVersions.length > 0) {
        const lastVersion = currentVersions[currentVersions.length - 1];
        const [major, minor] = lastVersion.numero.split('.').map(Number);
        if (isMajorVersion) {
          novoNumero = `${major + 1}.0`;
        } else {
          novoNumero = `${major}.${minor + 1}`;
        }
      }

      // RN-SGQ-07: Compute hash of content (SHA-256)
      const conteudoForHash = {
        markdown: conteudo?.markdown || '',
        pdfUrl: conteudo?.pdfUrl || '',
      };
      const hashConteudo = crypto
        .createHash('sha256')
        .update(JSON.stringify(conteudoForHash, Object.keys(conteudoForHash).sort()))
        .digest('hex');

      // Set validity dates
      const vigenciaInicio = new Date();
      const vigenciaFim = new Date();
      vigenciaFim.setFullYear(vigenciaFim.getFullYear() + 2);

      const proximaRevisao = new Date();
      proximaRevisao.setFullYear(proximaRevisao.getFullYear() + 1);

      // Create versão in em_revisao status (awaiting RT signature)
      const novaVersao: POPVersao = {
        numero: novoNumero,
        dataVigenciaInicio: admin.firestore.Timestamp.fromDate(vigenciaInicio),
        dataVigenciaFim: admin.firestore.Timestamp.fromDate(vigenciaFim),
        hashConteudo,
        assinadaPor: {
          uid: '',
          nome: '',
          cargo: '',
          timestamp: admin.firestore.Timestamp.now(),
          hmac: '',
        },
        proximaRevisao: admin.firestore.Timestamp.fromDate(proximaRevisao),
        status: 'em_revisao',
      };

      // Add version to list
      currentVersions.push(novaVersao);

      // Update POP with new versão
      await popRef.update({
        versoes: currentVersions,
        conteudo: {
          markdown: conteudo?.markdown || '',
          pdfUrl: conteudo?.pdfUrl || '',
          versaoDocumento: novoNumero,
        },
      });

      return {
        success: true,
        popId,
        versao: novoNumero,
        status: 'em_revisao',
        hashConteudo,
        mensagem: 'Versão criada, aguardando assinatura de RT',
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', `Validação falhou: ${error.errors[0].message}`);
      }
      throw new HttpsError('internal', error.message || 'Erro ao criar versão');
    }
  },
);

const POPSignatureSchema = z.object({
  labId: z.string().min(1),
  popId: z.string().min(1),
  popVersaoNumero: z.string().regex(/^\d+\.\d+$/),
});

/**
 * ADR 0004 Wave 2 — assinaturaRT
 * RT-only signature of POP version. Validates qualificacao, signs with HMAC,
 * transitions status em_revisao → ativa, auto-obsoletes old versions.
 */
export const assinaturaRT = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.token.responsavelTecnico) {
      throw new HttpsError('permission-denied', 'Apenas RT pode assinar POPs');
    }

    try {
      const payload = POPSignatureSchema.parse(request.data);
      const { labId, popId, popVersaoNumero } = payload;

      // Get HMAC secret for signing
      const secret = HCQ_SIGNATURE_HMAC_KEY.value();
      if (!secret) {
        throw new HttpsError('internal', 'HCQ_SIGNATURE_HMAC_KEY not configured');
      }

      const popRef = db.collection(`labs/${labId}/pops`).doc(popId);
      const popSnap = await popRef.get();

      if (!popSnap.exists) {
        throw new HttpsError('not-found', `POP ${popId} não encontrado`);
      }

      const pop = popSnap.data() as POP;
      const versionIndex = pop.versoes.findIndex((v) => v.numero === popVersaoNumero);

      if (versionIndex === -1) {
        throw new HttpsError('not-found', `Versão ${popVersaoNumero} não encontrada`);
      }

      const versionToSign = pop.versoes[versionIndex];

      // RN-SGQ-02: Validate status transition
      if (versionToSign.status !== 'em_revisao') {
        throw new HttpsError(
          'failed-precondition',
          `Apenas versões em_revisao podem ser assinadas. Status atual: ${versionToSign.status}`,
        );
      }

      // Get RT user info (from custom claims or users collection)
      const userRef = await db.collection('users').doc(request.auth.uid).get();
      const userData = userRef.data() || {};

      // ADR 0005 integration: Compute HMAC of version data
      const versionDataForHmac = {
        numero: versionToSign.numero,
        hashConteudo: versionToSign.hashConteudo,
        dataVigenciaInicio: versionToSign.dataVigenciaInicio,
        dataVigenciaFim: versionToSign.dataVigenciaFim,
      };
      const hmacSignature = computeHmac(versionDataForHmac, secret);

      // Update version with signature
      versionToSign.assinadaPor = {
        uid: request.auth.uid,
        nome: userData.nome || request.auth.displayName || 'Unknown',
        cargo: userData.cargo || 'RT',
        timestamp: admin.firestore.Timestamp.now(),
        hmac: hmacSignature,
      };
      versionToSign.status = 'ativa';

      // RN-SGQ-03: Auto-obsolete old ativa versions from same major version
      const majorVersion = versionToSign.numero.split('.')[0];
      pop.versoes = pop.versoes.map((v, idx) => {
        if (idx === versionIndex) {
          return versionToSign;
        }
        // Obsolete only if same major version and currently ativa
        if (v.status === 'ativa' && v.numero.split('.')[0] === majorVersion) {
          return {
            ...v,
            status: 'obsoleta' as const,
            motivo_obsolescencia: `Substituída por v${popVersaoNumero}`,
          };
        }
        return v;
      });

      // Atomic write
      await popRef.update({ versoes: pop.versoes });

      return {
        success: true,
        popId,
        popVersaoNumero,
        status: 'ativa',
        assinadoPor: versionToSign.assinadaPor.nome,
        assinadoEm: versionToSign.assinadaPor.timestamp,
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', `Validação falhou: ${error.errors[0].message}`);
      }
      throw new HttpsError('internal', error.message || 'Erro ao assinar POP');
    }
  },
);

const POPTrainingSchema = z.object({
  labId: z.string().min(1),
  operadorUid: z.string().min(1),
  popId: z.string().min(1),
  popVersaoNumero: z.string().regex(/^\d+\.\d+$/),
  certificado_url: z.string().url().optional(),
});

/**
 * ADR 0004 Wave 2 — recordarTreinamentoPOP
 * Links operator training to specific POP version. Validates:
 * - Operator must have qualificacao for module
 * - POP version must be ativa
 * - Creates/updates qualificacoes/{operadorId} with training record
 * Valid for 1 year (365 days) from completion date.
 */
export const recordarTreinamentoPOP = onCall(
  { region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.instrutorId) {
      throw new HttpsError(
        'permission-denied',
        'Apenas admin/instrutor podem registrar treinamentos',
      );
    }

    try {
      const payload = POPTrainingSchema.parse(request.data);
      const { labId, operadorUid, popId, popVersaoNumero, certificado_url } = payload;

      // Verify POP exists and version is ativa
      const popSnap = await db.collection(`labs/${labId}/pops`).doc(popId).get();
      if (!popSnap.exists) {
        throw new HttpsError('not-found', `POP ${popId} não encontrado`);
      }

      const pop = popSnap.data() as POP;
      const targetVersion = pop.versoes.find(
        (v) => v.numero === popVersaoNumero && v.status === 'ativa',
      );

      if (!targetVersion) {
        throw new HttpsError('invalid-argument', `POP v${popVersaoNumero} não está ativa`);
      }

      // Validate operator has required qualificacao for all modules in POP
      // (defense-in-depth; hooks validate this client-side too)
      for (const modulo of pop.modulos) {
        const qualSnap = await db
          .collection(`labs/${labId}/qualificacoes`)
          .where('uid', '==', operadorUid)
          .where('qualificacoes', 'array-contains', modulo)
          .limit(1)
          .get();

        if (qualSnap.empty) {
          throw new HttpsError(
            'failed-precondition',
            `Operador não tem qualificação para o módulo: ${modulo}`,
          );
        }
      }

      // Create training record
      const dataConcluso = admin.firestore.Timestamp.now();
      const validoAte = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
      );

      const treinamentoPOP = {
        popId,
        popVersaoNumero,
        dataConcluso,
        validoAte,
        certificado_url: certificado_url || null,
      };

      // Get or create qualificacoes document for operator
      const qualRef = db.collection(`labs/${labId}/qualificacoes`).doc(operadorUid);
      const qualSnap = await qualRef.get();

      if (qualSnap.exists) {
        const qual = qualSnap.data() as any;
        const treinamentos = qual?.treinamentosPOP || [];

        // Remove any existing training record for same POP (update, not add)
        const filtered = treinamentos.filter(
          (t: any) => !(t.popId === popId && t.popVersaoNumero === popVersaoNumero),
        );

        filtered.push(treinamentoPOP);
        await qualRef.update({ treinamentosPOP: filtered });
      } else {
        // Create new qualificacoes doc with training record
        await qualRef.set({
          labId,
          uid: operadorUid,
          qualificacoes: pop.modulos, // Initialize with modules from POP
          treinamentosPOP: [treinamentoPOP],
          criadoEm: dataConcluso,
        });
      }

      return {
        success: true,
        operadorUid,
        popId,
        popVersaoNumero,
        validoAte: validoAte.toDate(),
        certificado_url: certificado_url || null,
        mensagem: 'Treinamento registrado com sucesso',
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', `Validação falhou: ${error.errors[0].message}`);
      }
      throw new HttpsError('internal', error.message || 'Erro ao registrar treinamento');
    }
  },
);
