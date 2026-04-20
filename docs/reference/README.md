# Reference — amostras físicas dos formulários Labclin

Esta pasta guarda amostras digitalizadas (PDF/PNG/JPG) dos formulários físicos da Labclin que servem de referência visual para:

- **Exports de auditoria** — cada export (FR-10 digital, FR-036 digital, etc.) deve ser pixel-comparável com a amostra física aqui guardada.
- **Decisões de UX** — padrões observados no preenchimento real (horários típicos, agrupamentos, formatos de lote, erros comuns) informam chips, pickers e validações.

## Arquivos esperados

| Arquivo | Descrição | Usado em |
|---|---|---|
| `FR-10-vazio-Ver00.pdf` | Formulário em branco FR-10 Ver.00 (Rastreabilidade de Insumos) | Base do layout do export PDF (fase F11 do plano) |
| `FR-10-preenchido-2024-2025.{pdf,png,jpg}` | FR-10 preenchido à mão da Labclin, 11/2024–06/2025, Yumizen H550 | Referência visual para acceptance da F11; base das observações da §1.6 do plano |
| `FR-036-*.pdf` | Formulário CIQ Imuno (já implementado) | Referência do export atual |
| `FR-008-*.pdf` | Formulário Coagulação | Referência do export atual |

## Como contribuir

1. Salve o arquivo nesta pasta com o nome seguindo o padrão `FR-NN-<descrição>-<ano>.ext`.
2. Atualize a tabela acima.
3. Se a amostra informa uma decisão de design, referencie o arquivo no plano relevante em `docs/plans/`.

## Política de dados

- **Não incluir dados de pacientes** em amostras salvas aqui.
- **Assinaturas podem ser pseudonimizadas** (borradas) antes de salvar, se a amostra não tiver autorização dos signatários.
- Lab CNPJ, nome do responsável técnico e timbre ficam (são públicos na página de qualidade do lab).

## Referências cruzadas

- Plano FR-10 digital: [../plans/RASTREABILIDADE_INSUMOS_PLAN.md](../plans/RASTREABILIDADE_INSUMOS_PLAN.md)
