/**
 * UroDomainMap.test.ts — Testes de integridade do mapa de domínio.
 *
 * Valida:
 *  1. Todos os campos reais do UroanaliseRun estão classificados
 *  2. Nenhum campo aparece em mais de um grupo
 *  3. Lookup por campo funciona corretamente
 *  4. Contagens por grupo estão corretas
 *  5. collapsedByDefault está configurado corretamente
 *  6. Campos virtuais (evidence) estão documentados
 */
import { describe, it, expect } from 'vitest';
import { URO_DOMAIN_MAP, URO_ALL_FIELDS, getFieldGroup, getGroupFields } from '../UroDomainMap';

// All 53 real (non-virtual) fields of UroanaliseRun
const REAL_FIELDS: string[] = [
  // CQRun inherited (17)
  'id',
  'operatorId',
  'operatorName',
  'operatorRole',
  'operatorDocument',
  'confirmedAt',
  'isEdited',
  'labId',
  'lotId',
  'equipmentId',
  'status',
  'version',
  'previousRunId',
  'logicalSignature',
  'createdAt',
  'createdBy',
  'imageUrl',
  // UroanaliseRun own (36 unique, equipamentoId already counted above)
  'runCode',
  'nivel',
  'frequencia',
  'aberturaTiraId',
  'aberturaControleId',
  'worklabIdTira',
  'worklabIdControle',
  'tiraMarca',
  'loteTira',
  'fabricanteTira',
  'validadeTira',
  'loteControle',
  'fabricanteControle',
  'aberturaControle',
  'validadeControle',
  'temperaturaAmbiente',
  'umidadeAmbiente',
  'dataRealizacao',
  'resultadosEsperados',
  'resultados',
  'conformidade',
  'analitosNaoConformes',
  'acaoCorretiva',
  'alertas',
  'notivisaTipo',
  'notivisaStatus',
  'notivisaProtocolo',
  'notivisaDataEnvio',
  'notivisaJustificativa',
  'responsavel',
  'insumosSnapshot',
  'insumoVencidoOverride',
  'qcNaoValidado',
  'overrideMotivo',
  'equipamentoSnapshot',
  'manual',
];

// Virtual fields (nested inside resultados.{analito})
const VIRTUAL_FIELDS: string[] = ['origemPorAnalito', 'ocrConfianca'];

// ─── Suíte 1: Cobertura total ─────────────────────────────────────────────────

describe('Cobertura total', () => {
  it.each(REAL_FIELDS)('campo real "%s" está classificado em URO_ALL_FIELDS', (field) => {
    expect(URO_ALL_FIELDS).toContain(field);
  });
});

// ─── Suíte 2: Sem duplicatas entre grupos ─────────────────────────────────────

describe('Sem duplicatas entre grupos', () => {
  it('nenhum campo aparece em mais de um grupo', () => {
    const allFields = Object.values(URO_DOMAIN_MAP).flatMap((g) => g.fields);
    const unique = new Set(allFields);
    expect(allFields.length).toBe(unique.size);
  });
});

// ─── Suíte 3: Lookup por campo ────────────────────────────────────────────────

describe('Lookup por campo', () => {
  it('getFieldGroup("nivel") → operation', () => {
    expect(getFieldGroup('nivel')).toBe('operation');
  });

  it('getFieldGroup("operatorId") → traceability', () => {
    expect(getFieldGroup('operatorId')).toBe('traceability');
  });

  it('getFieldGroup("imageUrl") → evidence', () => {
    expect(getFieldGroup('imageUrl')).toBe('evidence');
  });

  it('getFieldGroup("conformidade") → governance', () => {
    expect(getFieldGroup('conformidade')).toBe('governance');
  });

  it('getFieldGroup("id") → infrastructure', () => {
    expect(getFieldGroup('id')).toBe('infrastructure');
  });

  it('getFieldGroup("campoInexistente") → undefined', () => {
    expect(getFieldGroup('campoInexistente')).toBeUndefined();
  });
});

// ─── Suíte 4: Contagens por grupo ─────────────────────────────────────────────

