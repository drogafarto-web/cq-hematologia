# Auditoria Fase 0 — Localização do vault Obsidian (HC Quality)

> **Vault adotado:** `C:\Users\labcl\Obsidian_Brain`. O inventário completo (Fase 1) está em **`Obsidian_Brain/_meta/00-auditoria.md`**. Este ficheiro no repo `c:\hc quality` mantém apenas o registo da Fase 0 sobre o caminho `C:\HC Quality`.

**Data do levantamento:** 2026-05-10  
**Escopo:** apenas leitura / mapeamento (Fase 0). Nenhuma alteração em PDFs, vídeos, notas ou configurações Obsidian além deste arquivo.

---

## 1. Caminho declarado na missão

| Item                                    | Valor                                               |
| --------------------------------------- | --------------------------------------------------- |
| Caminho informado                       | `C:\HC Quality`                                     |
| Caminho canônico no disco (Windows)     | `c:\hc quality` (mesmo diretório, case-insensitive) |
| É repositório Git do projeto HC Quality | Sim                                                 |

---

## 2. Critério Obsidian para “raiz do vault”

Um diretório é a **raiz de um vault Obsidian** quando contém a pasta oculta **`.obsidian/`** (configuração do app: `app.json`, `workspace.json`, plugins, etc.).

---

## 3. Busca por `.obsidian/` em `C:\HC Quality`

| Método                                                                      | Resultado                    |
| --------------------------------------------------------------------------- | ---------------------------- |
| Busca por arquivos `**/.obsidian/**` sob `c:\hc quality`                    | **Nenhum resultado**         |
| `Get-ChildItem -Recurse -Filter ".obsidian" -Directory` sob `C:\HC Quality` | **Nenhuma pasta encontrada** |
| `dir /a /s` explícito para `c:\hc quality\.obsidian`                        | **Não existe**               |

**Conclusão Fase 0:** `C:\HC Quality` **não** é, neste momento, a raiz de um vault Obsidian (ausência de `.obsidian/`).

> Implicação: as Fases 1–6 da missão (inventário de PDFs/vídeos do **vault**, MOCs em `_meta/`, etc.) **não têm vault Obsidian definido neste diretório** até você criar um vault aqui (Obsidian: “Open folder as vault”) ou **corrigir o caminho do vault** para a pasta que realmente contém `.obsidian/`.

---

## 4. Vault Obsidian já existente no ambiente (referência cruzada)

Foi localizada **uma** pasta com `.obsidian/` usada anteriormente no contexto HC Quality:

| Campo                  | Valor                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Caminho raiz candidato | `C:\Users\labcl\Obsidian_Brain`                                                                 |
| Evidência              | Presença de `.obsidian\` (ex.: `app.json`, `workspace.json`, `community-plugins.json`, plugins) |

**Esta Fase 0 não define** esse caminho como “oficial” para a missão — apenas registra achado para **sua aprovação** na próxima etapa: ou o vault da missão é `Obsidian_Brain`, ou você inicializa vault em `C:\HC Quality`, ou indica outro caminho.

---

## 5. Onde este arquivo foi gravado

- **Caminho:** `c:\hc quality\_meta\00-auditoria.md` (dentro do repositório do projeto).

Motivo: a missão ancorou o trabalho em `C:\HC Quality`; o inventário Fase 0 fica versionável com o código. Se o vault real for outro diretório, na Fase 1 pode-se **copiar ou espelhar** `_meta/` para a raiz do vault escolhido, após sua decisão.

---

## 6. Próximo passo (aguardando aprovação)

- [ ] **Aprovação explícita** para **Fase 1** com um dos caminhos:
  - **A)** Tratar `C:\HC Quality` como alvo: aceitar que ainda não é vault Obsidian e fazer Fase 1 só sobre arquivos do repo (sem MOCs Obsidian nativos até existir `.obsidian/`), **ou**
  - **B)** Redefinir raiz do vault para `C:\Users\labcl\Obsidian_Brain` (ou outro caminho que você indicar contendo `.obsidian/`), e executar Fase 1 **lá**.

**Status:** Fase 0 concluída — **pausado até sua aprovação** para prosseguir.
