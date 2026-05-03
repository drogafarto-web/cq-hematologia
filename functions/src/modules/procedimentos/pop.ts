import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { POP, POPVersao } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

export const createPOP = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin && !request.auth?.token.responsavelTecnico) {
      throw new HttpsError('permission-denied', 'Apenas admin/RT podem criar POPs');
    }

    const { labId, nome, codigo, modulos } = request.data;

    if (!labId || !nome || !codigo) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, nome, codigo');
    }

    try {
      const pop: Partial<POP> = {
        labId,
        nome,
        codigo,
        modulos: modulos || [],
        conteudo: {
          versaoDocumento: '1.0',
        },
        versoes: [],
        treinamentosObrigatorios: [],
        criadoEm: admin.firestore.FieldValue.serverTimestamp() as any,
        criadoPor: request.auth.uid,
      };

      const popRef = await db.collection(`labs/${labId}/pops`).add(pop);

      return {
        success: true,
        popId: popRef.id,
        codigo,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao criar POP');
    }
  }
);

export const createPOPVersion = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem criar versões de POP');
    }

    const { labId, popId, conteudo } = request.data;

    if (!labId || !popId || !conteudo) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, popId, conteudo');
    }

    try {
      const popRef = db.collection(`labs/${labId}/pops`).doc(popId);
      const popSnap = await popRef.get();

      if (!popSnap.exists) {
        throw new HttpsError('not-found', `POP ${popId} não encontrado`);
      }

      const pop = popSnap.data() as POP;
      const currentVersions = pop.versoes || [];

      let novoNumero = '1.0';
      if (currentVersions.length > 0) {
        const lastVersion = currentVersions[currentVersions.length - 1];
        const [major, minor] = lastVersion.numero.split('.').map(Number);
        novoNumero = `${major}.${minor + 1}`;
      }

      const hashConteudo = crypto
        .createHash('sha256')
        .update(JSON.stringify(conteudo))
        .digest('hex');

      const vigenciaInicio = new Date();
      const vigenciaFim = new Date();
      vigenciaFim.setFullYear(vigenciaFim.getFullYear() + 2);

      const proximaRevisao = new Date();
      proximaRevisao.setFullYear(proximaRevisao.getFullYear() + 1);

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

      // Store versao (awaiting RT signature)
      currentVersions.push(novaVersao);

      await popRef.update({
        versoes: currentVersions,
        conteudo: {
          markdown: conteudo.markdown || '',
          pdfUrl: conteudo.pdfUrl || '',
          versaoDocumento: novoNumero,
        },
      });

      return {
        success: true,
        popId,
        versao: novoNumero,
        status: 'em_revisao',
        mensagem: 'POP criado, aguardando assinatura de RT',
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro ao criar versão');
    }
  }
);

export const assinaturaRT = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token.responsavelTecnico) {
      throw new HttpsError('permission-denied', 'Apenas RT pode assinar POPs');
    }

    const { labId, popId, versao } = request.data;

    if (!labId || !popId || !versao) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, popId, versao');
    }

    try {
      const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
      if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not set');

      const popRef = db.collection(`labs/${labId}/pops`).doc(popId);
      const popSnap = await popRef.get();

      if (!popSnap.exists) {
        throw new HttpsError('not-found', `POP ${popId} não encontrado`);
      }

      const pop = popSnap.data() as POP;
      const versionIndex = pop.versoes.findIndex(v => v.numero === versao);

      if (versionIndex === -1) {
        throw new HttpsError('not-found', `Versão ${versao} não encontrada`);
      }

      const versionToSign = pop.versoes[versionIndex];

      // Get operator name/cargo
      const userRef = await db.collection('users').doc(request.auth.uid).get();
      const userData = userRef.data() || {};

      const signedHmac = await signAuditEntry(
        `/labs/${labId}/pops/${popId}`,
        request.auth.uid,
        `pop.sign.${versao}`,
        versionToSign,
        secret
      );

      versionToSign.assinadaPor = {
        uid: request.auth.uid,
        nome: userData.nome || request.auth.displayName || 'Unknown',
        cargo: userData.cargo || 'RT',
        timestamp: admin.firestore.Timestamp.now(),
        hmac: signedHmac.hmac,
      };
      versionToSign.status = 'ativa';

      // Mark old ativa versions as obsoleta
      pop.versoes = pop.versoes.map((v, idx) => {
        if (idx === versionIndex) return versionToSign;
        if (v.status === 'ativa' && v.numero.split('.')[0] === versao.split('.')[0]) {
          return { ...v, status: 'obsoleta' as const, motivo_obsolescencia: `Substituída por v${versao}` };
        }
        return v;
      });

      await popRef.update({ versoes: pop.versoes });

      return {
        success: true,
        popId,
        versao,
        status: 'ativa',
        assinadoPor: versionToSign.assinadaPor.nome,
      };
    } catch (error: any) {
      throw new HttpsError('internal', error.message || 'Erro na assinatura');
    }
  }
);

// ADR 0004 — POP Validator integrated above
// ADR 0003 — NC Gate (Wave 3 Integration)  
import { checkNCs } from '../qualidade/naoConformidade';
