# Phase 6: Operational Guide for RT — Critical Values Management

**Version:** 1.0  
**For:** Responsável Técnico (RT), Supervisores de Turno  
**Date:** 2026-05-07  
**Language:** Português (with English terms for system UI)  

---

## 1. Visão Geral

O módulo **Críticos** do HC Quality automatiza a detecção e escalação de resultados críticos de laboratório para médicos solicitantes e supervisores técnicos via SMS + email.

**Quando um resultado crítico é detectado:**

1. SMS é enviado automaticamente ao médico solicitante (dentro de 30 segundos)
2. Email é enviado ao RT de plantão
3. Laudo é marcado como "CRÍTICO" no dashboard
4. Um relógio SLA começa (meta: reconhecimento em X minutos, configurável)
5. Se condição for reportável (RDC 978): rascunho NOTIVISA é gerado para revisão RT

**Seu papel:** Monitorar escalações, reconhecer críticos, investigar atrasos, ajustar limiares.

---

## 2. Acessando o Dashboard de Críticos

### URL

```
https://hmatologia2.web.app/criticos
```

### Permissões Requeridas

- Papel: **RT** (Responsável Técnico) ou **Auditor**
- Lab: acesso ao lab onde o crítico foi detectado

### Estrutura da Tela

```
┌─────────────────────────────────────────────────┐
│ HC Quality — Críticos                           │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Abas]                                          │
│  ✓ Escalações Pendentes                         │
│  □ Histórico (últimas 30 dias)                 │
│  □ Limiares Críticos (administração)            │
│  □ NOTIVISA (rascunhos)                         │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Filtros:  [Data de/até] [Paciente] [Analito]  │
│                                                 │
│ Tabela: Escalações                              │
│ ┌──────────────────────────────────────────┐   │
│ │ Paciente | Analito | Valor | SLA | Status│   │
│ ├──────────────────────────────────────────┤   │
│ │ João    │ Glicose │ 487   │ 🔴  │ Enviado│   │
│ │ Maria   │ K+      │ 2.1   │ 🟡  │ Enviado│   │
│ │ Pedro   │ TTPa    │ >180  │ 🟢  │ Ack ✓  │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 3. Interpretando o Status SLA

### Cores de Status

| Cor | Significado | Tempo Decorrido | Ação |
|-----|-------------|-----------------|------|
| 🟢 **Verde** | Em prazo | < 50% SLA | Monitorar |
| 🟡 **Amarelo** | Atenção | 50-100% SLA | Revisar agora |
| 🔴 **Vermelho** | Vencido | > 100% SLA | URGENTE |

### Exemplo: SLA 30 minutos

- **Detectado** às 14:00:00
- **14:15** → 🟡 Amarelo (15 min = 50%)
- **14:30** → 🔴 Vermelho (30 min = 100%, SLA vencido)
- **Ação:** Email de alerta RT enviado automaticamente
- **Ação manual:** RT clica "Reenviar" para escalar via email direto ao médico

---

## 4. Fluxo de Trabalho Padrão

### Cenário 1: Crítico Detectado — Médico Disponível

**Tempo: T+0 a T+10 min**

```
1. Sistema detecta crítico no laudo
   ↓
2. SMS enviado ao médico: "HC Qualidade CRÍTICO | Paciente: João | 
   Analito: Glicose | Valor: 487 mg/dL | Responda RECONHECER"
   ↓
3. RT recebe email: "[CRÍTICO] João Glicose — Ação Requerida"
   ↓
4. Dashboard mostra laudo marcado 🔴 CRÍTICO, escalação com status "Enviado"
   ↓
5. Médico responde SMS com "RECONHECER" (ou clica link no portal)
   ↓
6. Escalação atualiza para status "Reconhecido ✓"
   
   FIM — SLA atendido ✓
```

### Cenário 2: SMS Falha — Fallback para Email

**Tempo: T+0 a T+10 min**

```
1. Sistema detecta crítico
   ↓
2. SMS enviado a médico, mas número é inválido
   ↓
3. Tentativa SMS FALHA (invalid_number)
   ↓
4. Sistema aguarda 5 min (próximo ciclo cron)
   ↓
5. Cron verifica: SMS ainda não entregue após 5+ min
   ↓
6. Escalação para Email (AUTOMÁTICO)
   ↓
