---
description: Proteção de isolamento entre módulos. Carrega quando tocar qualquer arquivo em src/features/**.
paths:
  - "src/features/**"
---

# Regra: Isolamento entre módulos de feature

## Módulos em produção — NÃO TOCAR sem autorização explícita

`analyzer` · `coagulacao` · `ciq-imuno` · `insumos` · `auth` · `admin` · `shared`

Cada um desses módulos está em produção atendendo labs reais (labclin-riopomba e outros). Mudança não autorizada pode quebrar compliance RDC 978/2025.

## Protocolo obrigatório ao trabalhar em um módulo

1. **Leia o `CLAUDE.md` do módulo primeiro** (`src/features/<módulo>/CLAUDE.md`) se existir — contém regras específicas de negócio, multi-tenant paths, regras invioláveis (RN-*) e pendências.
2. **Se o módulo não tem CLAUDE.md**, pergunte ao usuário antes de mudanças estruturais — pode ser um módulo legado que ninguém documentou.
3. **Leia apenas os arquivos do módulo ativo** — não faça grep global em `src/features/**` sem justificativa. Isso polui o contexto e pode revelar padrões inaplicáveis do módulo errado.
4. **Dependências externas permitidas** (cross-module):
   - `src/utils/*` — utilidades puras
   - `src/shared/services/firebase.ts` — APIs Firebase
   - `src/store/useAuthStore.ts` — `useActiveLabId()` e `useUser()`
   - `src/types/index.ts` — quando adicionar nova `View` no union do shell

## Convenções arquiteturais por módulo

- **Paths multi-tenant**: toda coleção regulatória vive em `/<módulo>/{labId}/<sub>` ou `/labs/{labId}/<módulo>/<sub>`. Documentos carregam `labId` redundante no payload (defense-in-depth).
- **Soft-delete only**: nunca chame `deleteDoc`. Use sempre `softDelete*` do service do módulo (RN-06).
- **Assinatura**: `LogicalSignature = { hash, operatorId, ts }` com `operatorId === request.auth.uid` (rule valida). Rules exigem `hash.size() == 64` + `ts is timestamp`.
- **Thin service, fat hooks**: service cobre CRUD + mapping; hooks carregam validações de negócio (RN-*) + assinatura + orquestração atomic via `writeBatch`.
- **Escrita regulatória via Cloud Function callable** em módulos com Fase 0b+. Service client-side só para leitura nessas coleções.

## O que fazer se precisar mexer em módulo protegido

1. Parar a implementação em curso
2. Explicar ao usuário qual módulo precisa ser tocado e por quê
3. Aguardar autorização explícita
4. Limitar o diff ao mínimo necessário
