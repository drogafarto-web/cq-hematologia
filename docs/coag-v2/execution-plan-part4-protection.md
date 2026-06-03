# Parte 4 — Sistema de Proteção Arquitetural

---

## 4.1 Regras Imutáveis

As seguintes regras são **absolutas** — não há exceção, não há override, não há "mas é pragmático".

### R1: Entidades = 3. Nem mais, nem menos.

```
ControlOperacional ✅
Attempt            ✅
RTAction           ✅
[Nome Novo]        ❌ REJEITADO AUTOMATICAMENTE
```

**Verificação:** auditor conta interfaces exportadas em `types/`. Se > 3, rejeita.

### R2: Eventos = 3. Nem mais, nem menos.

```
attempt.criado        ✅
controle.aprovado     ✅
controle.rejeitado    ✅
[Nome Novo]           ❌ REJEITADO AUTOMATICAMENTE
```

**Verificação:** auditor conta strings tipo-evento em `audit/`. Se > 3, rejeita.

### R3: Campos operacionais expostos ≤ 6.

```
controlOperacionalId  (dropdown)
equipamentoId         (dropdown)
resultados.AP         (input)
resultados.RNI        (input)
resultados.TTPA       (input)
acaoCorretiva         (textarea — opcional)
```

**Verificação:** auditor conta campos renderizados em `AttemptForm.tsx`. Se > 6, rejeita.

### R4: Termos técnicos proibidos em UI operacional.

```
Palavras proibidas em strings UI (pt-BR e en):
- "run", "corrida"
- "lot", "lote" (a menos que "lote físico" em tooltip RT)
- "status", "state"
- "workflow", "fluxo"
- "pending", "pendente" (como label de estado)
- "aprovado", "rejeitado" (como label de workflow — OK como label de decisão RT)
- "calibração", "calibration"
- "conformidade" (termo técnico — usar "Dentro dos limites")
```

**Verificação:** grep em components/. Se aparecer na UI do operador, rejeita.

### R5: Over-engineering patterns proibidos.

```typescript
// ❌ Proibido — repositório pattern:
export interface IControlOperacionalRepository { ... }

// ❌ Proibido — factory pattern:
export function createControlOperacionalService(config: ServiceConfig) { ... }

// ❌ Proibido — adapter pattern:
export class FirestoreToDomainAdapter { ... }

// ❌ Proibido — decorator pattern:
@Auditable @Transactional
export function saveAttempt() { ... }

// ❌ Proibido — wrapper sem valor:
export function attemptRepository() {
  return { save: (data) => attemptService.create(data) };
}
```

**Verificação:** auditor detecta keywords (Repository, Factory, Adapter, Decorator, Wrapper).

### R6: Sem workflow explícito.

```typescript
// ❌ Proibido — enum de status workflow:
export type AttemptStatus = 'pending' | 'in_validation' | 'approved' | 'rejected';

// ✅ Permitido — conformidade calculada (não estado):
export type Conformidade = 'A' | 'R'; // Calculado em save, não setado via UI

// ✅ Permitido — status operacional simples:
export type ControlStatus = 'ativo' | 'pausado' | 'aposentado';
```

**Verificação:** auditor detecta tipos com > 3 valores que descrevem "fluxo" (pending/in_progress/...).

### R7: Zero acoplamento inter-agentes.

```typescript
// ❌ Proibido — dois hooks escrevendo no mesmo doc:
useAttempt() modifica doc.attempt
useRTAction() modifica doc.attempt.status

// ✅ Permitido — cada agente em entidade própria:
useAttempt() cria/le Attempt
useRTAction() cria RTAction (referencia Attempt, mas não modifica)
```

**Verificação:** auditor checa que cada service escreve apenas em sua coleção.

### R8: Snapshot é append-only.

```typescript
// ❌ Proibido — modificar snapshot após save:
attempt.snapshot = newSnapshot; // Nunca.
updateDoc(attemptRef, { snapshot: newSnapshot }); // Nunca.

// ✅ Correto — snapshot congelado no save:
const snapshot = buildSnapshot(); // No momento do save
await addDoc(collection, { ...data, snapshot }); // Persistido uma vez
```

**Verificação:** auditor detecta updates em campos de snapshot em qualquer service.

### R9: LogicalSignature é imutável.

```typescript
// ❌ Proibido — recalcular assinatura:
attempt.logicalSignature = await sign(newData); // Nunca após save.

// ✅ Correto — calculada 1x no save:
const signature = await sign(data);
await addDoc(collection, { ...data, logicalSignature: signature });
```

**Verificação:** auditor detecta updates em `logicalSignature`.

### R10: Comentários e documentação.