7. Email enviado ao médico com mesmo conteúdo + link para portal
   ↓
8. Dashboard mostra: "Escalação 1 (SMS) FALHA | Escalação 2 (Email) ENVIADO"
   
   Próxima ação: Monitore reconhecimento
```

### Cenário 3: SLA Vencido — Ação Manual RT

**Tempo: T+30 min (se SLA target = 30 min)**

```
1. Crítico criado às 14:00
   ↓
2. SMS/Email enviados, mas médico não respondeu
   ↓
3. Às 14:30, cron detecta: SLA VENCIDO
   ↓
4. Email de alerta enviado a RT: "[URGENTE] SLA Crítico Vencido"
   ↓
5. RT abre dashboard:
      Escalação está 🔴 RED, SLA vencido
      Botão disponível: "Reenviar via [SMS|EMAIL]"
   ↓
6. RT clica "Reenviar via EMAIL", adiciona nota: 
   "Contato telefônico não obtido, enviando via email"
   ↓
7. Novo email enviado (escalação tentativa 2)
   ↓
8. Monitore reconhecimento
```

---

## 5. Ações no Dashboard

### Ação 1: Confirmar Leitura (Acknowledge)

**Quando usar:** Você (RT) confirmou que o crítico foi notificado e acompanhado adequadamente.

**Passos:**

1. Na tabela, localize a escalação (status "Enviado")
2. Clique em [Confirmar Leitura] ou [✓ Acknowledge]
3. Sistema marca com ✓ Verde, registra timestamp + seu ID
4. Email de confirmação enviado ao arquivo

**Nota:** Isso NÃO cancela o crítico — apenas marca que foi notificado. O laudo continua em processamento até RT liberar resultado final.

---

### Ação 2: Reenviar Escalação

**Quando usar:** SMS falhou, médico não respondeu, ou precisa reescalar.

**Passos:**

1. Clique em [Reenviar via EMAIL] (ou [Reenviar via SMS] se número foi atualizado)
2. Campo nota: "Motivo da reescalação" (ex: "Número trocado", "Sem resposta")
3. Clique [Reenviar]
4. Sistema cria nova tentativa (escalação #2, #3, etc)
5. Dashboard mostra histórico: "Escalação 1 SMS FALHA → Escalação 2 EMAIL ENVIADO"

---

### Ação 3: Cancelar Escalação

**Quando usar:** Resultado foi corrigido, é falso alarme, ou paciente já foi atendido.

**Passos:**

1. Clique em [Cancelar]
2. Campo obrigatório: "Motivo" (ex: "Resultado corrigido pela analisadora")
3. Clique [Confirmar Cancelamento]
4. Escalação marcada com ❌ Cancelado
5. SMS/Email pendentes são descartados (se ainda não entregues)

---

### Ação 4: Visualizar Detalhes da Escalação

**O que mostra:**

- Paciente (nome, idade, sexo)
- Analito crítico (nome, valor obtido, unidade, limiar)
- Médico solicitante (nome, telefone, email)
- Histórico de tentativas (SMS/Email com timestamps)
- SLA metrics (tempo decorrido, status)
- Qualquer NOTIVISA draft vinculado

**Atalho:** Clique na linha da escalação para expandir detalhes.

---

## 6. Configurando Limiares Críticos

### Quando fazer isso

- **Novo analito** adicionado ao lab
- **Recomendação clínica** mudou (ex: diabetes control mais rígido)
- **False positives** frequentes (limiar muito baixo)

### Passo a passo

1. No dashboard, clique na aba **Limiares Críticos**
2. Tabela mostra todos os limiares ativos para seu lab
3. Para editar existente: clique na linha, modifique min/max, clique [Salvar]
4. Para adicionar novo:
   - Clique [+ Novo Limiar]
   - Selecione analito (dropdown)
   - Informe min/max
   - Marque severidade (Alta/Baixa)
   - Opcionalmente: filtro por idade/sexo
   - Clique [Criar]

### Campos

| Campo | Tipo | Obrigatório | Exemplo | Notas |
|-------|------|-------------|---------|-------|
| Analito | Dropdown | Sim | Glicose | Puxado da biblioteca de bulas |
| Min | Número | Não | 40 | Deixar em branco = sem limite inferior |
| Max | Número | Não | 400 | Deixar em branco = sem limite superior |
| Severidade | Radio | Sim | Alta | Alta = life-threatening, Baixa = action required |
| Idade Min | Número | Não | 18 | Filter: só aplica a pacientes ≥ 18 anos |
| Idade Max | Número | Não | 65 | Filter: só aplica a pacientes ≤ 65 anos |
| Sexo | Dropdown | Não | M | Filter: só aplica a este sexo |
| Ativo | Toggle | Sim | ✓ On | Turn off = não dispara críticos |

### Exemplo: Glicose Pós-Prandial

```
Analito: Glicose
Min: 70
Max: 200
Severidade: Alta
Idade Min: 18
Idade Max: 99
Sexo: (todos)
Ativo: ✓

