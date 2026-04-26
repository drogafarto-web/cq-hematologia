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
import type { QualificacaoMode } from './InsumoQualificacao';

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
   * PR1 (2026-04-26) — modo de qualificação aplicado a este produto.
   * Resolução padrão (`resolveQualificacaoMode`):
   *   - manual=true & modulo=imunologia      → 'corrida-validacao'
   *   - manual=false                          → 'caracterizacao-rt' (PR2)
   *   - controles multianalíticos (>1 equip.) → 'caracterizacao-rt' (PR2)
   *   - default                               → 'checklist-rt'
   *
   * Operador pode override manual no cadastro do produto (UI fora de escopo
   * no PR1 — por enquanto apenas preenchido programaticamente). Quando
   * ausente no doc, `resolveQualificacaoMode` deriva pela heurística acima.
   */
  qualificacaoMode?: QualificacaoMode;

  /**
   * PR1 — flag manual do produto (kit lido a olho vs. analisador).
   * Quando true e modulo=imunologia, define `qualificacaoMode='corrida-validacao'`
   * via `resolveQualificacaoMode`.
   */
  manual?: boolean;

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
 * PR1 (2026-04-26) — Resolve o modo de qualificação efetivo de um produto.
 *
 * Precedência:
 *   1. Campo explícito `qualificacaoMode` no doc (override manual do RT)
 *   2. Heurística por (manual × modulo × equipamentosCompativeis)
 *
 * Heurística:
 *   - manual=true & modulo='imunologia'         → 'corrida-validacao'
 *   - !manual                                    → 'caracterizacao-rt' (PR2)
 *   - controles multianalíticos (>1 equipamento) → 'caracterizacao-rt' (PR2)
 *   - default                                    → 'checklist-rt'
 *
 * Sem leitura de Firestore — função pura, segura para chamar em render.
 */
export function resolveQualificacaoMode(
  produto: Pick<ProdutoInsumo, 'qualificacaoMode' | 'manual' | 'modulos' | 'equipamentosCompativeis' | 'tipo'>,
): QualificacaoMode {
  if (produto.qualificacaoMode) return produto.qualificacaoMode;

  const inImuno = Array.isArray(produto.modulos) && produto.modulos.includes('imunologia');
  if (produto.manual === true && inImuno) return 'corrida-validacao';

  if (produto.manual === false) return 'caracterizacao-rt';

  const equipCount = produto.equipamentosCompativeis?.length ?? 0;
  if (produto.tipo === 'controle' && equipCount > 1) return 'caracterizacao-rt';

  return 'checklist-rt';
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
