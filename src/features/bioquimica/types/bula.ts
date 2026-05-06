/**
 * Bula types — result from Gemini parsing
 */

export interface BulaParseResult {
  niveis: Array<{
    level: '1' | '2' | '3';
    lotNumber?: string;
  }>;
  manufacturerStats: Record<
    string, // 'nivel1', 'nivel2', etc
    Record<
      string, // analito name
      {
        mean: number;
        sd: number;
      }
    >
  >;
  lote?: string;
  validade?: string;
  fornecedor?: string;
  confidence?: number;
}
