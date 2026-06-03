/**
 * anvisaTestCodes.ts — ANVISA-registered laboratory test codes
 * Wave 3-10 — Reference database for exam code validation
 *
 * Note: This is a stub with ~50 common tests. Update as government provides
 * the official registry. Each code maps to: name, unit, method.
 *
 * Source: ANVISA laboratory test registry (placeholder)
 * Last updated: 2026-05-08
 */

export const anvisaTestCodes = {
  // ─── Hematology ───
  'HC-001': {
    name: 'Hemoglobin',
    unit: 'g/dL',
    method: 'Spectrophotometry',
  },
  'HC-002': {
    name: 'Hematocrit',
    unit: '%',
    method: 'Automated cell counter',
  },
  'HC-003': {
    name: 'Red Blood Cell Count',
    unit: '×10⁶/μL',
    method: 'Automated cell counter',
  },
  'HC-004': {
    name: 'White Blood Cell Count',
    unit: '×10³/μL',
    method: 'Automated cell counter',
  },
  'HC-005': {
    name: 'Platelet Count',
    unit: '×10³/μL',
    method: 'Automated cell counter',
  },
  'HC-006': {
    name: 'MCV (Mean Corpuscular Volume)',
    unit: 'fL',
    method: 'Automated cell counter',
  },
  'HC-007': {
    name: 'MCH (Mean Corpuscular Hemoglobin)',
    unit: 'pg',
    method: 'Automated cell counter',
  },
  'HC-008': {
    name: 'MCHC (Mean Corpuscular Hemoglobin Concentration)',
    unit: 'g/dL',
    method: 'Automated cell counter',
  },
  'HC-009': {
    name: 'WBC Differential - Neutrophils',
    unit: '%',
    method: 'Automated differential',
  },
  'HC-010': {
    name: 'WBC Differential - Lymphocytes',
    unit: '%',
    method: 'Automated differential',
  },

  // ─── Clinical Chemistry ───
  'CC-001': {
    name: 'Glucose (Fasting)',
    unit: 'mg/dL',
    method: 'Enzymatic',
  },
  'CC-002': {
    name: 'Total Cholesterol',
    unit: 'mg/dL',
    method: 'Enzymatic',
  },
  'CC-003': {
    name: 'HDL Cholesterol',
    unit: 'mg/dL',
    method: 'Enzymatic',
  },
  'CC-004': {
    name: 'LDL Cholesterol',
    unit: 'mg/dL',
    method: 'Calculated',
  },
  'CC-005': {
    name: 'Triglycerides',
    unit: 'mg/dL',
    method: 'Enzymatic',
  },
  'CC-006': {
    name: 'Total Protein',
    unit: 'g/dL',
    method: 'Biuret',
  },
  'CC-007': {
    name: 'Albumin',
    unit: 'g/dL',
    method: 'Dye-binding',
  },
  'CC-008': {
    name: 'Globulin',
    unit: 'g/dL',
    method: 'Calculated',
  },
  'CC-009': {
    name: 'AST (Aspartate Aminotransferase)',
    unit: 'U/L',
    method: 'Enzymatic',
  },
  'CC-010': {
    name: 'ALT (Alanine Aminotransferase)',
    unit: 'U/L',
    method: 'Enzymatic',
  },

  // ─── Coagulation ───
  'CO-001': {
    name: 'PT (Prothrombin Time)',
    unit: 's',
    method: 'Clotting assay',
  },
  'CO-002': {
    name: 'INR (International Normalized Ratio)',
    unit: 'ratio',
    method: 'Calculated',
  },
  'CO-003': {
    name: 'aPTT (Activated Partial Thromboplastin Time)',
    unit: 's',
    method: 'Clotting assay',
  },
  'CO-004': {
    name: 'Fibrinogen',
    unit: 'mg/dL',
    method: 'Clotting assay',
  },
  'CO-005': {
    name: 'Thrombin Time',
    unit: 's',
    method: 'Clotting assay',
  },

  // ─── Immunology ───
  'IM-001': {
    name: 'HIV Antibody (Anti-HIV)',
    unit: 'Qualitative',
    method: 'ELISA / Rapid',
  },
  'IM-002': {
    name: 'Hepatitis B Surface Antigen (HBsAg)',
    unit: 'Qualitative',
    method: 'ELISA',
  },
  'IM-003': {
    name: 'Hepatitis B Core Antibody (Anti-HBc)',
    unit: 'Qualitative',
    method: 'ELISA',
  },
  'IM-004': {
    name: 'Hepatitis C Antibody (Anti-HCV)',
    unit: 'Qualitative',
    method: 'ELISA',
  },
  'IM-005': {
    name: 'Syphilis RPR/VDRL',
    unit: 'Titer',
    method: 'Rapid plasma reagin',
  },
  'IM-006': {
    name: 'Syphilis FTA-ABS',
    unit: 'Qualitative',
    method: 'Fluorescent antibody',
  },
  'IM-007': {
    name: 'COVID-19 Antigen',
    unit: 'Qualitative',
    method: 'Rapid antigen',
  },
  'IM-008': {
    name: 'COVID-19 IgM/IgG Antibody',
    unit: 'Qualitative/Quantitative',
    method: 'ELISA',
  },
  'IM-009': {
    name: 'Dengue Antibody (IgM/IgG)',
    unit: 'Qualitative',
    method: 'ELISA',
  },
  'IM-010': {
    name: 'Dengue Antigen (NS1)',
    unit: 'Qualitative',
    method: 'ELISA',
  },

  // ─── Urinalysis ───
  'UR-001': {
    name: 'Urinalysis - Color',
    unit: 'Qualitative',
    method: 'Visual/Automated',
  },
  'UR-002': {
    name: 'Urinalysis - Clarity',
    unit: 'Qualitative',
    method: 'Visual/Automated',
  },
  'UR-003': {
    name: 'Urinalysis - Glucose',
    unit: 'mg/dL',
    method: 'Dipstick',
  },
  'UR-004': {
    name: 'Urinalysis - Protein',
    unit: 'mg/dL',
    method: 'Dipstick',
  },
  'UR-005': {
    name: 'Urinalysis - Leukocytes',
    unit: 'Qualitative',
    method: 'Dipstick',
  },
  'UR-006': {
    name: 'Urinalysis - Nitrites',
    unit: 'Qualitative',
    method: 'Dipstick',
  },
  'UR-007': {
    name: 'Urinalysis - pH',
    unit: 'value',
    method: 'Dipstick',
  },
  'UR-008': {
    name: 'Urinalysis - RBC',
    unit: '/hpf',
    method: 'Microscopy',
  },
  'UR-009': {
    name: 'Urinalysis - WBC',
    unit: '/hpf',
    method: 'Microscopy',
  },
  'UR-010': {
    name: 'Urinalysis - Casts',
    unit: '/lpf',
    method: 'Microscopy',
  },

  // ─── Endocrinology ───
  'EN-001': {
    name: 'TSH (Thyroid Stimulating Hormone)',
    unit: 'mIU/L',
    method: 'Immunoassay',
  },
  'EN-002': {
    name: 'Free T4 (Thyroxine)',
    unit: 'ng/dL',
    method: 'Immunoassay',
  },
  'EN-003': {
    name: 'Total T4',
    unit: 'μg/dL',
    method: 'Immunoassay',
  },
  'EN-004': {
    name: 'Free T3',
    unit: 'pg/mL',
    method: 'Immunoassay',
  },
  'EN-005': {
    name: 'Cortisol (Morning)',
    unit: 'μg/dL',
    method: 'Immunoassay',
  },

  // ─── Biochemistry (Additional) ───
  'BIO-001': {
    name: 'Creatinine',
    unit: 'mg/dL',
    method: 'Enzymatic',
  },
  'BIO-002': {
    name: 'Urea (BUN)',
    unit: 'mg/dL',
    method: 'Enzymatic',
  },
  'BIO-003': {
    name: 'Sodium',
    unit: 'mEq/L',
    method: 'Ion-selective electrode',
  },
  'BIO-004': {
    name: 'Potassium',
    unit: 'mEq/L',
    method: 'Ion-selective electrode',
  },
  'BIO-005': {
    name: 'Chloride',
    unit: 'mEq/L',
    method: 'Ion-selective electrode',
  },
  'BIO-006': {
    name: 'Calcium',
    unit: 'mg/dL',
    method: 'Colorimetric',
  },
  'BIO-007': {
    name: 'Phosphorus',
    unit: 'mg/dL',
    method: 'Colorimetric',
  },
  'BIO-008': {
    name: 'Magnesium',
    unit: 'mg/dL',
    method: 'Colorimetric',
  },
  'BIO-009': {
    name: 'Iron',
    unit: 'μg/dL',
    method: 'Colorimetric',
  },
  'BIO-010': {
    name: 'TIBC (Total Iron Binding Capacity)',
    unit: 'μg/dL',
    method: 'Calculated',
  },
};

/**
 * Helper: Check if exam code is registered
 */
export function isRegisteredExamCode(code: string): boolean {
  return code in anvisaTestCodes;
}

/**
 * Helper: Get exam details
 */
export function getExamDetails(code: string) {
  return anvisaTestCodes[code as keyof typeof anvisaTestCodes];
}

/**
 * Helper: List all registered codes
 */
export function listRegisteredExamCodes(): string[] {
  return Object.keys(anvisaTestCodes);
}
