# Worklab Criasoft — Documentação Completa

> Extraído de conversa WhatsApp LabClin Rio Pomba (jun/2021—mai/2026).  
> Fonte: `Conversa do WhatsApp com Laboratorio.zip` (3.5MB, 66K+ linhas)

## Visão Geral

| Item                  | Valor                            |
| --------------------- | -------------------------------- |
| Desenvolvedor         | Criasoft Sistemas                |
| Nome                  | Worklab (LIS)                    |
| Cliente               | LabClin Rio Pomba (ID 386)       |
| Hospedagem            | AWS (Amazon Web Services)        |
| URLs                  | ver [mapa-urls.md](mapa-urls.md) |
| Primeira data no chat | 24/05/2021                       |
| Última data no chat   | 18/05/2026                       |

## Mapa de Navegação (BFS Inferido)

```
Login (386/BRUNO)
 ├─ Dashboard
 ├─ Cadastros
 │   ├─ Cadastro de Pacientes
 │   ├─ Cadastro de Médicos
 │   ├─ Cadastro de Convênios
 │   ├─ Cadastro de Exames
 │   └─ Cadastro de Postos de Coleta
 ├─ Movimento
 │   ├─ Coleta (domicílio, posto, COVID)
 │   ├─ Triagem de Amostras
 │   ├─ Setores Técnicos
 │   │   ├─ Hematologia (interface Yumizen H550)
 │   │   ├─ Bioquímica (interface Bioquímica A15)
 │   │   ├─ Imunologia / Sorologia
 │   │   ├─ Uroanálise
 │   │   ├─ Coagulação
 │   │   ├─ Parasitologia
 │   │   └─ Microbiologia
 │   ├─ Conferir Resultados
 │   ├─ Liberação de Laudos
 │   └─ Impressão de Laudos
 ├─ Faturamento
 │   ├─ Por Convênio
 │   ├─ Por Unidade
 │   ├─ Particular
 │   └─ Relatórios Fiscais
 ├─ Portal Resultados
 │   ├─ Pacientes (portal.worklabweb.com.br)
 │   └─ Impressão Online
 ├─ Qualidade
 │   ├─ Controle Interno (CIQ)
 │   ├─ NOTIVISA
 │   └─ Rastreabilidade
 ├─ Administração
 │   ├─ Permissões de Usuários
 │   ├─ Postos de Coleta (senhas por unidade)
 │   ├─ Logs de Acesso
 │   └─ Relatórios de Preços
 └─ Suporte
     ├─ Abertura de Chamado
     ├─ Base de Conhecimento (Movidesk)
     └─ Chat/Suporte Técnico
```

## Unidades / Postos de Coleta

| Unidade           | Sigla | Status                 |
| ----------------- | ----- | ---------------------- |
| LabClin Rio Pomba | CTL   | Central (matriz)       |
| Guarani           | GUA   | Posto de coleta        |
| Silveirânia       | SIL   | Posto de coleta        |
| Mercês            | MRC   | Posto de coleta        |
| Carangola         | —     | Mencionada (licitação) |

Cada posto de coleta tem sua **própria senha de acesso ao Worklab**, definida no cadastro do posto.

## Interfaceamento com Equipamentos

| Equipamento    | Módulo      | Status    | Observações                                                   |
| -------------- | ----------- | --------- | ------------------------------------------------------------- |
| Yumizen H550   | Hematologia | Integrado | Interface via Criasoft; backup necessário ao trocar PC        |
| Bioquímica A15 | Bioquímica  | Integrado | Arquivos no PC do equipamento; necessário salvar ao migrar PC |

## Integrações Externas

| Sistema                 | Tipo                     | Direção                |
| ----------------------- | ------------------------ | ---------------------- |
| DB Diagnósticos (Apoio) | Interface automática     | Worklab → DB → Worklab |
| WhatsApp                | Mensagens automáticas    | Worklab → Paciente     |
| NOTIVISA                | Protocolo de notificação | Worklab → ANVISA       |
| Memed                   | Prescrição digital       | Recebe PDF             |

### Integração DB Diagnósticos (Apoio Laboratorial)

- Worklab envia exames para DB via integração automática
- DB processa e devolve resultados para Worklab
- **Falhas conhecidas:** instabilidade do DB bloqueia integração; exames sem "região de coleta" rejeitados pelo DB
- Nem todos os exames são integrados (ex: teste de paternidade é feito no portal DB, não integra)
- Faturamento do DB é conferido vs Worklab periodicamente

