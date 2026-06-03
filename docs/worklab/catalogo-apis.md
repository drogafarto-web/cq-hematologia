# Worklab — Catálogo de APIs e Endpoints

> Descobertos via análise da conversa WhatsApp e observação de comportamento do sistema.

---

## URLs Base

| Ambiente          | URL                                     |
| ----------------- | --------------------------------------- |
| Produção (staff)  | `https://www.worklabweb.com.br/`        |
| Produção (mobile) | `https://m.worklabweb.com.br/`          |
| Portal Resultados | `https://portal.worklabweb.com.br/`     |
| Homologação       | `https://hmg.worklabweb.com.br/`        |
| Suporte / KB      | `https://criasoft.movidesk.com/kb/`     |
| Suporte (site)    | `https://worklabweb.com.br/suporte.php` |

---

## Endpoints de Autenticação

### Login (Staff)

```
POST https://www.worklabweb.com.br/
Content-Type: application/x-www-form-urlencoded

# Login antigo
username={labId}/{usuario}   # Ex: 386/BRUNO
password={senha}

# Novo login (2FA obrigatório desde 07/07/2025)
new_login_cliente={labId}    # Ex: 386
new_login_username={usuario}  # Ex: BRUNO
new_login_password={senha}
```

**Respostas conhecidas:**

- `200` + página de login → credenciais inválidas
- `302` → redirecionamento para dashboard (login OK)

**Regras 2FA (desde 07/07/2025):**

- Código temporário enviado por email ou via Google/Microsoft Authenticator
- Obrigatório para todos os perfis (Gestor, Supervisor, Atendente)
- Recuperação de senha apenas via email cadastrado

---

## Portal de Resultados (Pacientes)

### Acesso a Resultados

```
GET https://portal.worklabweb.com.br/resultados/{labId}?c={examCode}&p={hash}

Parâmetros:
  labId    = 386 (LabClin Rio Pomba)
  examCode = Código sequencial do exame (ex: 0094270)
  hash     = Hash de segurança (ex: 7b129c)
```

**Exemplo real:**
`https://portal.worklabweb.com.br/resultados/386?c=0094270&p=7b129c`

### Impressão de Resultado

```
GET https://portal.worklabweb.com.br/resultados-on-line/print/{id}?v={timestamp}

Parâmetros:
  id        = ID do resultado (ex: 64271, 92550)
  timestamp = Timestamp Unix em ms (ex: 1745856008330)
```

**Exemplos reais:**

- `https://portal.worklabweb.com.br/resultados-on-line/print/64271?v=1745856008330`
- `https://portal.worklabweb.com.br/resultados-on-line/print/92550?v=1745856139972`

---

## APIs Solicitadas (não confirmadas como obtidas)

### API de Mensagens WhatsApp

**Solicitada por Bruno em 03/2024 (linha 38686)**

Finalidade: integrar mensagens automáticas ao bot WhatsApp do LabClin

APIs desejadas:

1. **API de aviso de exame pronto** — notificar paciente quando resultado é liberado
2. **API de aviso de boas-vindas** — notificar paciente após cadastro
3. **API de resultados** — consultar resultados via API

Mensagem enviada ao suporte Criasoft (linha 38762):

> "Gostaria de obter informações sobre as APIs disponíveis para o aviso de exame pronto e o aviso de boas-vindas no atendimento inicial de cadastro. Precisamos dessas integrações para automatizar as mensagens em nosso sistema de atendimento via WhatsApp."

Status: **não confirmado** se as APIs foram fornecidas.

### API de Exames (site)

**Solicitada em 12/2023 (linha 35011)**

Finalidade: colocar resultados de exames no site do LabClin

Status: **não confirmado**

---

## Mensagens Automáticas do Worklab

### Formato — Exames Prontos (2024+)

```
Olá, {NOME_DO_PACIENTE}! Os resultados dos exames realizados no
LABCLIN RIO POMBA estão prontos. Para visualizar acesse o link:
https://portal.worklabweb.com.br/resultados/386?c={CODE}&p={HASH}
```

Seguido de:

```
Por favor, se puder, nos ajude a melhorar preenchendo rapidamente
nosso pequeno formulário de avaliação: {link_pesquisa}
```

### Formato — Exames Prontos (anterior a 2024)

```
Olá, {NOME}! LABCLIN RIO POMBA informa: Os resultados dos seus exames
estão prontos e podem ser visualizados através do link:
https://portal.worklabweb.com.br/resultados/386?c={CODE}&p={HASH}
```

### Formato — Resultados Impressos

```
Acesso aos Resultados: Acompanhe o andamento dos seus resultados
através do link:
https://portal.worklabweb.com.br/resultados/386?c={CODE}&p={HASH}.

Dúvidas? Entre em contato conosco pelo (32)991990239 ou llabclin3@gmail.com.
```

---

## Integração DB Diagnósticos

### Fluxo de Integração

```
Worklab → DB (envio de exames para processamento)
DB → Worklab (retorno de resultados processados)
```

**Características:**

- Integração automática e bidirecional
- Exames sem "região de coleta" são rejeitados pelo DB
- Teste de paternidade NÃO integra (feito no portal DB)
- Quando DB instável, exames não são integrados e laudos atrasam
- Faturamento do DB conferido vs Worklab periodicamente

---

## Interfaceamento de Equipamentos

### Yumizen H550 (Hematologia)

- Interfaceamento instalado pela Criasoft
- Arquivos de configuração no PC do equipamento
- Ao trocar PC, necessário fazer backup dos arquivos de interface

### Bioquímica A15

- Interfaceamento via arquivos no PC do equipamento
- Mudança de PC (01/2024): necessário copiar arquivos de configuração
- Pergunta enviada ao suporte: "Como salvar arquivos ao migrar PC mantendo interface?"

---

## Observações Técnicas

1. **APIs não são públicas** — Bruno solicitou acesso formal via suporte, indica que não há documentação pública
2. **URL do portal usa query params** (`c` e `p`) — hash `p` é aparentemente um identificador curto (6 chars hex)
3. **Timestamps** usados em URLs de impressão (`?v=`) — provavelmente para cache-busting
4. **Senhas por posto de coleta** — cada unidade tem credenciais independentes
5. **Movidesk é a plataforma de suporte** — KB em `criasoft.movidesk.com/kb/`
