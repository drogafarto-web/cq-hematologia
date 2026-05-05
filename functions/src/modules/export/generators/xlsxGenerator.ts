import * as XLSX from 'xlsx';

/**
 * Generate XLSX buffer from CIQ run data
 *
 * Phase 3.1: Single sheet with all runs
 * Phase 3.2: Multiple sheets (runs, NCs, equipment, operators)
 */
export async function generateXlsx(data: Record<string, any>[]): Promise<Buffer> {
  try {
    // 1. Flatten nested objects for Excel (max 50 columns)
    const flattened = data.map((run) => ({
      'ID': run.id,
      'Status': run.status,
      'Equipamento': run.equipmentId,
      'Operador': run.operatorId,
      'Resultado': run.resultado,
      'Data': run.criadoEm?.toDate?.() ?? run.criadoEm,
      'Assinado em': run.assinadorEm?.toDate?.() ?? run.assinadorEm,
      'Módulo': run.moduleName,
      // Add more fields as needed, but keep <50 columns for Excel compatibility
      ...Object.entries(run)
        .slice(0, 10) // Additional custom fields
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
    }));

    // 2. Create workbook and sheet
    const ws = XLSX.utils.json_to_sheet(flattened);

    // 3. Set column widths for readability
    const colWidths = [
      { wch: 15 }, // ID
      { wch: 12 }, // Status
      { wch: 15 }, // Equipamento
      { wch: 12 }, // Operador
      { wch: 15 }, // Resultado
      { wch: 20 }, // Data
      { wch: 20 }, // Assinado em
      { wch: 15 }, // Módulo
    ];
    ws['!cols'] = colWidths;

    // 4. Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Corridas CIQ');

    // 5. Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    console.log(`[Export] Generated XLSX: ${buffer.length} bytes, ${data.length} rows`);

    return buffer;
  } catch (error) {
    console.error('[Export] XLSX generation failed:', error);
    throw new Error(`Failed to generate XLSX: ${error}`);
  }
}

/**
 * Generate sample test data for Phase 3.1
 */
export function generateSampleData(count: number = 10): Record<string, any>[] {
  const statuses = ['valid', 'invalid', 'review'];
  const equipments = ['H550', 'ADVIA', 'COBAS'];

  return Array.from({ length: count }, (_, i) => ({
    id: `run-${i + 1}`,
    status: statuses[i % statuses.length],
    equipmentId: equipments[i % equipments.length],
    operatorId: `op-${(i % 3) + 1}`,
    resultado: 95 + Math.random() * 5,
    criadoEm: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    assinadorEm: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000),
    moduleName: 'CIQ Coagulação',
  }));
}
