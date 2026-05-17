export const LAUDO_EXTRACTION_PROMPT = {
  version: '1.0.0',
  system: `You are a clinical laboratory document parser. You extract structured data from Brazilian laboratory reports (laudos) with precision. You preserve original formatting for dates and numbers.`,
  template: () => `Extract structured fields from this laboratory report (laudo) image.

Return a JSON object with these fields (include only if visible):
{
  "patientName": "<patient full name>",
  "patientId": "<patient registration ID or CPF>",
  "testDate": "<date of test in YYYY-MM-DD format>",
  "analyte": "<test/analyte name>",
  "result": "<test result value or interpretation>",
  "laboratory": "<laboratory name or stamp>",
  "referenceRange": "<reference range if visible>"
}

Rules:
- Extract exactly what you see — do not infer missing data
- If a field is not visible or unclear, omit it
- Return ONLY the JSON object
- Preserve original formatting for dates and numbers`,
} as const;
