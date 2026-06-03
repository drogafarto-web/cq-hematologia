# Worklab Criasoft — Documentação

> Sistema LIS (Laboratory Information System) do LabClin Rio Pomba.  
> Documentação gerada por engenharia reversa a partir de conversa WhatsApp (jun/2021—mai/2026).

## Índice

| Documento                                          | Conteúdo                                                      |
| -------------------------------------------------- | ------------------------------------------------------------- |
| [sistema-completo.md](sistema-completo.md)         | Visão geral, mapa BFS, fluxos operacionais, módulos           |
| [dicionario-entidades.md](dicionario-entidades.md) | Paciente, Médico, Convênio, Exame, Coleta, Laudo, Faturamento |
| [catalogo-apis.md](catalogo-apis.md)               | Endpoints, URLs, integrações, interfaceamento                 |
| [regras-negocio.md](regras-negocio.md)             | RN-AUTH, RN-CAD, RN-COL, RN-RES, RN-FAT, RN-INT, RN-QUA       |
| [catalogo-credenciais.md](catalogo-credenciais.md) | **Confidencial** — credenciais, senhas, contatos              |
| [mapa-urls.md](mapa-urls.md)                       | Todas as URLs do ecossistema                                  |

## Resumo Executivo

| Item         | Valor                                                  |
| ------------ | ------------------------------------------------------ |
| Sistema      | Worklab (Criasoft)                                     |
| Cliente      | LabClin Rio Pomba (ID 386)                             |
| Hospedagem   | AWS                                                    |
| 2FA          | Obrigatório desde 07/07/2025                           |
| Status atual | **Login bloqueado** (senha expirada, 2FA desconhecido) |

## Próximos Passos

1. Obter nova senha/2FA do Worklab (contato Criasoft ou reset)
2. Login no sistema para validação visual de cada tela
3. Capturar screenshots de todas as telas
4. Engenharia reversa de APIs via network monitoring
5. Extrair modelo de dados real (nomes de campos, relacionamentos)
6. Integrar API do Worklab ao HC Quality (Fase 2 da rastreabilidade)
