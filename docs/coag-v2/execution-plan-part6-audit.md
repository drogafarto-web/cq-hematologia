# Parte 6 — Estratégia de Auditoria Automática

---

## 6.1 Pipeline de Auditoria por Onda

```
[Executor produz código]
        │
        ▼
[Auditor: Validação de Contrato]
        │
        ├── Contrato violado? → REJEITA (volta ao Executor)
        │
        ▼
[Anti-Complexity: Métricas]
        │
        ├── Métrica excedida? → REJEITA (volta ao Executor)
        │
        ▼
[Testes]
        │
        ├── Teste falha? → REJEITA (volta ao Executor)
        │
        ▼
[Integração cross-módulo]
        │
        ├── Outro módulo quebrou? → REJEITA (volta ao Executor)
        │
        ▼
[Arquiteto: Sign-off]
        │
        └── APROVADO ✅
```

---

## 6.2 Relatório de Auditoria (template)

### Para cada output do Executor, o Auditor gera:

```markdown
# Relatório de Auditoria — Wave [X] / Task [Y]

**Data:** YYYY-MM-DD
**Arquivo(s) auditado(s):**

- `path/to/file1.ts` (142 linhas)
- `path/to/file2.ts` (89 linhas)

## 1. Validação de Contrato

### Entidades detectadas

| Entidade           | No contrato? | Status        |
| ------------------ | ------------ | ------------- |
| ControlOperacional | ✅           | OK            |
| Attempt            | ✅           | OK            |
| ExtraEntity        | ❌           | **REJEITADO** |

### Campos detectados

| Entidade | Campos         | No contrato? | Status        |
| -------- | -------------- | ------------ | ------------- |
| Attempt  | resultados     | ✅           | OK            |
| Attempt  | timestampExtra | ❌           | **REJEITADO** |

### Eventos detectados

| Evento         | No contrato? | Status        |
| -------------- | ------------ | ------------- |
| attempt.criado | ✅           | OK            |
| custom.event   | ❌           | **REJEITADO** |

## 2. Métricas de Complexidade

| Métrica           | Alvo  | Valor   | Status |
| ----------------- | ----- | ------- | ------ |
| Linhas totais     | ≤ 500 | 312     | ✅     |
| Maior hook        | ≤ 200 | 145     | ✅     |
| Maior componente  | ≤ 300 | 0 (N/A) | ✅     |
| Ciclomática máx   | ≤ 8   | 4       | ✅     |
| Profundidade máx  | ≤ 3   | 2       | ✅     |
| useState por hook | ≤ 2   | 2       | ✅     |
| Comentários (%)   | ≤ 30% | 12%     | ✅     |

## 3. Anti-Patterns Detectados

| Pattern                   | Status             |
| ------------------------- | ------------------ |
| Repository pattern        | ✅ Não encontrado  |
| Factory function          | ✅ Não encontrado  |
| Wrapper sem valor         | ✅ Não encontrado  |
| Console.log               | ✅ Não encontrado  |
| `any` type                | ✅ Não encontrado  |
| Estado redundante         | ✅ Não encontrado  |
| Hook gigante (>8 exports) | ✅ Não encontrado  |
| Terms proibidos (UI)      | ✅ Não encontrados |

## 4. Imports e Dependências

| Import                                   | Permitido? | Status        |
| ---------------------------------------- | ---------- | ------------- |
| `firebase/firestore`                     | ✅         | OK            |
| `react`                                  | ✅         | OK            |
| `../../coagulacao/hooks/useCoagWestgard` | ✅         | OK            |
| `../../hematologia/services/xxx`         | ❌         | **REJEITADO** |

## 5. Testes

| Teste                       | Status         |
| --------------------------- | -------------- |
| `createAttempt` happy path  | ✅ Pass        |
| `createAttempt` error path  | ✅ Pass        |
| `computeWestgard` integrado | ⚠️ Não escrito |

## 6. Cross-Module Impact

| Módulo          | Afetado? | Status |
| --------------- | -------- | ------ |
| Hematologia     | ❌       | OK     |
| Uroanálise      | ❌       | OK     |
| Imunologia      | ❌       | OK     |
| Insumos (spine) | ❌       | OK     |

## 7. Conclusão

**STATUS:** ✅ APROVADO / ❌ REJEITADO / ⚠️ APROVADO COM PENDÊNCIAS

**Pendências (se houver):**

- Escrever teste de `computeWestgard` integrado

**Ação:**

- Integrador pode prosseguir com merge após resolver pendência
```

