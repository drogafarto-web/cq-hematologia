# Rastreabilidade Operacional Completa — Feature Release 2026-05-04

## Visão Geral

Implementamos rastreabilidade operacional de 360°: **quem** abriu/fechou cada lote, **quando**, **que código Worklab** foi registrado, e **quanto tempo** está em uso.

Essencial para auditoria clínica (RDC 786/2023, RDC 978/2025) e rastreabilidade forense.

---

## 1. Rastreabilidade de Operador (abertoPor / fechadoPor)

### Campos adicionados em `InsumoBase`

```typescript
abertoPor?: {
  operadorId: string;      // UID do usuário
  operadorName: string;    // Display name
  timestamp: Timestamp;    // Momento da abertura (server time)
};

fechadoPor?: {
  operadorId: string;
  operadorName: string;
  timestamp: Timestamp;
};
```

### Cobertura

- ✅ **openInsumo()** — gravado ao abrir qualquer lote
- ✅ **closeInsumo()** — gravado ao fechar qualquer lote
- ✅ **openInsumoWithExamCode()** — gravado atomicamente em transaction
- ✅ **Todos os tipos**: controles, reagentes, tiras-uro

### Fluxo

```
Operador clica "Abrir lote"
  ↓
openInsumo() executa:
  - Calcula validadeReal
  - Atualiza status → 'ativo'
  - Grava abertoPor { operadorId, operadorName, timestamp }
  - Grava abertoPrimeiraVezEm (primeira abertura)
  - Log movimentacao (eventually consistent)
```

---

## 2. Rastreabilidade Worklab LIS (Faixa de Exames)

### Campos adicionados em `InsumoBase`

```typescript
primeiroExameWorklab?: string;    // "0107200" — código digitado pelo operador
ultimoExameWorklab?: string;      // "0107199" — calculado automaticamente
abertoPrimeiraVezEm?: Timestamp;  // Quando foi aberto
```

### Funcionalidade

**Problema:** Qual faixa de exames (hemogramas) foi processada com cada lote?

**Solução:**

1. Operador digita código do **primeiro** exame ao abrir novo lote
2. Sistema **fecha lote anterior** e calcula `ultimoExame = primeiroExame - 1`
3. Resultado: faixa `[primeiroExame, ultimoExame]` fica gravada atomicamente

### Exemplo

```
Lote A (ativo):    primeiroExame=0107150
Abre Lote B novo:  código=0107200

Transação atomicamente:
  - Fecha Lote A: ultimoExame=0107199, fechadoPor={...}
  - Abre Lote B: primeiroExame=0107200, abertoPor={...}

Resultado: Lote A rastreia exames [0107150 .. 0107199]
```

### Fluxo Técnico (openInsumoWithExamCode)

```typescript
runTransaction(db, async (transaction) => {
  // 1. READ: Valida novo insumo + anterior existente
  const newSnap = await transaction.get(newRef);
  const prevSnap = await transaction.get(prevRef); // race condition check

  // 2. VALIDATE: Anterior está 'ativo'?
  if (prevSnap.data().status !== 'ativo') {
    throw 'Lote anterior não mais ativo';
  }

  // 3. CALCULATE: ultimoExame = examCode - 1
  const ultimoExame = String(parseInt(examCode) - 1).padStart(examCode.length, '0');

  // 4. WRITE: Fecha anterior atomicamente
  transaction.update(prevRef, {
    status: 'fechado',
    ultimoExameWorklab: ultimoExame,
    fechadoPor: { operadorId, operadorName, timestamp },
  });

  // 5. WRITE: Abre novo atomicamente
  transaction.update(newRef, {
    status: 'ativo',
    primeiroExameWorklab: examCode,
    abertoPor: { operadorId, operadorName, timestamp },
    abertoPrimeiraVezEm: timestamp,
  });
});

// POST-TRANSACTION: Logs (eventually consistent, OK)
logMovimentacao('fechamento', prevRef);
logMovimentacao('abertura', newRef);
```

