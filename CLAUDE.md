# HC Quality — CQ Labclin

Sistema SaaS multi-tenant de Controle Interno de Qualidade para laboratórios clínicos.
Stack: **React 19 + TS 5.8 + Vite 6 · Zustand 5 · Firebase 12 · Gemini 2.5 Flash · Tailwind**.

Em produção: **<https://hmatologia2.web.app>** (region functions: `southamerica-east1`).

---

## Como este projeto é documentado

O contexto do projeto vive em **camadas** — carrega só o que precisa para a tarefa. Ver [`.claude/CONTEXT_PROTOCOL.md`](.claude/CONTEXT_PROTOCOL.md) para o protocolo completo.

- **Este arquivo** (root CLAUDE.md) — panorama + convenções globais + lista de módulos. Carrega em toda sessão.
- **`.claude/rules/*.md`** — regras condicionais por path glob (só carregam quando tocar arquivos relevantes).
- **`src/features/<módulo>/CLAUDE.md`** — regras de negócio, fases e pendências de cada módulo.
- **`.claude/docs/INITIAL_SPEC_legacy.md`** — especificação inicial completa de 2026-04 (backup, não carregar por padrão).

**Regra ativa**: quando um módulo concluir milestone, atualizar a seção "Módulos em produção" abaixo com uma linha.

---

## Convenções invioláveis (aplicam a todo o codebase)

- **Multi-tenant**: toda coleção de domínio vive em `/<coleção>/{labId}/<sub>` ou `/labs/{labId}/<coleção>/<sub>`. Payload carrega `labId` redundante.
- **RN-06 — soft delete only**: nunca `deleteDoc`; sempre `softDelete*` do service.
- **Assinatura**: `LogicalSignature = { hash, operatorId, ts }` com `operatorId === request.auth.uid`. Rules validam `hash.size() == 64` + `ts is timestamp`.
- **Thin service, fat hooks**: service cobre CRUD + mapping snapshot → entidade. Hooks carregam validações de negócio (RN-*), orquestração atomic (`writeBatch`), geração de assinatura.
- **Escrita regulatória via Cloud Function callable** (Fase 0b+). Client só lê dessas coleções. Service client-side `create*` fica deprecated por 1 sprint antes de remover.
- **Input DTOs via `Omit<Entidade, 'id'|'labId'|'criadoEm'|'deletadoEm'>`** — service é a única fonte de audit fields.
- **Auth e módulos protegidos**: não tocar `auth`, `admin`, `shared` sem autorização explícita.
- **Design dark-first, world-class**: Apple/Linear/Stripe de referência; sem templates genéricos; tipografia editorial; sensibilidade cinematográfica (ver `~/.claude/CLAUDE.md` global).

Regras com escopo mais estreito vivem em `.claude/rules/`:

- [`module-protection.md`](.claude/rules/module-protection.md) — isolamento entre módulos (triggers: `src/features/**`)
- [`firestore-security.md`](.claude/rules/firestore-security.md) — rules + services + callables (triggers: `firestore.rules`, `**/*Service.ts`, `functions/**`)
- [`deploy-protocol.md`](.claude/rules/deploy-protocol.md) — ordem de deploy + PWA SW (triggers: `firebase.json`, `functions/**`, etc)

---

## Módulos em produção

> **Dever de atualização**: cada módulo mantém sua própria linha aqui. Após milestone no módulo, editar.

| Módulo | Status | Última entrega |
| --- | --- | --- |
| `analyzer` | Em prod · OCR Yumizen H550 via Gemini | — |
| `coagulacao` | Em prod · CIQ coagulação | — |
| `ciq-imuno` | Em prod · CIQ imunologia qualitativa | — |
| `insumos` | Em prod · controle de insumos | — |
| `controle-temperatura` | **Dev** · FR-11 + IoT ESP32 + calibração; rules pendentes antes de prod | — |
| `uroanalise` | Em prod · uroanálise | — |
| `equipamentos` | Em prod · cadastro de equipamentos | — |
| `fornecedores` | Em prod · cadastro de fornecedores | — |
| `lots` | Em prod · gestão de lotes CQ | — |
| `runs` | Em prod · corridas de controle | — |
| `chart` | Em prod · Levey-Jennings | — |
| `reports` | Em prod · relatórios | — |
| `labSettings` | Em prod · config de lab | — |
| `hub` | Em prod · dashboard de módulos | — |
| `bulaparser` | Em prod · parse de bulas | — |
| `auth` | Em prod · autenticação/onboarding | — |
| `admin` | Em prod · superadmin | — |
| `educacao-continuada` | Em prod · ISO 15189 + XLSX + callables server-side | 2026-04-24 |

Módulos com `CLAUDE.md` próprio: `educacao-continuada`, `controle-temperatura`.

---

## Stack + arquitetura (essencial)

- **Estrutura**: feature-based em `src/features/<módulo>/{components,hooks,services,types}`.
- **Estado**: Zustand 5 para global (`useAuthStore`); hooks locais para cada módulo.
- **Queries Firebase**: `onSnapshot` via hook padrão (ver `useColaboradores.ts` em `educacao-continuada` como referência canônica).
- **Validação**: Zod 3 nos payloads de IA e entradas críticas.
- **PWA**: `vite-plugin-pwa` com `registerType: 'autoUpdate'` — deploy novo exige hard reload no browser.
- **Functions**: Node 22 em `southamerica-east1`, callables regionalmente.

## Project IDs

- Firebase: `hmatologia2` · Hosting: `hmatologia2.web.app`
- Module hub: tiles de 18 features acessíveis via `/hub`

## Deploy rápido (detalhes em `deploy-protocol.md`)

```bash
npx tsc --noEmit                                                     # 1. type-check
npm run build                                                        # 2. build
firebase deploy --only hosting --project hmatologia2                 # 3. hosting
```

Deploy requer autorização explícita a cada execução. Nunca encadear `&&` sem ack.

---

## Quando for trabalhar

1. **Continuar tarefa anterior** → `claude --resume`
2. **Trabalhar em módulo específico** → lê `src/features/<módulo>/CLAUDE.md` primeiro
3. **Nova feature / cross-módulo** → consulta `.claude/rules/` aplicáveis + este CLAUDE.md
4. **Nova aba com reset** → cola `src/features/<módulo>/HANDOFF.md` se existir

Para qualquer sessão: o protocolo completo está em [`.claude/CONTEXT_PROTOCOL.md`](.claude/CONTEXT_PROTOCOL.md).
