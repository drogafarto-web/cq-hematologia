/**
 * parseDanfeXml — extrai dados do emitente e da nota fiscal a partir do
 * XML da NFe (padrão SEFAZ).
 *
 * Escopo inicial (Fase E): lê o mínimo pra popular FornecedorFormModal e
 * NotaFiscalFormModal. Preparado pra ampliar no módulo de qualificação de
 * fornecedores (endereço completo, itens, tributação, etc).
 *
 * Estratégia: DOMParser nativo do navegador, escolhendo os nós pelo nome
 * local (`tagName`) — não dependemos de namespace prefix, que varia entre
 * emissores. Qualquer campo ausente retorna undefined; o caller preenche
 * manualmente ou deixa em branco.
 *
 * Não é um validador de assinatura XMLDSig — é um extrator. A validação
 * formal contra schema SEFAZ ficará em Cloud Function futura.
 */

export interface DanfeExtractedData {
  emitente: {
    razaoSocial?: string;
    nomeFantasia?: string;
    cnpj?: string;
    inscricaoEstadual?: string;
    telefone?: string;
    email?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  nota: {
    numero?: string;
    serie?: string;
    chaveAcesso?: string;
    dataEmissao?: Date;
    valorTotal?: number;
  };
  /**
   * Itens da nota — reservado pra fase futura de automação: cada item pode
   * virar um lote pré-preenchido se o produto existir no catálogo.
   */
  itens: Array<{
    codigo?: string;
    descricao?: string;
    ncm?: string;
    quantidade?: number;
    unidade?: string;
    valorUnitario?: number;
    valorTotal?: number;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca o primeiro elemento filho com `localName === name` dentro de root.
 * Ignora namespace prefixes — funciona com NFe 4.0 de qualquer emissor.
 */
function findFirst(root: Element | Document | null, name: string): Element | null {
  if (!root) return null;
  const all = root.getElementsByTagName(name);
  if (all.length > 0) return all[0];
  // Fallback: alguns XMLs têm prefix. Tenta busca manual ignorando prefix.
  const nodes = (root as Element).getElementsByTagName('*');
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes.item(i);
    if (n && (n.localName === name || n.tagName.endsWith(`:${name}`))) {
      return n;
    }
  }
  return null;
}

function textOf(el: Element | null): string | undefined {
  if (!el) return undefined;
  const t = el.textContent?.trim();
  return t ? t : undefined;
}

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function parseIsoDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parseia uma string XML de NFe (procXXX.xml ou apenas o NFe). Retorna os
 * dados extraídos ou lança Error com mensagem amigável.
 */
export function parseDanfeXml(xml: string): DanfeExtractedData {
  if (!xml.trim()) {
    throw new Error('XML vazio.');
  }

  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  // DOMParser não lança em XML inválido — ele cria um nó <parsererror>.
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('XML mal formado. Confira o arquivo.');
  }

  const infNFe = findFirst(doc, 'infNFe');
  if (!infNFe) {
    throw new Error('Não encontrei o nó <infNFe>. O arquivo é realmente uma NFe?');
  }

  // Emitente
  const emit = findFirst(infNFe, 'emit');
  const enderEmit = findFirst(emit, 'enderEmit');

  // Identificação da nota
  const ide = findFirst(infNFe, 'ide');

  // Total
  const total = findFirst(infNFe, 'total');
  const icmsTot = findFirst(total, 'ICMSTot');

  // Chave — atributo Id do infNFe é "NFe" + chave (44 dígitos)
  const rawId = infNFe.getAttribute('Id') ?? '';
  const chaveAcesso = rawId.replace(/^NFe/, '').trim() || undefined;

  // Itens
  const itens: DanfeExtractedData['itens'] = [];
  const dets = infNFe.getElementsByTagName('det');
  for (let i = 0; i < dets.length; i++) {
    const det = dets.item(i);
    if (!det) continue;
    const prod = findFirst(det, 'prod');
    itens.push({
      codigo: textOf(findFirst(prod, 'cProd')),
      descricao: textOf(findFirst(prod, 'xProd')),
      ncm: textOf(findFirst(prod, 'NCM')),
      quantidade: parseNumber(textOf(findFirst(prod, 'qCom'))),
      unidade: textOf(findFirst(prod, 'uCom')),
      valorUnitario: parseNumber(textOf(findFirst(prod, 'vUnCom'))),
      valorTotal: parseNumber(textOf(findFirst(prod, 'vProd'))),
    });
  }

  return {
    emitente: {
      razaoSocial: textOf(findFirst(emit, 'xNome')),
      nomeFantasia: textOf(findFirst(emit, 'xFant')),
      cnpj: textOf(findFirst(emit, 'CNPJ')),
      inscricaoEstadual: textOf(findFirst(emit, 'IE')),
      telefone: textOf(findFirst(enderEmit, 'fone')),
      email: textOf(findFirst(emit, 'email')),
      ...(enderEmit && {
        endereco: {
          logradouro: textOf(findFirst(enderEmit, 'xLgr')),
          numero: textOf(findFirst(enderEmit, 'nro')),
          bairro: textOf(findFirst(enderEmit, 'xBairro')),
          municipio: textOf(findFirst(enderEmit, 'xMun')),
          uf: textOf(findFirst(enderEmit, 'UF')),
          cep: textOf(findFirst(enderEmit, 'CEP')),
        },
      }),
    },
    nota: {
      numero: textOf(findFirst(ide, 'nNF')),
      serie: textOf(findFirst(ide, 'serie')),
      chaveAcesso,
      dataEmissao: parseIsoDate(textOf(findFirst(ide, 'dhEmi')) ?? textOf(findFirst(ide, 'dEmi'))),
      valorTotal: parseNumber(textOf(findFirst(icmsTot, 'vNF'))),
    },
    itens,
  };
}

/**
 * Conveniência: monta o endereço em string livre no formato "Logradouro, nº ·
 * Bairro · Município/UF · CEP 00000-000" — pronto pra colar no campo
 * `endereco` do Fornecedor (string única na Fase E).
 */
export function joinEndereco(
  end: DanfeExtractedData['emitente']['endereco'] | undefined,
): string | undefined {
  if (!end) return undefined;
  const parts: string[] = [];
  const lognum = [end.logradouro, end.numero].filter(Boolean).join(', ');
  if (lognum) parts.push(lognum);
  if (end.bairro) parts.push(end.bairro);
  const munUf = [end.municipio, end.uf].filter(Boolean).join('/');
  if (munUf) parts.push(munUf);
  if (end.cep) {
    const c = end.cep.replace(/\D/g, '');
    parts.push(c.length === 8 ? `CEP ${c.slice(0, 5)}-${c.slice(5)}` : `CEP ${end.cep}`);
  }
  return parts.length ? parts.join(' · ') : undefined;
}
