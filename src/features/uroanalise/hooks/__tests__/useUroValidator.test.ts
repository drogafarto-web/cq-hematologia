import { describe, it, expect } from 'vitest';
import { validateUroResultado } from '../useUroValidator';

describe('validateUroResultado criteria validation', () => {
  it('should accept flexible positive values for Patologico (P) level', () => {
    // Glicose should accept any value from 1+ to 4+
    expect(validateUroResultado('glicose', '1+', 'P')).toBe(true);
    expect(validateUroResultado('glicose', '3+', 'P')).toBe(true);
    expect(validateUroResultado('glicose', '4+', 'P')).toBe(true);

    // Cetonas, Bilirrubina, Sangue, Leucocitos, Urobilinogenio should accept crosses and nominals
    const analytes = ['cetonas', 'bilirrubina', 'sangue', 'leucocitos', 'urobilinogenio'] as const;
    for (const analito of analytes) {
      expect(validateUroResultado(analito, '1+', 'P')).toBe(true);
      expect(validateUroResultado(analito, '3+', 'P')).toBe(true);
      expect(validateUroResultado(analito, '4+', 'P')).toBe(true);
      expect(validateUroResultado(analito, 'AUMENTADO', 'P')).toBe(true);
      expect(validateUroResultado(analito, 'PRESENTE', 'P')).toBe(true);
    }

    // Nitrito should validate as positive (PRESENTE)
    expect(validateUroResultado('nitrito', 'PRESENTE', 'P')).toBe(true);

    // Density must accept 1.015 - 1.030
    expect(validateUroResultado('densidade', 1.015, 'P')).toBe(true);
    expect(validateUroResultado('densidade', 1.02, 'P')).toBe(true);
    expect(validateUroResultado('densidade', 1.03, 'P')).toBe(true);

    // pH must accept 6.0 - 8.0
    expect(validateUroResultado('ph', 6.0, 'P')).toBe(true);
    expect(validateUroResultado('ph', 7.0, 'P')).toBe(true);
    expect(validateUroResultado('ph', 8.0, 'P')).toBe(true);
  });
});