### Mensagens WhatsApp Automáticas

- **Boas-vindas:** enviada após cadastro do paciente
- **Exames prontos:** enviada quando resultado é liberado, com link:  
  `https://portal.worklabweb.com.br/resultados/{labId}?c={code}&p={hash}`

Bruno solicitou API para integrar essas mensagens ao bot de WhatsApp (linha 38686, 38762).

## Fluxos Operacionais

### 1. Cadastro de Paciente → Resultado

```
1. Recepção cadastra paciente no Worklab
2. Worklab envia WhatsApp de boas-vindas (automático)
3. Paciente é encaminhado para coleta
4. Amostra é triada (etiquetada, conferida)
5. Exames são executados nos setores técnicos
   (hematologia via Yumizen interface, bioquímica via A15)
6. Resultado é revisado ("conferir resultados")
7. RT libera o laudo
8. Worklab envia WhatsApp "exames prontos" com link
9. Paciente acessa portal de resultados
```

### 2. Faturamento de Unidade (ex: Guarani)

```
1. Faturamento total da unidade é calculado no Worklab
2. Separado por convênio (Unimed, Plasc, GEAP, Energisa, etc.)
3. Impostos Simples calculados (alíquota varia mensalmente)
4. NF emitida e enviada
5. Repasse de 5% sobre faturamento (comissão unidade)
```

### 3. Exames Terceirizados (DB)

```
1. Exame cadastrado no Worklab como terceirizado
2. Amostra coletada e enviada ao DB
3. Resultado é integrado de volta ao Worklab
4. Se integração falha → suporte Criasoft acionado
5. Laudo é conferido e liberado pelo RT
```

## Funcionalidades Identificadas

### Conferir Resultados

- Menu específico "Conferir resultados"
- Código de atalho mencionado: `104718`
- Uso: RT revisa exames antes da liberação

### Faturamento

- Por convênio (Unimed, Plasc, GEAP, Energisa, SUS, Particular)
- Por período (mensal)
- Por unidade/posto de coleta
- Cálculo de impostos Simples (alíquota variável)
- Relatórios para contabilidade

### Impressão de Laudos

- Laudos impressos direto do Worklab
- QR Code nos laudos (link para resultado online)
- Impressão térmica suportada (solicitada em 06/2024)
- URL de impressão: `/resultados-on-line/print/{id}?v={timestamp}`

### Permissões

- Gestor (acesso total)
- Supervisor
- Atendente
- Cada posto de coleta tem senha própria
- Relatório de permissões de usuários foi solicitado (linha 45569)

### 2FA (desde 07/07/2025)

- Obrigatório para todos os acessos
- Métodos: email ou Google/Microsoft Authenticator
- Reset de senha só via email cadastrado

### Caixa

- Módulo descrito como "falho" (linha 63375)
- Pagamentos registrados manualmente

## Dependências Conhecidas

| Sistema           | Impacto se offline                                                |
| ----------------- | ----------------------------------------------------------------- |
| AWS               | Worklab inteiro offline (já ocorreu com Minastel bloqueando rota) |
| DB Diagnósticos   | Exames terceirizados não integram; laudos atrasam                 |
| Internet do posto | Sem acesso ao Worklab; coleta manual                              |

## Histórico de Problemas

| Data       | Problema                                         | Resolução                  |
| ---------- | ------------------------------------------------ | -------------------------- |
| 10/05/2023 | Minastel bloqueou rota AWS                       | Proxy alternativo (kproxy) |
| 10/05/2023 | Instabilidade rota Brasil→AWS                    | Comunicado Criasoft        |
| 01/2024    | Troca PC Bioquímica A15                          | Backup arquivos interface  |
| 04/2025    | DB instável, integração parou                    | Aguardou DB normalizar     |
| 03/2026    | Exame rejeitado por "região de coleta em branco" | Contestação ao DB          |

## Pontos de Melhoria Identificados

1. Caixa "falho" — precisa de verificação/melhoria
2. API WhatsApp para integração externa (solicitada mas não obtida)
3. Relatório de permissões de usuários (solicitado)
4. Integração com leitor de código de barras para coleta (solicitado)
5. Layout de laudos com ajuste de espaçamento de métodos
6. QR Code com resultados de exames antigos (não implementado)
7. Cadastro de exames demorado (SUS 30min)
8. Texto da mensagem de "exames prontos" fixo (solicitado alteração)
