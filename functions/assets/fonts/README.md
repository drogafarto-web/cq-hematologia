# Fontes do Backup PDF

Este diretório hospeda os TTFs embedados nos PDFs gerados pelo
módulo `emailBackup`. Se os arquivos abaixo estiverem presentes,
o gerador usa-os; caso contrário, faz fallback automático para
Helvetica (embutida no pdfkit).

## Arquivos esperados

```
Inter-Regular.ttf   → registrado como "HCQ-Regular"
Inter-Bold.ttf      → registrado como "HCQ-Bold"
```

A lógica de detecção está em
`functions/src/modules/emailBackup/services/pdf/layout.ts` na função
`initPdfFonts(doc)`. Ambos os arquivos precisam existir — se faltar
qualquer um, o gerador usa Helvetica para manter consistência visual.

## Como adicionar Inter

1. Baixe os TTFs do Inter de uma fonte confiável, por exemplo:
   - Google Fonts: https://fonts.google.com/specimen/Inter
   - Repositório oficial: https://github.com/rsms/inter
2. Coloque os arquivos neste diretório com os nomes exatos acima.
3. Adicione também `OFL.txt` (SIL Open Font License) — Inter é
   licenciado sob OFL e o texto da licença deve ser distribuído junto.
4. Redeploy funções (`firebase deploy --only functions`).

Os backups em PDF passarão automaticamente a usar Inter no próximo
render. Nenhuma mudança de código é necessária.

## Outras fontes

Qualquer TTF compatível com pdfkit pode ser usado — basta seguir a
mesma convenção de nome. Se quiser usar outra fonte, ajuste os
arquivos esperados em `initPdfFonts()`.

## Deploy

O Firebase Functions inclui todo o diretório `functions/` no deploy
por padrão, exceto `node_modules/` e o que estiver em `.gcloudignore`.
Arquivos aqui serão empacotados e disponíveis em runtime via
`path.resolve(__dirname, ..., 'assets/fonts/...')`.
