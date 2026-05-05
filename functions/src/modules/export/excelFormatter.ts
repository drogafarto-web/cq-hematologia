/**
 * Excel Conditional Formatting — SheetJS Community Edition
 *
 * SheetJS Pro supports `!cflrules` for native conditional formatting.
 * SheetJS Community does NOT support `!cflrules`.
 *
 * Workaround: iterate over cells post-generation and set `s` (style) on each
 * cell individually based on the 'status' column value.
 *
 * IMPORTANT: The `cellStyles: true` option must be passed to `XLSX.write()` for
 * styles to be embedded in the output. Without it, styles are silently dropped.
 *
 * LibreOffice limitation: SheetJS Community cell styles are rendered by
 * Microsoft Excel 365 / Google Sheets but NOT by LibreOffice Calc.
 * LibreOffice does not support the OOXML `xf`/`fill` extension that SheetJS
 * uses for custom cell styles in Community builds. Files open correctly but
 * appear without fill colors in LibreOffice.
 */

import * as XLSX from 'xlsx';

// ── Cell style type ────────────────────────────────────────────────────────────
// XLSX Community types don't export CellStyle — define inline.
interface XlsxCellStyle {
  fill?: { patternType?: string; fgColor?: { rgb?: string } };
  font?: { color?: { rgb?: string }; bold?: boolean };
}

// ── Style constants ────────────────────────────────────────────────────────────

/** Red fill for CIQ runs with status === 'invalid' (out-of-range) */
export const OUT_OF_RANGE_STYLE: XlsxCellStyle = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFEF4444' } },
  font: { color: { rgb: 'FFFFFFFF' }, bold: true },
};

/** Amber fill for CIQ runs with status === 'pending' */
export const PENDING_STYLE: XlsxCellStyle = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFF59E0B' } },
  font: { color: { rgb: 'FF000000' } },
};

/** Emerald fill for CIQ runs with valid/passing status */
export const VALID_STYLE: XlsxCellStyle = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FF10B981' } },
  font: { color: { rgb: 'FFFFFFFF' } },
};

/**
 * Returns the style object for an 'invalid' (out-of-range) CIQ row.
 * Exported for testing and documentation purposes.
 */
export function getCIQOutOfRangeStyle(): XlsxCellStyle {
  return OUT_OF_RANGE_STYLE;
}

/**
 * Applies conditional row-level formatting to a CIQ worksheet.
 *
 * For each data row, reads the value in the status column and applies:
 *   - 'invalid'   → red fill + white bold font (OUT_OF_RANGE_STYLE)
 *   - 'pending'   → amber fill + dark font (PENDING_STYLE)
 *   - anything else → emerald fill + white font (VALID_STYLE)
 *
 * The style is applied to ALL cells in each row (not just the status column)
 * so the entire row is highlighted uniformly.
 *
 * MUST call `XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellStyles: true })`
 * after this function for styles to be embedded.
 *
 * @param ws             - The SheetJS WorkSheet to modify in place
 * @param statusColIndex - 0-based column index of the 'status' field
 * @param headerRowCount - Number of header rows to skip (default: 1)
 * @returns The modified worksheet (same reference, mutated in place)
 */
export function applyConditionalFormatting(
  ws: XLSX.WorkSheet,
  statusColIndex: number,
  headerRowCount = 1,
): XLSX.WorkSheet {
  const ref = ws['!ref'];
  if (!ref) return ws;

  const range = XLSX.utils.decode_range(ref);

  for (let R = headerRowCount; R <= range.e.r; R++) {
    const statusCellAddr = XLSX.utils.encode_cell({ r: R, c: statusColIndex });
    const statusCell = ws[statusCellAddr] as XLSX.CellObject | undefined;

    if (!statusCell) continue;

    const status = String(statusCell.v ?? '').toLowerCase();
    const style: XlsxCellStyle =
      status === 'invalid' ? OUT_OF_RANGE_STYLE
      : status === 'pending' ? PENDING_STYLE
      : VALID_STYLE;

    // Apply to all cells in this row
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) {
        ws[cellAddr] = { t: 's', v: '' } as XLSX.CellObject;
      }
      (ws[cellAddr] as XLSX.CellObject & { s: XlsxCellStyle }).s = style;
    }
  }

  return ws;
}