---

## 6.3 Script de Auditoria Automática

### `scripts/audit-coag-v2.sh`

```bash
#!/bin/bash
# Auditoria automática da wave Coagulação v2
# Uso: ./scripts/audit-coag-v2.sh [wave-a|wave-b|wave-c|wave-d|wave-e|wave-f|wave-g]

set -e

WAVE=${1:-all}
BASE="src/features/coagulacao-v2"
FAILED=0

echo "╔══════════════════════════════════════════════════╗"
echo "║  AUDITORIA AUTOMÁTICA — COAGULAÇÃO v2          ║"
echo "║  Wave: $WAVE                                  "
echo "╚══════════════════════════════════════════════════╝"

# ── R1: Entidades = 3 ────────────────────────────────────────
echo ""
echo "── R1: Entidades = 3 ──"
ENTITIES=$(find "$BASE/types" -name "*.ts" ! -name "index.ts" ! -name "*.test.ts" | wc -l | tr -d ' ')
if [ "$ENTITIES" -eq 3 ]; then
  echo "✅ R1: $ENTITIES entidades"
else
  echo "❌ R1: $ENTITIES entidades (esperado 3)"
  FAILED=1
fi

# ── R3: Campos operacionais ≤ 6 ─────────────────────────────
echo ""
echo "── R3: Campos em AttemptForm ──"
ATTEMPT_FORM="$BASE/components/AttemptForm.tsx"
if [ -f "$ATTEMPT_FORM" ]; then
  FIELDS=$(grep -c "name=" "$ATTEMPT_FORM" || echo 0)
  if [ "$FIELDS" -le 6 ]; then
    echo "✅ R3: $FIELDS campos expostos"
  else
    echo "❌ R3: $FIELDS campos expostos (esperado ≤6)"
    FAILED=1
  fi
else
  echo "⚠️  R3: AttemptForm.tsx não encontrado (OK se não é wave D)"
fi

# ── R4: Termos técnicos proibidos ───────────────────────────
echo ""
echo "── R4: Termos proibidos em UI ──"
TERMS="(corrida|Corrida|Run |run |lote|Lote|workflow|Workflow|Status:|status:)"
BAD=$(grep -rE "$TERMS" "$BASE/components/" --include="*.tsx" -l | grep -v ".test." || true)
if [ -z "$BAD" ]; then
  echo "✅ R4: Sem termos proibidos"
else
  echo "❌ R4: Termos proibidos em: $BAD"
  FAILED=1
fi

# ── G1: Tamanho de arquivos ─────────────────────────────────
echo ""
echo "── G1: Tamanho de arquivos ──"
MAX_SERVICE=200
MAX_HOOK=200
MAX_COMPONENT=300

check_size() {
  local dir=$1 max=$2 label=$3
  local worst=""
  local worst_size=0
  for f in "$dir"/*.ts "$dir"/*.tsx; do
    [ -f "$f" ] || continue
    [[ "$f" == *".test."* ]] && continue
    LINES=$(wc -l < "$f" | tr -d ' ')
    if [ "$LINES" -gt "$worst_size" ]; then
      worst_size=$LINES
      worst=$f
    fi
  done
  if [ -n "$worst" ] && [ "$worst_size" -gt "$max" ]; then
    echo "❌ G1 ($label): $worst tem $worst_size linhas (máx $max)"
    FAILED=1
  elif [ -n "$worst" ]; then
    echo "✅ G1 ($label): maior arquivo $worst ($worst_size linhas)"
  fi
}

check_size "$BASE/services" "$MAX_SERVICE" "services"
check_size "$BASE/hooks" "$MAX_HOOK" "hooks"
check_size "$BASE/components" "$MAX_COMPONENT" "components"

# ── G5: Abstração proibida ──────────────────────────────────
echo ""
echo "── G5: Patterns proibidos ──"
PATTERNS="(Repository|Factory|Adapter|Decorator|Wrapper|createService|createManager)"
PATTERN_FOUND=$(grep -rE "$PATTERNS" "$BASE/" --include="*.ts" --include="*.tsx" -l | grep -v ".test." || true)
if [ -z "$PATTERN_FOUND" ]; then
  echo "✅ G5: Sem patterns proibidos"
else
  echo "❌ G5: Patterns encontrados em: $PATTERN_FOUND"
  FAILED=1
fi

# ── G7: console.log / debugger ──────────────────────────────
echo ""
echo "── G7: console.log / debugger ──"
LOGS=$(grep -rE "console\.(log|debug|warn)|debugger" "$BASE/" --include="*.ts" --include="*.tsx" -l | grep -v ".test." || true)
if [ -z "$LOGS" ]; then
  echo "✅ G7: Sem console.log/debugger"
else
  echo "❌ G7: Encontrado em: $LOGS"
  FAILED=1
fi

# ── G8: `any` type ──────────────────────────────────────────
echo ""
echo "── G8: `any` type ──"
ANYS=$(grep -rE ":\s*any\b|<any>|as any" "$BASE/" --include="*.ts" --include="*.tsx" -l | grep -v ".test." || true)
if [ -z "$ANYS" ]; then
  echo "✅ G8: Sem `any`"
else
  echo "❌ G8: `any` encontrado em: $ANYS"
  FAILED=1
fi

# ── Testes ──────────────────────────────────────────────────
echo ""
echo "── Testes ──"
TEST_COUNT=$(find "$BASE" -name "*.test.ts" -o -name "*.test.tsx" | wc -l | tr -d ' ')
echo "ℹ️  Testes encontrados: $TEST_COUNT"

# ── Cross-module ────────────────────────────────────────────
echo ""
echo "── Cross-module impact ──"
CROSS=$(grep -rE "src/features/(hematologia|uroanalise|imunologia)" "$BASE/" --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "import type" || true)
if [ -z "$CROSS" ]; then
  echo "✅ Cross-module: Sem imports de services de outros módulos"
else
  echo "❌ Cross-module: Imports indevidos detectados:"
  echo "$CROSS"
  FAILED=1
fi

# ── Conclusão ───────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo "✅ AUDITORIA APROVADA"
  exit 0
else
  echo "❌ AUDITORIA REJEITADA (ver falhas acima)"
  exit 1
fi
```

