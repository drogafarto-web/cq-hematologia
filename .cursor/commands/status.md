# /status

Reporte o estado atual do projeto HC Quality em 5 linhas.

Rode estes comandos no terminal integrado (NÃO me peça permissão pra cada um — são read-only):

```bash
git log --oneline -5
git status --short
sed -n '1,60p' CORRECTIONS.md
firebase functions:secrets:access HCQ_SIGNATURE_HMAC_KEY 2>&1 | head -1
```

Resuma em **exatamente 5 linhas**, nesta ordem:

1. **Ondas deployadas vs pendentes** — qual onda está em qual estado.
2. **Secret HMAC** — `HCQ_SIGNATURE_HMAC_KEY` está setado?
3. **Rules strict** — `firestore.rules.post-onda2` aplicada ou ainda gated?
4. **Triggers novos** — quais `onDocumentWritten` (Onda 4 audit, Onda 5 signatures) estão ativos?
5. **Próximo bloco** — qual é o próximo pedaço de trabalho com menos dependências bloqueadas?

Sem preâmbulo. Sem "vou fazer X". Direto ao resumo.

Se algum comando falhar (ex.: firebase CLI não autenticada), reporte na linha correspondente em vez de tentar consertar.
