/**
 * ProdutoInsumo — catálogo de produtos de consumíveis rastreáveis.
 *
 * Separação Produto vs Lote (Fase C — 2026-04-21):
 *   - Produto: cadastrado uma vez por lab ("ABX Diluent da Horiba")
 *   - Lote (Insumo): cadastrado a cada caixa nova ("lote L2024-038, vence em…")
 *
 * Vantagens vs modelo anterior:
 *   - Reduz erro operacional (não redigita fabricante/nome comercial a cada lote)
 *   - Rastreabilidade limpa por produto ("todos os lotes do ABX Diluent usados")
 *   - Permite pre-populate catálogo com produtos conhecidos do equipamento
 *   - Alinha com o fluxo real de fabricante → produto → lote
 *
 * Firestore path: /labs/{labId}/produtos-insumos/{produtoId}
 */

import type { Timestamp } from 'firebase/firestore';
import type { InsumoTipo, InsumoModulo, InsumoNivel } from './Insumo';

export interface ProdutoInsumo {
  id: string;
  labId: string;

  /** Tipo do produto — herdado pelos lotes. Imutável após criação. */
  tipo: InsumoTipo;

  /**
   * Módulos em que o produto pode ser consumido. Um mesmo produto pode servir
   * múltiplos módulos (ex: controle multianalítico em Hemato + Bioquímica).
   */
  modulos: InsumoModulo[];

  fabricante: string;
  nomeComercial: string;

  /**
   * Código do produto no catálogo do fabricante (ex: "DIL-500ML"). Ajuda em
   * pedidos e rastreabilidade. Opcional.
   */
  codigoFabricante?: string;

  /** Registro ANVISA quando aplicável (RDC 786 art. 42). */
  registroAnvisa?: string;

  /**
   * Função técnica do produto — texto curto explicando o papel operacional.
   * Ex: "Diluição e condução elétrica das amostras para contagem celular".
   * Aparece na UI pra guiar o operador inexperiente.
   */
  funcaoTecnica?: string;

  /**
   * Equipamentos compatíveis — lista livre de modelos. Ex: ["Yumizen H550",
   * "Yumizen H750"]. Usado para sugestão contextual ao configurar o setup.
   */
  equipamentosCompativeis?: string[];

  /**
   * Estabilidade pós-abertura DEFAULT — cada lote pode sobrescrever. `0` ou
   * ausente significa "mesma validade fechada" (reagentes secos, kits
   * liofilizados típicos).
   */
  diasEstabilidadeAberturaDefault?: number;

  /**
   * Para produtos de controle: nível canônico do fabricante. Lote herda
   * por default; operador pode ajustar caso use lote especial.
   */
  nivelDefault?: InsumoNivel;

  /**
   * Flag interno — produtos criados via `seedCatalogo` para agilizar novos
   * labs ganham `isCatalogoPadrao=true`. UI pode destacar ou permitir
   * duplicação ("forkar catálogo oficial pro meu lab").
   */
  isCatalogoPadrao?: boolean;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Helper: constrói chave de deduplicação pra detectar produtos duplicados
 * na hora do cadastro. Normalização simples: lowercase + trim + remove
 * espaços duplicados. O service usa isso em queries pra alertar o operador.
 */
export function produtoDedupKey(fabricante: string, nomeComercial: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${norm(fabricante)}::${norm(nomeComercial)}`;
}