```typescript
// ❌ Proibido — comentários explicativos óbvios:
// Esta função salva um attempt no Firestore
async function saveAttempt(data: AttemptInput) { ... }

// ❌ Proibido — JSDoc em toda função privada:
/**
 * Helper interno para construir o payload do attempt.
 * @param data - dados de entrada
 * @returns payload formatado
 */

// ✅ Permitido — comentários em casos específicos:
// RDC 978 Art. 128: ação corretiva obrigatória em não-conformidade
// Westgard 1-3s: rejeição se > 3SD do mean
// Snapshots congelados sobrevivem deleção do doc mestre (RDC 786 Art. 42)
```

**Verificação:** auditor conta linhas de comentário vs código. Se > 30%, alerta.

---

## 4.2 Guardrails

### Guardrail 1: Tamanho de arquivo

| Tipo      | Limite     | Ação se exceder           |
| --------- | ---------- | ------------------------- |
| Types     | 100 linhas | Dividir                   |
| Service   | 200 linhas | Extrair operações         |
| Hook      | 200 linhas | Extrair sub-hooks         |
| Component | 300 linhas | Extrair sub-componentes   |
| Test      | 200 linhas | Dividir describe() blocks |

### Guardrail 2: Ciclomática de função

```
≤ 5: OK
6-8: Alerta (refatorar se possível)
> 8: REJEITADO (extrair em funções menores)
```

### Guardrail 3: Profundidade de aninhamento

```
≤ 3 níveis (if/for/try): OK
> 3 níveis: REJEITADO
```

### Guardrail 4: Número de parâmetros

```
≤ 3 parâmetros: OK (com interface única)
4-5: Alerta
> 5: REJEITADO (usar objeto interface)
```

### Guardrail 5: Imports de arquivos proibidos

```
Lista dinâmica por wave — o auditor valida contra o spec.
Import de path fora da lista = REJEITADO.
```

### Guardrail 6: Exports de tipos não-especificados

```
Se o contrato especifica 3 tipos exportados e o arquivo exporta 5:
- Os 2 extras devem ser internos (não-exported)
- Se exportados → REJEITADO
```

### Guardrail 7: Console.log / debugger

```
Zero tolerância. Qualquer console.log ou debugger = REJEITADO.
Usar logger estruturado do projeto se necessário.
```

### Guardrail 8: `any` type

```
Zero tolerância. Qualquer `any` = REJEITADO.
Usar `unknown` + type guard se necessário.
```

### Guardrail 9: Fire-and-forget sem handler

```typescript
// ❌ Proibido:
saveAttempt(data); // sem await, sem .catch()

// ✅ Correto:
await saveAttempt(data); // tratado
// OU
void saveAttempt(data).catch(logError); // fire-and-forget explícito
```

### Guardrail 10: Queries sem limit/paginação

```typescript
// ❌ Proibido:
getDocs(collection(db, 'labs', labId, 'attempts')); // sem limit

// ✅ Correto:
getDocs(query(collection(db, 'labs', labId, 'attempts'), orderBy('criadoEm', 'desc'), limit(50)));
```

---

## 4.3 Anti-Patterns Automáticos (detecção por auditor)

### A1: Componente com lógica de negócio

```typescript
// ❌ Anti-pattern — lógica de Westgard no componente:
function AttemptForm() {
  const violations = computeWestgard(allAttempts, nivel, validade);
  // ... render
}

// ✅ Correto — cálculo no hook:
function AttemptForm() {
  const { violations } = useAttemptEvaluation(attemptId);
  // ... render
}
```

**Detecção:** se nome de função com "compute*" ou evaluate*" aparece dentro de arquivo `*Form.tsx` ou `*List.tsx`, alerta.

### A2: Hook com副作用 não documentado

```typescript
// ❌ Anti-pattern — useEffect com side-effect mágico:
useEffect(() => {
  if (condition) {
    saveAttempt(data); // side-effect não documentado
  }
}, [condition]);

// ✅ Correto — side-effect explícito via callback:
const handleSave = async () => {
  await saveAttempt(data);
};
```

**Detecção:** useEffect que chama funções de save/mutations sem comentário "sync with X".

### A3: Estado redundante com derivado

```typescript
// ❌ Anti-pattern:
const [attempts, setAttempts] = useState([]);
const [isLoading, setIsLoading] = useState(true); // pode derivar de attempts
const [error, setError] = useState(null); // pode derivar de attempts

// ✅ Correto:
const { attempts, isLoading, error } = useAttempts(); // hook encapsula
```

**Detecção:** se hook retorna `{ data, isLoading, error }` mas componente recria um desses como state local.

### A4: Abstração não solicitada

```typescript
// ❌ Anti-pattern:
export function createAttemptsRepository(config: RepoConfig) {
  return {
    findAll: () => getDocs(...),
    findById: (id) => getDoc(...),
    save: (data) => addDoc(...),
  };
}

// ✅ Correto — funções diretas:
export async function getAttempts(labId: string, limit = 50) { ... }
export async function getAttempt(labId: string, id: string) { ... }
export async function saveAttempt(labId: string, data: AttemptInput) { ... }
```

**Detecção:** grep por `create[A-Z].*(config|opts|options)`.

### A5: Hook que faz "demais"

