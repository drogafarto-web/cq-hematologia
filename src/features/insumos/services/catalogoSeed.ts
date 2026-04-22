/**
 * catalogoSeed — biblioteca de produtos conhecidos dos equipamentos suportados.
 *
 * Fase C (2026-04-21). Lab novo pode bootstrapar o catálogo clicando em
 * "Importar catálogo do [equipamento]" — evita digitar à mão os reagentes
 * de rotina. Cada entrada é um template idempotente: rerun safe (usa dedup
 * por fabricante+nomeComercial).
 *
 * Fontes:
 *   - Yumizen H550 manual do fabricante (Horiba Medical — ABX Diluent 2L,
 *     ABX Whitediff, ABX Cleaner 600mL).
 *   - Bio-Rad Lyphochek Hematology Control (multianalítico N1/N2/PATH).
 *   - Stago Neoplastine CI+ (tromboplastina padrão coag).
 *   - Wama Diagnóstica Uri-Check (tira 10 analitos — uroanálise BR).
 *
 * Não inclui números de lote — lote é instância física cadastrada à parte.
 */

import type { CreateProdutoPayload } from './produtoInsumoService';
import { createProduto } from './produtoInsumoService';

// ─── Template por equipamento ────────────────────────────────────────────────

export interface CatalogoTemplate {
  equipamento: string;
  descricao: string;
  produtos: Array<Omit<CreateProdutoPayload, 'createdBy'>>;
}

