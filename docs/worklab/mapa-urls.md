# Worklab — Mapa de URLs

> Todas as URLs descobertas do ecossistema Worklab/Criasoft.

---

## Produção

### Staff Login

| URL                              | Descrição             |
| -------------------------------- | --------------------- |
| `https://www.worklabweb.com.br/` | Login staff (desktop) |
| `https://m.worklabweb.com.br/`   | Login staff (mobile)  |

### Portal de Resultados (Pacientes)

| URL                                                                     | Descrição                |
| ----------------------------------------------------------------------- | ------------------------ |
| `https://portal.worklabweb.com.br/resultados/{id}`                      | Página inicial do portal |
| `https://portal.worklabweb.com.br/resultados/{id}?c={code}&p={hash}`    | Resultado individual     |
| `https://portal.worklabweb.com.br/resultados-on-line/`                  | Lista de resultados      |
| `https://portal.worklabweb.com.br/resultados-on-line/print/{id}?v={ts}` | Impressão individual     |

### Parâmetros de Resultado

| Parâmetro       | Tipo        | Exemplo       |
| --------------- | ----------- | ------------- |
| `id` (labId)    | numérico    | 386           |
| `c` (exam code) | numérico    | 0094270       |
| `p` (hash)      | hex 6 chars | 7b129c        |
| `v` (timestamp) | unix ms     | 1745856008330 |

---

## Homologação / Teste

| URL                              | Descrição               |
| -------------------------------- | ----------------------- |
| `https://hmg.worklabweb.com.br/` | Ambiente de homologação |

---

## Suporte

| URL                                                                 | Descrição                       |
| ------------------------------------------------------------------- | ------------------------------- |
| `https://worklabweb.com.br/suporte.php`                             | Portal de suporte Criasoft      |
| `https://criasoft.movidesk.com/kb/`                                 | Base de conhecimento (Movidesk) |
| `https://criasoft.movidesk.com/kb/article/222406/adicionar-grafico` | Artigo: adicionar gráfico       |

---

## Marketing Criasoft

| URL                                                                                                     | Descrição            |
| ------------------------------------------------------------------------------------------------------- | -------------------- |
| `https://criasoft.com.br/laudos-diferenciados-com-qr-code-graficos-coloridos-marca-dagua-e-muito-mais/` | Laudos diferenciados |

---

## Sistema de Apoio (DB Diagnósticos)

| URL                                                        | Descrição       |
| ---------------------------------------------------------- | --------------- |
| `https://out-prd.diagnosticosdobrasil.com.br/Portal/Login` | Login portal DB |

---

## Aplicativos

| App     | Plataforma        |
| ------- | ----------------- |
| Worklab | Google Play Store |

---

## Observações

- O ID do laboratório (386) é fixo para LabClin Rio Pomba
- O hash `p` nos resultados parece ser gerado aleatoriamente (6 caracteres hex)
- O timestamp `v` na impressão é usado para cache-busting
- A homologação (`hmg.`) é mencionada como alternativa quando produção tem problemas
