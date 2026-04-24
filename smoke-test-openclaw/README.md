# HC Quality — Smoke Test com OpenClaw

Conteúdo deste diretório:

- **[SKILL.md](SKILL.md)** — skill instalável no OpenClaw (formato oficial com frontmatter). 14 fluxos + 3 fluxos negativos. Copia e cola em produção.
- **[PROMPT_INLINE.md](PROMPT_INLINE.md)** — versão curta para colar direto no chat do OpenClaw sem instalar skill.
- **[fixtures/](fixtures/)** — mocks prontos (bula PDF placeholder, CSV de lote de exemplo, etc).

---

## Opção A — Instalar como skill do OpenClaw (recomendado)

1. Localiza o diretório de skills do OpenClaw. Caminhos comuns:
   - `~/.openclaw/skills/` (Linux/Mac)
   - `%USERPROFILE%\.openclaw\skills\` (Windows)
   - Ou no workspace atual: `.openclaw/skills/` (tem precedência sobre o global)

2. Cria diretório pra skill e copia:
   ```bash
   mkdir -p ~/.openclaw/skills/hc-quality-smoke
   cp SKILL.md ~/.openclaw/skills/hc-quality-smoke/
   cp -r fixtures ~/.openclaw/skills/hc-quality-smoke/
   ```

3. Preenche as variáveis no topo do SKILL.md (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `WHATSAPP_IMAGES_DIR`, etc).

4. No OpenClaw, invoca:
   ```
   Use a skill hc-quality-smoke.
   Preenche os placeholders, roda todos os fluxos em ordem e me entrega o REPORT.md.
   ```

OpenClaw injeta a skill no system prompt e executa.

---

## Opção B — Colar prompt direto no chat

Abra [PROMPT_INLINE.md](PROMPT_INLINE.md), preenche as 5 variáveis no topo, e cola inteiro na primeira mensagem do chat OpenClaw.

Trade-off: menos rigoroso que a skill (skill tem parser XML e injection estruturada), mas roda sem setup.

---

## Fixtures incluídos

### `fixtures/bula-mock.pdf`
PDF de 1 página com texto "BULA MOCK — SMOKE TEST" — serve pra validar o fluxo F10 (upload de bula). Gemini não vai extrair nada útil; o teste valida apenas que o pipeline aceita o arquivo e retorna resposta estruturada vazia.

### `fixtures/lote-csv-mock.csv`
CSV no formato esperado pelo AddLotModal, com 17 analitos × 3 níveis. Pode ser usado em F08 como alternativa à criação manual.

### `fixtures/strip-mock.jpg`
Imagem sintética 400×800px simulando um strip de imunoensaio com 2 linhas (C + T) — usa no F05.

### `fixtures/tira-mock.jpg`
Imagem sintética 600×100px com quadrados coloridos simulando uma tira urinária — usa no F06.

---

## O que a skill NÃO faz (por design)

- ❌ Não envia emails reais (triggerCQIReport, triggerLabBackup, etc)
- ❌ Não deleta nada (zero DELETEs no Firestore)
- ❌ Não dispara operações SuperAdmin destrutivas (grant, revoke, deleteUser)
- ❌ Não confirma runs em dados reais — apenas registra UI, tira screenshot, cancela
- ❌ Não roda provisionamento de claims em modo apply

Tudo que cria tem prefix `SMOKE_` pra você limpar facilmente depois com um script Firestore.

---

## Limpeza pós-teste

Query Firestore pra achar tudo que o smoke criou:

```js
// Rodar como Admin SDK
const db = admin.firestore();
const labId = 'seu-lab-id';

// Produtos mock
const produtos = await db.collection(`labs/${labId}/produtos-insumos`)
  .where('nomeComercial', '>=', 'SMOKE_')
  .where('nomeComercial', '<', 'SMOKE_~')
  .get();

// Lotes mock
const lotes = await db.collection(`labs/${labId}/insumos`)
  .where('lote', '>=', 'SMOKE-LOT-')
  .where('lote', '<', 'SMOKE-LOT-~')
  .get();

// Lista pra revisar antes de deletar
[produtos.docs, lotes.docs].flat().forEach(d => console.log(d.ref.path, d.data()));
```

Revisa a lista, depois batch delete se OK.