→ Aplica a qualquer paciente adulto com glicose < 70 ou > 200
```

### Exemplo: Glicose em Neonatos

```
Analito: Glicose
Min: 40
Max: 150
Severidade: Baixa
Idade Min: 0
Idade Max: 7 dias
Sexo: (todos)
Ativo: ✓

→ Aplica só a neonatos, severidade "Baixa" (investigar, não emergency)
```

---

## 7. Rastreando NOTIVISA

### O que é NOTIVISA

RDC 978/2025 exige notificação à ANVISA de certas condições críticas (desvios, falhas de equipamento, contaminação).

**Sistema HC Quality:** Detecta automaticamente quando uma condição é reportável, gera rascunho pré-preenchido para você revisar + enviar.

### Aba NOTIVISA no Dashboard

1. Clique em aba **NOTIVISA**
2. Mostra rascunhos gerados a partir de críticos reportáveis
3. Status de cada rascunho:
   - **Rascunho** = pronto para revisar
   - **Sob Revisão** = você abriu para edição
   - **Enviado** = enviado à ANVISA
   - **Cancelado** = false alarm, não reportável

### Fluxo: Revisar + Enviar NOTIVISA

1. Clique em rascunho com status "Rascunho"
2. Revise campos pré-preenchidos (já tem: paciente, analito, valor, lab)
3. Complete campos adicionais conforme necessário:
   - **Tipo de Desvio** (ex: "Resultado Critical - Ação Requerida")
   - **Descrição detalhada** (ex: "Paciente diabético com glicose 487; médico notificado SMS")
   - **Critérios de Risco** (checkboxes: risco paciente? risco produto? risco processo?)
4. Clique [Enviar para ANVISA]
5. Sistema submete automaticamente via API NOTIVISA (v1.5)
6. Status muda para "Enviado", timestamp registrado

---

## 8. Alertas de Email Automáticos

### Você recebe quando...

| Tipo de Email | Trigger | Ação Sugerida |
|---|---|---|
| **Crítico Detectado** | Nova escalação criada | Verify SMS sent; monitor SLA |
| **SLA Vencido** | T > SLA target | REENVIAR via email AGORA |
| **SMS Falha** | Após 10 min, SMS não entregue | Revisar número, reenviar email |
| **NOTIVISA Rascunho** | Condição reportável detectada | Revisar e enviar em 24h |

### Não Ignorar

- 🔴 **SLA Vencido** — significa médico não respondeu no prazo. Ação imediata necessária.
- 🔴 **NOTIVISA Rascunho** — RDC 978 exige resposta em prazo; arquive tudo com comprovante.

---

## 9. Troubleshooting

### Problema: SMS não foi enviado

**Sintomas:**
- Escalação mostra "Enviado" mas médico diz não recebeu SMS

**Causas possíveis:**
1. Número de telefone inválido (não É.164: +55XXXXXXXXXX)
2. Twilio bloqueou (operadora problemas, número banido)
3. Médico bloqueou SMS originário da Twilio

**Solução:**
1. Abra detalhes escalação
2. Verifique campo "Médico Telefone": deve ser `+55 98XXXXXXXX`
3. Se incorreto: clique [Reenviar], escolha [EMAIL]
4. Se correto: contacte CTO para verificar Twilio logs
5. Atualizar número médico no laudo para futuras escalações

---

### Problema: Muitos falsos positivos

**Sintomas:**
- 5+ críticos por dia, todos "saudáveis" (ex: glicose 201 em diabético)

**Solução:**
1. Aba Limiares Críticos
2. Ajuste max para cima (ex: 200 → 250)
3. Considere adicionar filtro condicional (ex: se diabético anotado, max=300)
4. Log de mudança automático (audit trail) — não é problema

---

### Problema: Médico perdeu SMS

**Sintomas:**
- Escalação mostra "Enviado", medico diz não viu

**Ações:**
1. Dashboard → [Reenviar via EMAIL]
2. Nota: "SMS original enviado, reenviando via email"
3. Contactar médico por tel/whatsapp (backup manual)

---

### Problema: SLA muito rígido/frouxo

**Sintomas:**
- SLA 30 min é muito curto / muito longo para seu fluxo

**Solução:**
1. Você (RT) não configura SLA — é config lab-wide
2. Contactar CTO/Supervisor: pedir mudança em labSettings
3. Comum: 30 min (emergência alta), 60 min (ação requerida)

---

## 10. Compliance & Audit

### RDC 978 Art. 128: Ações Corretivas

Cada escalação crítica é rastreada para auditoria:

- ✓ Que resultado foi crítico?
- ✓ Quando foi detectado?
- ✓ SMS/Email foi enviado? Timestamp?
- ✓ Médico/RT reconheceu? Quando?
- ✓ Quanto tempo levou (SLA)?
- ✓ Se reportável: NOTIVISA foi enviado?

**Sistema guarda tudo automaticamente.**

### LGPD — Sua Responsabilidade

Dados de paciente em críticos são:
- ✓ Necessários (contato com médico é obrigação clinica)
- ✓ Auditados (trilha completa de quem acessou)
- ✓ Retidos por 5 anos (retenção legal)

**Não compartilhe escalações fora do HC Quality.** PDF export é auditado.

---

## 11. Checklist Diário (RT)

**Start of shift:**

- [ ] Abra dashboard críticos: `/criticos`
- [ ] Filtre por "Status = Enviado" + "SLA = Vencido"
- [ ] Se houver: clique em cada um, reenvie via EMAIL com nota
- [ ] Marque como "Reconhecido ✓" após ação

**Throughout day:**

- [ ] Monitore emails de alerta (SLA vencido)
- [ ] Se SMS falhar: reenvie email
- [ ] Se NOTIVISA rascunho: revise em 1h (RDC 978 compliance)

**End of shift:**

- [ ] Filtre por data = hoje
- [ ] Total escalações hoje? (for log)
- [ ] Algum vencido? (escalate to supervisor)
- [ ] Passar informação ao próximo turno

---

## 12. Contatos de Suporte

| Situação | Contacte | Como |
|---|---|---|
| **Dúvida sobre função** | Tech Support | Slack #hc-quality |
| **Número Twilio não funciona** | CTO | Email drogafarto@gmail.com |
| **Quero ajustar SLA** | Supervisor Técnico | In-person |
| **Quero novo analito crítico** | CTO + Bioquímico | Meeting + design approval |
| **Suspeita de bug** | QA Team | GitHub issue + screenshot |

---

## 13. Quick Reference Card (Print & Post)

```
┌──────────────────────────────────────────┐
│      HC Quality — Críticos v1.4           │
│      Quick Reference for RT               │
├──────────────────────────────────────────┤
│                                           │
│ DASHBOARD:                                │
│ https://hmatologia2.web.app/criticos     │
│                                           │
│ COLORS:                                   │
│ 🟢 Em prazo   | 🟡 Atenção  | 🔴 Vencido  │
│                                           │
│ ACTIONS:                                  │
│ ✓ Acknowledge = "Confirmar Leitura"      │
│ 📧 Retry = "Reenviar via EMAIL"          │
│ ❌ Cancel = "Cancelar"                    │
│                                           │
│ ALERTS (you will receive):                │
│ 🟡 SLA Atenção (50% elapsed)              │
│ 🔴 SLA Vencido (100% elapsed)             │
│ 📋 NOTIVISA Rascunho (reportable)        │
│                                           │
│ IF SLA VENCIDO:                           │
│ 1. Click escalação                        │
│ 2. Click [Reenviar via EMAIL]            │
│ 3. Add note: reason                       │
│ 4. Click [Reenviar]                       │
│                                           │
│ IF SMS FAILS:                             │
│ 1. Wait cron (5 min)                      │
│ 2. Email fallback sent auto               │
│ 3. Monitor for acknowledge               │
│                                           │
└──────────────────────────────────────────┘
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Language:** Português + English UI  
**Audience:** RT, Supervisores de Turno, Auditors
