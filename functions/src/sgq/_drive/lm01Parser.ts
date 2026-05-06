/**
 * functions/src/sgq/_drive/lm01Parser.ts
 *
 * Parse Google Sheets LM-01 (Lista Mestra) to extract document metadata:
 * - 15 document types (MQ, PQ, IT, FR, POL, DC, LM, EXT, ITA, ITE, CCE, etc.)
 * - 17 sectors (setores Riopomba)
 * - Hierarchical parent references (MQ → PQ → IT → FR)
 *
 * LM-01 structure expected:
 * Columns: código | tipo | título | versão | setores (pipe-separated) | parent | observações
 */

import { z } from 'zod';

// Document types — extended from Phase 12-01 schema
export const TipoDocumento = z.enum([
  'MQ', // Manual da Qualidade
  'PQ', // Procedimento da Qualidade
  'IT', // Instrução de Trabalho
  'ITA', // IT — Análise
  'ITE', // IT — Coleta
  'CCE', // IT — Controle de Qualidade Externo
  'FR', // Formulário / Registro
  'POL', // Política
  'DC', // Descrição de Cargos
  'LM', // Lista Mestra
  'EXT', // Documento Externo
  'INF', // Informativo
  'CER', // Certificado
  'REL', // Relatório
  'ATA', // Ata de Reunião
]);

// 17 sectors at Riopomba
export const Setores = z.enum([
  'ATENDIMENTO',
  'COLETA',
  'HEMATOLOGIA',
  'HEMOSTASIA',
  'IMUNOLOGIA',
  'BIOQUIMICA',
  'UROANALISE',
  'ROTINAS',
  'LABORATORIO',
  'CONTROLE_QUALIDADE',
  'QUALIDADE',
  'DIRETORIA',
  'VENDAS',
  'ADMINISTRATIVO',
  'FINANCEIRO',
  'ALMOXARIFADO',
  'LOGISTICA',
]);

export type TipoDocumentoType = z.infer<typeof TipoDocumento>;
export type SetorType = z.infer<typeof Setores>;

export interface LM01Entry {
  codigo: string;
  tipo: TipoDocumentoType;
  titulo: string;
  versao: number;
  setores: SetorType[];
  parent?: string; // Parent document código (ex: "MQ-001" for a PQ)
  observacoes?: string;
}

const LM01EntrySchema = z.object({
  codigo: z.string().regex(/^[A-Z]+-\d{3}$/),
  tipo: TipoDocumento,
  titulo: z.string().min(3),
  versao: z.number().int().positive(),
  setores: z.array(Setores),
  parent: z.string().optional(),
  observacoes: z.string().optional(),
});

export type ParsedLM01 = z.infer<typeof LM01EntrySchema>;

/**
 * Parse Google Sheets LM-01 values into structured entries
 * Expects: each row = [código, tipo, título, versão, setores (pipe-separated), parent, observações]
 */
export async function parseLM01Sheet(
  sheetValues: string[][],
): Promise<LM01Entry[]> {
  const entries: LM01Entry[] = [];
  const errors: string[] = [];

  // Skip header row (index 0)
  for (let i = 1; i < sheetValues.length; i++) {
    const row = sheetValues[i];

    if (!row || row.length < 4) {
      errors.push(`Row ${i + 1}: insufficient columns`);
      continue;
    }

    const [codigo, tipoStr, titulo, versaoStr, setoresStr, parent, observacoes] =
      row;

    try {
      // Parse and validate
      const tipo = TipoDocumento.parse(tipoStr.trim());
      const versao = Number.parseInt(versaoStr, 10);
      const setores = (setoresStr || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Setores.parse(s));

      const entry = LM01EntrySchema.parse({
        codigo: codigo.trim(),
        tipo,
        titulo: titulo.trim(),
        versao,
        setores,
        parent: parent?.trim(),
        observacoes: observacoes?.trim(),
      });

      entries.push(entry);
    } catch (error) {
      const err = error instanceof z.ZodError ? error.issues[0]?.message : String(error);
      errors.push(`Row ${i + 1} (${codigo}): ${err}`);
    }
  }

  if (errors.length > 0) {
    console.warn(`LM-01 parse warnings: ${errors.join('; ')}`);
  }

  return entries;
}

/**
 * Parse setores from pipe-separated string
 */
export function parseSetores(setoresStr: string): SetorType[] {
  return setoresStr
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return Setores.parse(s);
      } catch {
        console.warn(`Invalid setor: ${s}`);
        return null;
      }
    })
    .filter(Boolean) as SetorType[];
}

/**
 * Validate LM-01 consistency:
 * - All codigos unique
 * - Parent references exist
 * - Versão ≥ 1
 */
export function validateLM01Consistency(entries: LM01Entry[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const codigos = new Set<string>();

  for (const entry of entries) {
    if (codigos.has(entry.codigo)) {
      errors.push(`Duplicate codigo: ${entry.codigo}`);
    }
    codigos.add(entry.codigo);

    if (entry.versao < 1) {
      errors.push(`${entry.codigo}: versão deve ser ≥ 1`);
    }

    if (entry.parent && !codigos.has(entry.parent)) {
      errors.push(`${entry.codigo}: parent ${entry.parent} não encontrado`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