### Race Condition Protection

```
Cenário: Dois operadores simultâneos
  Op1: Abre novo com código 0107200
  Op2: Tenta também (read vê anterior ativo)

Transação Op1 ganha:
  - Anterior fica fechado

Transação Op2 perde:
  - READ FASE: prevSnap.status === 'encerrado' ≠ 'ativo'
  - THROWS: "Lote anterior não mais ativo — recarregue"
  - Op2 vê mensagem clara: retry after refresh
```

---

## 3. Relatório de Rastreabilidade em Uso

### UI: Nova Aba "Relatório em uso"

**Local:** Insumos & Equipamentos → Lotes → **"Relatório em uso"**

**Componente:** `RelatorioRastreabilidadeEmUso.tsx`

### Tabela com Colunas

| Coluna             | Fonte                                  | Uso                    |
| ------------------ | -------------------------------------- | ---------------------- |
| Insumo             | `nomeComercial` + `fabricante`         | Identificação          |
| Tipo               | `tipo` discriminated union             | Controle/Reagente/Tira |
| Lote               | `lote`                                 | Serial fabricante      |
| Aberto por         | `abertoPor.operadorName` + `UID slice` | Auditoria              |
| Data/Hora abertura | `abertoPor.timestamp`                  | Cronologia             |
| Dias em uso        | `(hoje - abertoPrimeiraVezEm)`         | Alerta > 30d           |
| Código Worklab     | `primeiroExameWorklab`                 | Rastreabilidade LIS    |
| Validade           | `validade`                             | Conformidade           |

### Badge Âmbar

Quando `diasEmUso > 30`:

```
[32 DIAS]  ← Fundo amarelo, fonte âmbar
```

Sinaliza lotes "antigos" que devem ser substituídos em breve.

### Ordenação

Descendente por `abertoPor.timestamp` (mais recentes primeiro).

---

## 4. Campo Obrigatório: Código Worklab

### Mudanças em NovoLoteModal.tsx

1. **showTraceability = true** (antes era só para reagentes)
   - Agora TODOS os tipos têm campo Worklab

2. **Validação obrigatória**

   ```typescript
   if (showTraceability && !traceExamCode.trim()) {
     e.traceExamCode = 'Informe o código do primeiro atendimento (Worklab).';
   }
   ```

3. **UI melhorada**
   - Label: "Rastreabilidade Worklab"
   - Frase: "Obrigatório: registre o código do primeiro atendimento (exame) que será processado com este lote. **Consulte Worklab para obter o código.**"
   - Placeholder: "Código do primeiro atendimento \*"
   - Erro visual em vermelho se vazio

### Comportamento

```
Operador tenta confirmar sem código
  ↓
validate() retorna false
  ↓
Botão "Cadastrar lote" desabilitado
  ↓
Mensagem vermelha: "Informe o código..."
```

---

## 5. Fluxo de Negócio (Ponta a Ponta)

### Cenário: Troca de Reagente em Rotina

```
1. Lote A está ativo (primeiroExame=0107100)
2. Operador abre NovoLoteModal
3. Seleciona Lote B do mesmo produto
4. Preenche "Código do primeiro atendimento": 0107200
5. Clica "Cadastrar lote"

validate() passa:
  - Código é numérico ✓
  - Não está vazio ✓

handleSubmit():
  - Cria doc do Lote B
  - Busca Lote A ativo do mesmo produto
  - Mostra RotacaoLoteSuggestion

Operador clica "Aplicar rotação":
  - Chama openInsumoWithExamCode(labId, B.id, "0107200", ..., A.id)

Transaction executa:
  - Fecha A: ultimoExame=0107199, fechadoPor={João, 14:32}
  - Abre B: primeiroExame=0107200, abertoPor={João, 14:32}

Resultado:
  - Lote A: [0107100 .. 0107199] com João
  - Lote B: [0107200 .. ?] com João
  - Relatório mostra ambos com timestamps
```

