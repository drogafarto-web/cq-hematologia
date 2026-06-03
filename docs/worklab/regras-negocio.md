# Worklab — Catálogo de Regras de Negócio

> Extraídas da conversa WhatsApp LabClin Rio Pomba (2021-2026).

---

## Autenticação e Acesso

### RN-AUTH-001: Formato de Username

Usuários staff usam o formato `{labId}/{NOME}`, ex: `386/BRUNO`. O campo no login antigo tem máscara `###/#######################`.

### RN-AUTH-002: Senhas por Posto de Coleta

Cada unidade/posto de coleta possui sua **própria senha de acesso** ao Worklab, definida no momento do cadastro do posto. (linha 32171)

### RN-AUTH-003: 2FA Obrigatório (desde 07/07/2025)

Autenticação de dois fatores é obrigatória para **todos os perfis** (Gestor, Supervisor, Atendente). Código via email ou Google/Microsoft Authenticator. Reset de senha apenas via email cadastrado. (linha 56261-56273)

### RN-AUTH-004: Perfis de Acesso

Três níveis identificados: Gestor (total), Supervisor (operações), Atendente (recepção/coleta).

---

## Cadastro e Pacientes

### RN-CAD-001: Cadastro SUS

Cadastro de paciente pelo SUS pode levar até 30 minutos devido à complexidade do sistema. (linha 2003)

### RN-CAD-002: WhatsApp Boas-Vindas

Mensagem automática de boas-vindas é enviada via WhatsApp logo após o cadastro do paciente. (linha 38153)

### RN-CAD-003: Cada Posto Opera Independentemente

Postos de coleta têm autonomia para cadastrar pacientes, coletar e faturar. Dados são consolidados na unidade central (Rio Pomba).

---

## Coleta

### RN-COL-001: Amostras por Posto

Cada posto de coleta gerencia suas próprias amostras. Exames podem ser coletados em domicílio, no posto, ou na central.

### RN-COL-002: Material e Região de Coleta

Para exames integrados com DB, é obrigatório informar material (ex: soro) e região de coleta (ex: sangue venoso). Se região ficar em branco, o DB rejeita a integração. (linha 65125-65126)

---

## Resultados e Laudos

### RN-RES-001: Conferência antes da Liberação

Resultados devem ser conferidos pelo RT antes da liberação. Workflow: acessar "Conferir resultados" → localizar exame (ex: código 104718) → conferir → liberar. (linha 65002)

### RN-RES-002: WhatsApp Exames Prontos

Ao liberar resultado, Worklab envia automaticamente WhatsApp ao paciente com link para o portal de resultados.

### RN-RES-003: Portal de Resultados

Pacientes acessam resultados via URL única: `https://portal.worklabweb.com.br/resultados/386?c={code}&p={hash}`. O hash `p` é um identificador de segurança de 6 caracteres hex.

### RN-RES-004: Impressão de Laudos

Laudos são impressos diretamente do Worklab. Suporte para impressora térmica foi solicitado. Layout de laudos pode ter problemas de espaçamento de métodos longos. (linha 44651, 43017)

### RN-RES-005: QR Code nos Laudos

QR Code nos laudos físicos redireciona para o resultado online. Não é possível incluir exames antigos no QR Code. (linha 2360, 3170)

### RN-RES-006: Laudos DB

Exames terceirizados aparecem no Worklab com os dados recebidos do DB. O título "DB Diagnósticos" é fixo no laudo e não pode ser removido sem a Criasoft. (linha 26951)

---

## Faturamento

### RN-FAT-001: Faturamento por Unidade e Convênio

Cada posto de coleta tem faturamento separado por convênio (Unimed, Plasc, GEAP, Energisa, SUS, Particular). Relatório mensal consolida por unidade. (linha 1014-1033)

### RN-FAT-002: Impostos Simples Variáveis

A alíquota do Simples Nacional varia mensalmente conforme o faturamento acumulado (ex: 7,4% em janeiro, 17% em julho). Contabilidade informa a alíquota do mês. (linha 2414)

### RN-FAT-003: Repasse 5% aos Postos

Unidades/posto de coleta recebem 5% de comissão sobre o faturamento bruto. NF emitida separadamente. (linha 1016, 1893)

### RN-FAT-004: Toxiológico

Valor de repasse do toxicológico é 50% (ex: R$80 cobrado, R$40 repassado ao DB). Pode ser faturado em meses posteriores à coleta. (linha 2432-2433)

### RN-FAT-005: Caixa

Módulo de caixa do Worklab foi descrito como "falho" (linha 63375), indicando problemas de confiabilidade.

---

## Integrações

### RN-INT-001: Integração DB não é Total

Nem todos os exames são integrados com DB. Teste de paternidade, por exemplo, é feito diretamente no portal DB. (linha 42733)

### RN-INT-002: Interfaceamento de Equipamentos

Ao trocar o PC de um equipamento interfaceado (ex: Bioquímica A15, Yumizen H550), é necessário preservar os arquivos de configuração da interface para não perder a integração. (linha 36957-36974)

### RN-INT-003: Códigos Não Devem Ser Alterados

Alterar códigos no interfaceamento ou no Worklab sem consulta pode quebrar a rastreabilidade e causar problemas nos laudos. (linha 26440-26443)

### RN-INT-004: DB Instável Bloqueia Worklab

Quando o sistema DB apresenta instabilidade, exames não são integrados e o Worklab fica sem receber resultados de apoio. (linha 52638-52646)

---

## Qualidade e Compliance

### RN-QUA-001: NOTIVISA

Protocolo NOTIVISA deve ser enviado à Criasoft para configuração no Worklab. (linha 45583)

### RN-QUA-002: Rastreabilidade (RDC 786/2023)

Bruno implementou formulários Google para rastreabilidade manual (teste rápido, PCR) antes do HC Quality. Dados necessários: coletador, executor, lote, temperatura, CIQ aprovado, liberador. (linha 43051)

### RN-QUA-003: Avaliação de Satisfação

Pesquisa de satisfação é enviada junto com a mensagem de exames prontos via WhatsApp. (linha 42096)

---

## Suporte

### RN-SUP-001: Canais de Suporte

- Chat via WhatsApp com equipe Criasoft
- Portal Movidesk: `https://criasoft.movidesk.com/kb/`
- Telefone financeiro (contato específico fornecido)
- Site: `https://worklabweb.com.br/suporte.php` → selecionar "Worklab"

### RN-SUP-002: Horário de Atendimento

Suporte Criasoft disponível a partir das 9h (linha 45576). Contato via WhatsApp pode ser difícil (linha 45104-45106).

---

## Infraestrutura

### RN-INF-001: Hospedagem AWS

Worklab é hospedado na Amazon Web Services. Problemas de rota de provedores brasileiros podem impedir acesso mesmo com servidor funcionando. (linha 28809-28813)

### RN-INF-002: Link Alternativo em Queda

Em caso de bloqueio de rota, proxy alternativo pode ser usado: `https://server7.kproxy.com/...` (linha 28804)

### RN-INF-003: App Mobile

Worklab disponível no Google Play Store. (linha 25796)
