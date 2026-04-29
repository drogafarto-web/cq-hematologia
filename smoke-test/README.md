# HC Quality — Playwright Smoke Tests

Este projeto contém testes de fumaça (smoke tests) puros em Playwright para o sistema HC Quality.

## Estrutura
- `specs/`: Arquivos de teste (.spec.ts)
- `fixtures/`: Helpers de autenticação, nomes e utilitários
- `playwright.config.ts`: Configuração global (screenshots em falha, traces em retry)

## Como rodar

1. **Instalar dependências**:
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configurar variáveis**:
   Renomeie `.env.test.example` para `.env.test` e preencha as credenciais.

3. **Executar testes**:
   - Tudo (headless): `npx playwright test`
   - Um spec específico (headed): `npx playwright test specs/f-im-02-lotes.spec.ts --headed`

4. **Ver relatórios**:
   ```bash
   npx playwright show-report
   ```

## Princípios
- **Determinismo**: Seletores exatos baseados no `PROMPT_CIQ_IMUNO.md`.
- **Isolamento**: Dados criados usam prefixo `SMOKE_`.
- **Manutenibilidade**: LLM atua apenas como depurador em caso de falha, sugerindo patches para os arquivos `.spec.ts`.