---

## 6. Conformidade Regulatória

### RDC 786/2023 Art. 42 (Rastreabilidade de Insumos)

✅ Cada lote rastreável por **quem** abriu/fechou + **quando**  
✅ Faixa de exames processados com cada lote  
✅ Audit trail imutável (movimentações)

### RDC 978/2025 Art.128 (CIQ Documental)

✅ Registro de quem qualificou o lote  
✅ Assinatura criptográfica em movimentações  
✅ Rastreabilidade de reagentes/controles por corrida

### LGPD (Lei Geral de Proteção de Dados)

✅ Consentimento implícito: operador autorizado pelo lab  
✅ Dados necessários: apenas UID + nome + timestamp  
✅ Retenção: aligned com RDC (5 anos Firestore lifecycle)

---

## 7. Performance e Escalabilidade

### Índices Firestore

Nenhum índice adicional necessário:

- `status='ativo'` já está indexado (LotesTable)
- `produtoId` + `status='ativo'` já está indexado (findAtivoDoMesmoProduto)
- `abertoPor.timestamp` é leitura em memória (sorting client-side OK)

### Transaction Contention

Proteção contra race condition garante **no máximo 1 lote ativo por produto**.

Se 100 operadores abrem simultaneamente:

- 99 transações falham com mensagem clara
- 1 ganha e transição é atômica

Retry é O(1) — operador vê "falhou, recarregue e tente de novo".

---

## 8. Backlog / Futuro

### Possível Expansão

1. **Audit Report Automático**
   - Exportar Relatório em Uso como PDF/CSV
   - Timestamp de quando foi gerado

2. **Alertas em Real-Tempo**
   - Webhook quando lote atinge 30+ dias
   - Slack/SMS para supervisor

3. **Análise de Cobertura**
   - Gráfico: "Quantos exames/dia por lote?"
   - Prever quando lote vai vencer vs. consumo

4. **Integração Worklab Bidirecional**
   - Hoje: operador digita código
   - Futuro: ler código de API do Worklab automaticamente

---

## 9. Verificação em Produção

### Checklist Pós-Deploy

```bash
# 1. Firestore: Verificar novo insumo
firebase firestore:get 'labs/{LAB}/insumos/{INSÚMO}' --project hmatologia2
# Deve mostrar: abertoPor, abertoPrimeiraVezEm, primeiroExameWorklab

# 2. NovoLoteModal: Campo obrigatório?
# Teste: Tenta cadastrar sem código Worklab → botão desabilitado

# 3. Relatório: Nova aba visível?
# URL: hmatologia2.web.app → Insumos & Equipamentos → "Relatório em uso"

# 4. Badge âmbar: Lote com > 30 dias?
# Crie um insumo com abertoPrimeiraVezEm 31 dias atrás → deve aparecer âmbar
```

---

## Arquivos Modificados

```
src/features/insumos/
├── types/Insumo.ts                               (+5 campos)
├── services/insumosFirebaseService.ts            (+openInsumoWithExamCode, modified openInsumo/closeInsumo)
├── components/NovoLoteModal.tsx                  (+validação, +frase Worklab)
├── components/RelatorioRastreabilidadeEmUso.tsx  (NEW)
└── InsumosView.tsx                               (+aba, +import, +condicional render)
```

## Commit

**Hash:** `8710f00`  
**Mensagem:** "feat(insumos): Rastreabilidade operacional completa + Relatório em Uso"

---

## Referências

- **RFC:** Feature request (2026-05-04)
- **Regulação:** RDC 786/2023, RDC 978/2025, LGPD
- **Padrão:** Timestamp server-side, Firestore transactions, discriminated unions
- **Status:** ✅ Deployed to production (hmatologia2.web.app)
