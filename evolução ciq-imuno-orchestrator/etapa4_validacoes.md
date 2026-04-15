# ETAPA 4/8: VALIDAÇÕES RDC — CONFORMIDADE E ALERTAS (20min)

## Objetivo
Implementar as validações de campo e regras de negócio exigidas pela RDC 978/2025 focado em imunoensaios categóricos.

## Lógica de Validação Customizada
Abaixo do schema Zod na Etapa 3, implemente a função utilitária para cálculo de validade:

```ts
/**
 * Calcula a diferença em dias entre hoje e a data de validade.
 */
function daysToExpiry(dateStr: string): number {
  const expiry = new Date(dateStr);
  const today  = new Date();
  // Zera horas para comparação precisa de dias
  today.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
```

## Regras de Negócio Implementadas
1. **Bloqueio de Expiração**: O formulário (via refine no Zod) deve impedir o salvamento se `dataRealizacao` for posterior a qualquer validade (Controle ou Reagente).
2. **Alerta de Proximidade**: Exibir aviso visual se `daysToExpiry(validadeControle) < 30`.
3. **Status do Reagente**: Alerta se `reagenteStatus === 'NR'` (Não Reagente na abertura), o que inviabiliza o uso para testes de CIQ Reagentes.

## Integração Visual
Utilize classes Tailwind puras para feedback:
- Erro: `text-red-500 text-xs mt-1`
- Alerta: `bg-amber-500/10 border-amber-500/20 text-amber-500`

## Critérios de Aceite
- [ ] Lógica de `daysToExpiry` implementada corretamente.
- [ ] Refines do Zod cobrem as datas de validade.
- [ ] Mensagens de erro em português claro conforme o FR-036.