export const CATALOGO_TEMPLATES: Record<string, CatalogoTemplate> = {
  'yumizen-h550': {
    equipamento: 'Yumizen H550 (Horiba Medical)',
    descricao:
      'Analisador hematológico 5-diff com amostrador. Três reagentes ativos + controle multianalítico.',
    produtos: [
      {
        tipo: 'reagente',
        modulos: ['hematologia'],
        fabricante: 'Horiba',
        nomeComercial: 'ABX Diluent',
        codigoFabricante: 'ABX-DIL-2L',
        funcaoTecnica:
          'Diluição das amostras + condução elétrica para contagem celular por impedância',
        equipamentosCompativeis: ['Yumizen H550', 'Yumizen H750', 'ABX Micros'],
        diasEstabilidadeAberturaDefault: 60,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'reagente',
        modulos: ['hematologia'],
        fabricante: 'Horiba',
        nomeComercial: 'ABX Whitediff',
        codigoFabricante: 'ABX-WDF-1L',
        funcaoTecnica:
          'Lise seletiva de hemácias + diferenciação de 5 populações leucocitárias',
        equipamentosCompativeis: ['Yumizen H550', 'Yumizen H750'],
        diasEstabilidadeAberturaDefault: 30,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'reagente',
        modulos: ['hematologia'],
        fabricante: 'Horiba',
        nomeComercial: 'ABX Cleaner',
        codigoFabricante: 'ABX-CLN-600ML',
        funcaoTecnica: 'Limpeza enzimática do circuito hidráulico entre ciclos',
        equipamentosCompativeis: ['Yumizen H550', 'Yumizen H750', 'ABX Pentra'],
        diasEstabilidadeAberturaDefault: 90,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'controle',
        modulos: ['hematologia'],
        fabricante: 'Bio-Rad',
        nomeComercial: 'Lyphochek Hematology Control — Normal (N1)',
        codigoFabricante: 'LYHM-N1',
        funcaoTecnica:
          'Material de controle multianalítico — nível normal (referência adulto saudável)',
        equipamentosCompativeis: ['Yumizen H550', 'Yumizen H750', 'Sysmex', 'Coulter'],
        nivelDefault: 'normal',
        diasEstabilidadeAberturaDefault: 14,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'controle',
        modulos: ['hematologia'],
        fabricante: 'Bio-Rad',
        nomeComercial: 'Lyphochek Hematology Control — Baixo (L)',
        codigoFabricante: 'LYHM-L',
        funcaoTecnica:
          'Material de controle multianalítico — nível baixo (anemia/leucopenia simuladas)',
        equipamentosCompativeis: ['Yumizen H550', 'Yumizen H750', 'Sysmex', 'Coulter'],
        nivelDefault: 'baixo',
        diasEstabilidadeAberturaDefault: 14,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'controle',
        modulos: ['hematologia'],
        fabricante: 'Bio-Rad',
        nomeComercial: 'Lyphochek Hematology Control — Alto (H)',
        codigoFabricante: 'LYHM-H',
        funcaoTecnica:
          'Material de controle multianalítico — nível alto (leucocitose/eritrocitose)',
        equipamentosCompativeis: ['Yumizen H550', 'Yumizen H750', 'Sysmex', 'Coulter'],
        nivelDefault: 'alto',
        diasEstabilidadeAberturaDefault: 14,
        isCatalogoPadrao: true,
      },
    ],
  },

  'clotimer-duo': {
    equipamento: 'Clotimer Duo (Instrumentation Laboratory)',
    descricao: 'Coagulômetro óptico — AP/TP + TTPA + fibrinogênio.',
    produtos: [
      {
        tipo: 'reagente',
        modulos: ['coagulacao'],
        fabricante: 'Stago',
        nomeComercial: 'Neoplastine CI+',
        codigoFabricante: 'NEO-CI-PLUS',
        funcaoTecnica:
          'Tromboplastina recombinante para TP/INR — ISI declarado lote a lote',
        equipamentosCompativeis: ['Clotimer Duo', 'STA Compact', 'ACL TOP'],
        diasEstabilidadeAberturaDefault: 5,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'reagente',
        modulos: ['coagulacao'],
        fabricante: 'Instrumentation Laboratory',
        nomeComercial: 'HemosIL SynthASil',
        codigoFabricante: 'HMS-APTT',
        funcaoTecnica: 'Ativador APTT — partículas de sílica + fosfolipídios sintéticos',
        equipamentosCompativeis: ['Clotimer Duo', 'ACL TOP', 'ACL Elite Pro'],
        diasEstabilidadeAberturaDefault: 7,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'controle',
        modulos: ['coagulacao'],
        fabricante: 'Stago',
        nomeComercial: 'Coag Control N',
        codigoFabricante: 'COA-N',
        funcaoTecnica:
          'Plasma controle liofilizado — nível normal (doadores saudáveis pooled)',
        equipamentosCompativeis: ['Clotimer Duo', 'STA Compact'],
        nivelDefault: 'normal',
        diasEstabilidadeAberturaDefault: 1,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'controle',
        modulos: ['coagulacao'],
        fabricante: 'Stago',
        nomeComercial: 'Coag Control P',
        codigoFabricante: 'COA-P',
        funcaoTecnica:
          'Plasma controle liofilizado — nível patológico (pacientes anticoagulados)',
        equipamentosCompativeis: ['Clotimer Duo', 'STA Compact'],
        nivelDefault: 'patologico',
        diasEstabilidadeAberturaDefault: 1,
        isCatalogoPadrao: true,
      },
    ],
  },

  'uri-color': {
    equipamento: 'Uri Color Control (Wama Diagnóstica)',
    descricao:
      'Leitor semi-automático de tiras reagentes urinárias — 10 analitos + densidade/pH.',
    produtos: [
      {
        tipo: 'tira-uro',
        modulos: ['uroanalise'],
        fabricante: 'Wama Diagnóstica',
        nomeComercial: 'Uri-Check 10SG',
        codigoFabricante: 'URI-10SG',
        funcaoTecnica:
          'Tira reagente 10 analitos (GLU, BIL, CET, SG, pH, PRO, URO, NIT, LEU, HGB)',
        equipamentosCompativeis: ['Uri Color Control', 'Uri-Color Check'],
        diasEstabilidadeAberturaDefault: 90,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'controle',
        modulos: ['uroanalise'],
        fabricante: 'Bio-Rad',
        nomeComercial: 'Liquichek Urinalysis Control — Level 1',
        codigoFabricante: 'LQU-L1',
        funcaoTecnica: 'Controle urinário nível normal — amostra estabilizada',
        equipamentosCompativeis: ['Uri Color Control', 'Clinitek', 'Combilyzer'],
        nivelDefault: 'normal',
        diasEstabilidadeAberturaDefault: 30,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'controle',
        modulos: ['uroanalise'],
        fabricante: 'Bio-Rad',
        nomeComercial: 'Liquichek Urinalysis Control — Level 2',
        codigoFabricante: 'LQU-L2',
        funcaoTecnica: 'Controle urinário nível patológico — positivo p/ múltiplos analitos',
        equipamentosCompativeis: ['Uri Color Control', 'Clinitek', 'Combilyzer'],
        nivelDefault: 'patologico',
        diasEstabilidadeAberturaDefault: 30,
        isCatalogoPadrao: true,
      },
    ],
  },

  'imuno-strips': {
    equipamento: 'Strips de Imunoensaio (multi-fabricante)',
    descricao:
      'Imunocromatografia — sorológicos rápidos (HIV, HBsAg, HCV, Sífilis, Dengue etc).',
    produtos: [
      {
        tipo: 'reagente',
        modulos: ['imunologia'],
        fabricante: 'Eco Diagnóstica',
        nomeComercial: 'Teste Rápido HIV 1/2',
        codigoFabricante: 'ECO-HIV',
        funcaoTecnica: 'Imunocromatografia para anticorpos anti-HIV 1 e 2 em soro/plasma',
        equipamentosCompativeis: ['Strips manuais'],
        diasEstabilidadeAberturaDefault: 0, // usa selado em bolsa até o uso
        isCatalogoPadrao: true,
      },
      {
        tipo: 'reagente',
        modulos: ['imunologia'],
        fabricante: 'Eco Diagnóstica',
        nomeComercial: 'Teste Rápido HBsAg',
        codigoFabricante: 'ECO-HBS',
        funcaoTecnica: 'Imunocromatografia para antígeno de superfície do HBV',
        equipamentosCompativeis: ['Strips manuais'],
        diasEstabilidadeAberturaDefault: 0,
        isCatalogoPadrao: true,
      },
      {
        tipo: 'reagente',
        modulos: ['imunologia'],
        fabricante: 'Bioclin',
        nomeComercial: 'Dengue IgG/IgM + NS1',
        codigoFabricante: 'BIO-DEN',
        funcaoTecnica:
          'Imunocromatografia combinada — IgG/IgM anti-Dengue + antígeno NS1',
        equipamentosCompativeis: ['Strips manuais'],
        diasEstabilidadeAberturaDefault: 0,
        isCatalogoPadrao: true,
      },
    ],
  },
};

// ─── Importação em batch ─────────────────────────────────────────────────────

export interface SeedResult {
  totalTemplates: number;
  totalCriados: number;
  totalExistentes: number;
  erros: string[];
}

/**
 * Importa um template específico pro lab. Idempotente — duplicatas detectadas
 * (mesmo fabricante+nomeComercial) são contadas em `totalExistentes`.
 */
export async function importarTemplate(
  labId: string,
  templateKey: keyof typeof CATALOGO_TEMPLATES,
  createdBy: string,
): Promise<SeedResult> {
  const template = CATALOGO_TEMPLATES[templateKey];
  const result: SeedResult = {
    totalTemplates: template.produtos.length,
    totalCriados: 0,
    totalExistentes: 0,
    erros: [],
  };

  for (const produto of template.produtos) {
    try {
      const { wasDuplicate } = await createProduto(labId, {
        ...produto,
        createdBy,
      });
      if (wasDuplicate) result.totalExistentes += 1;
      else result.totalCriados += 1;
    } catch (err) {
      result.erros.push(
        `${produto.nomeComercial}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