---

## 6.4 Integração com CI

### GitHub Action (se aplicável):

```yaml
name: Coag v2 Audit

on:
  pull_request:
    paths:
      - 'src/features/coagulacao-v2/**'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run architectural audit
        run: |
          chmod +x scripts/audit-coag-v2.sh
          ./scripts/audit-coag-v2.sh ${{ github.event.pull_request.head.ref }}

      - name: Run vitest
        run: npx vitest run src/features/coagulacao-v2/

      - name: Type check
        run: npx tsc --noEmit --project tsconfig.json | grep coagulacao-v2
```

---

## 6.5 Auditoria por Tipo de Mudança

### 6.5.1 Nova função

- [ ] Segue padrão dos services existentes?
- [ ] Nome descritivo (sem verbosidade)?
- [ ] Parâmetros ≤ 3?
- [ ] Retorno tipado explicitamente?
- [ ] Sem `any`?

### 6.5.2 Novo hook

- [ ] Máximo 200 linhas?
- [ ] Máximo 2 useState?
- [ ] Cleanup corretamente em useEffect?
- [ ] Não duplica lógica de hook existente?

### 6.5.3 Novo componente

- [ ] Segue wireframe textual?
- [ ] Máximo 300 linhas?
- [ ] Máximo 2 useState?
- [ ] Sem lógica de negócio (no hook, não no componente)?
- [ ] Labels sem termos técnicos?

### 6.5.4 Modificação de arquivo existente

- [ ] Escopo limitado ao especificado no wave?
- [ ] Não "melhorou" código fora do escopo?
- [ ] Não reorganizou imports sem necessidade?
- [ ] Não removeu comentários regulatórios?
