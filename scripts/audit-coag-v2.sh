#!/bin/bash
# audit-coag-v2.sh — Auditoria arquitetural do módulo Coagulação v2
# Usage: bash scripts/audit-coag-v2.sh [wave-name]
# Example: bash scripts/audit-coag-v2.sh wave-a

set -e

WAVE=${1:-all}
BASE="src/features/coagulacao-v2"

echo "=========================================="
echo "HC Quality — Auditoria Coagulação v2"
echo "=========================================="
echo "Wave: ${WAVE}"
echo

PASS=0
FAIL=0
WARN=0

check() {
  local name=$1
  local cmd=$2
  if eval "$cmd" 2>/dev/null; then
    echo "  ✓ ${name}"
    ((PASS++))
  else
    echo "  ✗ ${name}"
    ((FAIL++))
  fi
}

warn() {
  local name=$1
  local msg=$2
  echo "  ⚠ ${name}: ${msg}"
  ((WARN++))
}

echo "--- Verificações Estruturais ---"

check "Diretório types existe" "test -d ${BASE}/types"
check "Diretório services existe" "test -d ${BASE}/services"
check "Diretório hooks existe" "test -d ${BASE}/hooks"
check "Diretório components existe" "test -d ${BASE}/components"
check "Diretório __tests__ existe" "test -d ${BASE}/__tests__"

echo
echo "--- Contagem de Entidades ---"

ENTITY_COUNT=$(grep -rl 'export interface' ${BASE}/types/ 2>/dev/null | wc -l)
if [ "$ENTITY_COUNT" -le 3 ]; then
  echo "  ✓ Entidades: ${ENTITY_COUNT} (max 3)"
  ((PASS++))
else
  echo "  ✗ Entidades: ${ENTITY_COUNT} (> 3)"
  ((FAIL++))
fi

echo
echo "--- Verificação de Anti-Patterns ---"

# R1: No repository pattern
REPO_COUNT=$(grep -r 'repository' ${BASE} --include='*.ts' -l 2>/dev/null | wc -l)
if [ "$REPO_COUNT" -eq 0 ]; then
  echo "  ✓ Nenhum repository pattern"
  ((PASS++))
else
  echo "  ✗ Repository pattern detectado"
  ((FAIL++))
fi

# R2: No factory pattern
FACTORY_COUNT=$(grep -r 'Factory' ${BASE} --include='*.ts' -l 2>/dev/null | wc -l)
if [ "$FACTORY_COUNT" -eq 0 ]; then
  echo "  ✓ Nenhum factory pattern"
  ((PASS++))
else
  echo "  ✗ Factory pattern detectado"
  ((FAIL++))
fi

# R3: No adapter pattern
ADAPTER_COUNT=$(grep -r 'Adapter\|mapper' ${BASE} --include='*.ts' -l 2>/dev/null | wc -l)
if [ "$ADAPTER_COUNT" -eq 0 ]; then
  echo "  ✓ Nenhum adapter/mapper"
  ((PASS++))
else
  echo "  ✗ Adapter/mapper detectado"
  ((FAIL++))
fi

# R4: No `any` types
ANY_COUNT=$(grep -rn ': any' ${BASE} --include='*.ts' 2>/dev/null | wc -l)
if [ "$ANY_COUNT" -eq 0 ]; then
  echo "  ✓ Zero any types"
  ((PASS++))
else
  echo "  ⚠ ${ANY_COUNT} ocorrências de 'any'"
  ((WARN++))
fi

# R5: No console.log in production code
CONSOLE_COUNT=$(grep -rn 'console\.log\|console\.debug' ${BASE} --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v __tests__ | wc -l)
if [ "$CONSOLE_COUNT" -eq 0 ]; then
  echo "  ✓ Zero console.log em produção"
  ((PASS++))
else
  echo "  ⚠ ${CONSOLE_COUNT} console.log em produção"
  ((WARN++))
fi

echo
echo "--- Métricas de Tamanho ---"

TOTAL_LINES=$(find ${BASE} -name '*.ts' -o -name '*.tsx' | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
echo "  Linhas totais: ${TOTAL_LINES}"

LARGEST_HOOK=$(wc -l ${BASE}/hooks/*.ts ${BASE}/hooks/internal/*.ts 2>/dev/null | sort -rn | head -2 | tail -1 | awk '{print $1}')
echo "  Maior hook: ${LARGEST_HOOK} linhas"

LARGEST_COMPONENT=$(wc -l ${BASE}/components/*.tsx ${BASE}/components/internal/*.tsx 2>/dev/null | sort -rn | head -2 | tail -1 | awk '{print $1}')
echo "  Maior componente: ${LARGEST_COMPONENT} linhas"

echo
echo "--- TypeScript Check ---"
if npx tsc --noEmit 2>&1 | grep -q "error"; then
  echo "  ✗ TypeScript compila com erros"
  ((FAIL++))
else
  echo "  ✓ TypeScript compila sem erros"
  ((PASS++))
fi

echo
echo "--- Testes ---"
TEST_OUTPUT=$(npx vitest run ${BASE} 2>&1 || true)
if echo "$TEST_OUTPUT" | grep -q "Tests"; then
  echo "  ✓ Testes executados"
  ((PASS++))
else
  echo "  ⚠ Testes podem ter falhado"
  ((WARN++))
fi

echo
echo "--- Resumo ---"
TOTAL=$((PASS + FAIL))
echo "  ✅ Pass: ${PASS}/${TOTAL}"
echo "  ❌ Fail: ${FAIL}/${TOTAL}"
echo "  ⚠️  Warn: ${WARN}"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "  STATUS: FAIL ✗"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo
  echo "  STATUS: PASS (com avisos) ⚠"
  exit 0
else
  echo
  echo "  STATUS: PASS ✓"
  exit 0
fi