describe('Contagens por grupo', () => {
  const expected: Record<string, number> = {
    operation: 8,
    traceability: 22,
    evidence: 3,
    governance: 16,
    infrastructure: 7,
  };

  it.each(Object.entries(expected))('grupo "%s" tem exatamente %i campos', (group, count) => {
    expect(URO_DOMAIN_MAP[group as keyof typeof URO_DOMAIN_MAP].fields.length).toBe(count);
  });
});

// ─── Suíte 5: collapsedByDefault ──────────────────────────────────────────────

describe('collapsedByDefault', () => {
  it('operation não é collapsado por padrão', () => {
    expect(URO_DOMAIN_MAP.operation.collapsedByDefault).toBe(false);
  });

  it.each(['traceability', 'evidence', 'governance', 'infrastructure'])(
    'grupo "%s" é collapsado por padrão',
    (group) => {
      expect(URO_DOMAIN_MAP[group as keyof typeof URO_DOMAIN_MAP].collapsedByDefault).toBe(true);
    },
  );
});

// ─── Suíte 6: Campos virtuais ─────────────────────────────────────────────────

describe('Campos virtuais', () => {
  it.each(VIRTUAL_FIELDS)('campo virtual "%s" está no grupo evidence', (field) => {
    expect(getFieldGroup(field)).toBe('evidence');
  });

  it('ambos os campos virtuais estão na lista URO_ALL_FIELDS', () => {
    for (const vf of VIRTUAL_FIELDS) {
      expect(URO_ALL_FIELDS).toContain(vf);
    }
  });
});

// ─── Suíte 7: Helpers ─────────────────────────────────────────────────────────

describe('Helpers', () => {
  describe('isFieldInGroup', () => {
    it('nivel está em operation', () => {
      expect(getFieldGroup('nivel')).toBe('operation');
    });

    it('nivel NÃO está em governance', () => {
      expect(getFieldGroup('nivel')).not.toBe('governance');
    });

    it('conformidade está em governance', () => {
      expect(getFieldGroup('conformidade')).toBe('governance');
    });

    it('campo inexistente pertence a grupo nenhum', () => {
      expect(getFieldGroup('fakeField')).toBeUndefined();
    });
  });

  describe('getGroupLabel', () => {
    it('label de operation é "Operação"', () => {
      expect(URO_DOMAIN_MAP.operation.label).toBe('Operação');
    });

    it('label de traceability é "Rastreabilidade"', () => {
      expect(URO_DOMAIN_MAP.traceability.label).toBe('Rastreabilidade');
    });

    it('label de evidence é "Evidências"', () => {
      expect(URO_DOMAIN_MAP.evidence.label).toBe('Evidências');
    });

    it('label de governance é "Governança"', () => {
      expect(URO_DOMAIN_MAP.governance.label).toBe('Governança');
    });

    it('label de infrastructure é "Infraestrutura"', () => {
      expect(URO_DOMAIN_MAP.infrastructure.label).toBe('Infraestrutura');
    });
  });

  describe('isGroupCollapsedByDefault', () => {
    it('operation → false', () => {
      expect(URO_DOMAIN_MAP.operation.collapsedByDefault).toBe(false);
    });

    it.each(['traceability', 'evidence', 'governance', 'infrastructure'] as const)(
      '%s → true',
      (group) => {
        expect(URO_DOMAIN_MAP[group].collapsedByDefault).toBe(true);
      },
    );
  });

  describe('getGroupFields', () => {
    it('operation retorna 8 fields', () => {
      expect(getGroupFields('operation').length).toBe(8);
    });

    it('infrastructure retorna 7 fields', () => {
      expect(getGroupFields('infrastructure').length).toBe(7);
    });
  });
});

// ─── Suíte 8: URO_ALL_FIELDS ──────────────────────────────────────────────────

describe('URO_ALL_FIELDS', () => {
  it('total de entries é 56 (54 reais + 2 virtuais)', () => {
    expect(URO_ALL_FIELDS.length).toBe(56);
  });
});
