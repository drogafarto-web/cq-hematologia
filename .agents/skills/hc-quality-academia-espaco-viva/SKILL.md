---
name: hc-quality-academia-espaco-viva
description: Use when managing, configuring, or troubleshooting the Actuar software and hardware integration for the Academia Espaço Viva project
---

# Academia Espaço Viva — Skill Oficial

## Visão Geral
Esta skill estende as capacidades do agente para lidar com a implantação, administração e suporte do sistema **Actuar** integrado no **Espaço Viva** (localizado em Rio Pomba - MG). Abrange desde configurações lógicas de planos e horários até diagnóstico físico de catracas, controle biométrico e facial, e alinhamento com as regras de precificação e marketing da marca.

---

## O Contexto do Espaço Viva (Rio Pomba - MG)
* **Localização:** Rua Péricles de Queiroz, 48, Centro, Rio Pomba - MG.
* **Contatos:** Telefone/WhatsApp Comercial: (32) 3571-2172, Website: [www.meuespacoviva.com.br](http://www.meuespacoviva.com.br), Instagram: [@espacovivaclinica](https://www.instagram.com/espacovivaclinica).
* **Posicionamento:** "Treino com Propósito" — Musculação Premium equipada com aparelhos novos de alto padrão, vestiários de luxo com duchas aquecidas, inteligência de trilha sonora integrada controlada por batidas/DJs virtuais (*Fenrir*, *Kore*, *Titan*) e controle de acesso tecnológico via **Reconhecimento Facial**.
* **Integração:** Complexo multidisciplinar abrangendo Pilates, Musculação, Fisioterapia, Nutrição, Fonoaudiologia e Ballet.

---

## Estrutura de Planos e Negócio (Landing Page Netlify)
* **Plano Principal:** Plano Trimestral Recorrente de **R$ 149,00/mês** (3 meses de ciclo, 3 parcelas automáticas). Inclui acesso ilimitado, avaliação corporal com bioimpedância e ficha de treino digital em aplicativo próprio.
* **Campanha de Indicação (MGM):**
  * *Amigo Indicado:* 50% de desconto na primeira fatura.
  * *Aluno Indicador:* 20% de desconto cumulativo na próxima mensalidade.
* **Aula Experimental:** Agendamento gratuito lançado no sistema Actuar como um serviço avulso de R$ 0,00 com validade diária.

---

## Quando Usar
Use esta skill sempre que se deparar com tarefas ou dúvidas envolvendo:
* Configuração de horários, feriados e recessos da academia.
* Criação de atividades, espaços físicos ou novos planos (Mensal, Anual Recorrente).
* Operações de faturamento master, consulta de faturas e uso do **ID de Atendimento**.
* Solução de falhas físicas, de rede, bloqueios indevidos ("Acesso Já Realizado") ou biometria.
* Atualizações e manutenções na documentação institucional de saúde e bem-estar do espaço.

---

## 🚨 Guardrails Inegociáveis (Regras de Ouro)

### 🏃 1. Habilitar Atividades/Serviços para Assinatura
Sempre que cadastrar uma **Atividade** ou **Serviço** novo no sistema Actuar:
* **AÇÃO:** Acesse a aba **Avançado** da atividade/serviço e marque a opção **"Habilitar para assinatura"**.
* **CONSEQÜÊNCIA DE ERRO:** Se esquecido, a atividade fica invisível na criação de planos na recepção, impedindo a venda e vinculação contratual.

### 💳 2. Permitir Reentrada de Alunos
Ao configurar qualquer **Plano** comercial voltado para a Academia/Musculação:
* **AÇÃO:** Acesse a aba **Avançado** do plano e marque a opção **"Permitir reentrada"**.
* **CONSEQÜÊNCIA DE ERRO:** Se desativado, a catraca física bloqueará o aluno caso ele passe a biometria/reconhecimento facial mais de uma vez no mesmo dia (ex: sair para buscar água no carro ou treinar duas vezes).

---

## 🛠️ Guia Rápido de Troubleshooting (Resolução de Problemas)

| Sintoma / Erro | Causa Comum | Ação de Resolução |
|---|---|---|
| **Acesso Negado** (Plano Ativo) | Atividade desmarcada em *"Habilitar para assinatura"* | Ir em *Atividades > Avançado* e ativar o parâmetro. |
| **Acesso Já Realizado** | Plano sem permissão de reentrada ativada | Ir em *Planos > Avançado*, habilitar *Permitir reentrada* e atualizar o contrato. |
| **Falha Facial Câmera** | Câmera da catraca suja ou desalinhada | Limpar a lente com pano macio e readequar luminosidade. |
| **Reconhecimento Facial Falha** | Foto inicial na recepção escura ou com adereços | Tirar nova foto clara do rosto do aluno e forçar sincronização facial. |
| **Liberando Inadimplentes** | Catraca operando em modo offline (Sem conexão TCP/IP) | Verificar fiação de rede local e reiniciar a catraca física (10s fora da tomada). |
| **Lentidão Biométrica** | Acúmulo de gordura/sujeira no prisma óptico do leitor | Limpar o sensor com **fita adesiva transparente**. Nunca use álcool ou abrasivos. |
| **Suporte Não Atende** | Falta de fornecimento do ID de Atendimento Master | Localizar o ID numérico no Perfil Master e fornecer no chat/WhatsApp. |

---

## 📚 Vault de Referência
Todas as notas de configuração detalhadas e modelos de acompanhamento estão disponíveis no cofre do Obsidian:
📂 **`C:\musculação\`** (com o dashboard principal em `Painel Geral.md`).
* Módulo Institucional: `00 - Sobre o Espaço Viva` (Apresentação, Especialidades e Sinergia Operacional).