```typescript
// ❌ Anti-pattern — 1 hook com 5 responsabilidades:
function useCoag() {
  const [controls, setControls] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [rtActions, setRTActions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const saveAttempt = async () => { ... };
  const approveAttempt = async () => { ... };
  const rejectAttempt = async () => { ... };
  const notifyNOTIVISA = async () => { ... };
  const exportPDF = async () => { ... };

  return { controls, attempts, rtActions, isSaving, error,
           saveAttempt, approveAttempt, rejectAttempt, notifyNOTIVISA, exportPDF };
}

// ✅ Correto — hooks focados:
useControlOperacional() → { controls, ... }
useAttempts() → { attempts, isLoading, error }
useAttemptSave() → { saveAttempt, isSaving, error }
useRTAction() → { approveAttempt, rejectAttempt, notifyNOTIVISA }
```

**Detecção:** hook exportando > 8 campos (exceto types).

---

## 4.4 Critérios de Rejeição Imediata (bloqueia merge)

1. **Qualquer violação de R1-R10** (regras imutáveis)
2. **Qualquer guardrail excedido** (tamanho, complexidade, etc)
3. **Qualquer anti-pattern detectado** (A1-A5)
4. **Testes obrigatórios da wave não passando**
5. **Módulos adjacentes afetados** (hematologia, uroanálise, imuno)
6. **`console.log` ou `debugger` em código de produção**
7. **`any` type em qualquer lugar**
8. **Imports circulares**
9. **Firestore queries sem limit**
10. **Snapshots modificáveis após save**

### Escalação:

- 1ª rejeição: Executor corrige (2 tentativas)
- 2ª rejeição: Arquiteto revisa spec
- 3ª rejeição: Wave abortada, rollback

---

## 4.5 Auditoria Pós-Implementação

### Checklist automático (roda em CI):

```bash
#!/bin/bash
set -e

echo "=== Auditoria Arquitetural Coagulação v2 ==="

# R1: Entidades = 3
ENTITIES=$(ls src/features/coagulacao-v2/types/*.ts | wc -l)
[ "$ENTITIES" -eq 3 ] || { echo "❌ R1: $ENTITIES entidades (esperado 3)"; exit 1; }

# R3: Campos operacionais ≤ 6
FIELDS=$(grep -c "name=" src/features/coagulacao-v2/components/AttemptForm.tsx)
[ "$FIELDS" -le 6 ] || { echo "❌ R3: $FIELDS campos expostos (esperado ≤6)"; exit 1; }

# R4: Termos técnicos proibidos
TERMS="Run|run|Lot|lot|Workflow|workflow|Status|status"
VIOLATIONS=$(grep -rE "$TERMS" src/features/coagulacao-v2/components/ --include="*.tsx" -l | grep -v ".test." || true)
[ -z "$VIOLATIONS" ] || { echo "❌ R4: termos proibidos em $VIOLATIONS"; exit 1; }

# Guardrail 1: Tamanho de arquivos
MAX_COMPONENT=300
for f in src/features/coagulacao-v2/components/*.tsx; do
  LINES=$(wc -l < "$f")
  [ "$LINES" -le "$MAX_COMPONENT" ] || { echo "❌ G1: $f tem $LINES linhas (máx $MAX_COMPONENT)"; exit 1; }
done

# Guardrail 7: console.log
LOGS=$(grep -rE "console\.(log|debug)|debugger" src/features/coagulacao-v2/ --include="*.ts" --include="*.tsx" -l | grep -v ".test." || true)
[ -z "$LOGS" ] || { echo "❌ G7: console.log/debugger em $LOGS"; exit 1; }

# Guardrail 8: any type
ANYS=$(grep -rE ":\s*any\b" src/features/coagulacao-v2/ --include="*.ts" --include="*.tsx" -l | grep -v ".test." || true)
[ -z "$ANYS" ] || { echo "❌ G8: 'any' type em $ANYS"; exit 1; }

echo "✅ Auditoria aprovada"
```

---

## 4.6 Métricas de Simplicidade

### Dashboard por wave:

| Métrica                       | Alvo         | Status |
| ----------------------------- | ------------ | ------ |
| Entidades no módulo           | 3            | □      |
| Eventos no módulo             | 3            | □      |
| Campos operacionais expostos  | ≤ 6          | □      |
| Arquivos no módulo            | ≤ 15         | □      |
| Linhas totais (src)           | ≤ 3000       | □      |
| Maior hook                    | ≤ 200 linhas | □      |
| Maior componente              | ≤ 300 linhas | □      |
| Ciclomática máxima            | ≤ 8          | □      |
| Profundidade máxima           | ≤ 3          | □      |
| Parâmetros máximos por função | ≤ 3          | □      |

### Regra de falha:

- Se **qualquer métrica** exceder o alvo → wave bloqueada até corrigir
- Se **3 métricas** excederem → Arquiteto deve revisar wave spec
- Não há "exceção pragmática" — simplicidade é o produto
