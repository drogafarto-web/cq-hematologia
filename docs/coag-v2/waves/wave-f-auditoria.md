# Wave F — Auditoria + Integração Cross-onda

## Objetivo Fechado

Validar integração entre todas as waves. Smoke test E2E completo. Firestore rules consistentes.

## Contrato de Entrada

- Waves A-E aprovadas ✅

## Definição de Pronto

- [ ] `coag-v2.smoke.spec.ts` — Playwright E2E test cobrindo fluxo completo
- [ ] Todas as rules Firestore validadas em emulator
- [ ] Script `scripts/audit-coag-v2.sh` criado e funcional
- [ ] Auditoria arquitetural rodando em CI (local)
- [ ] Métricas de simplicidade atingidas (ver `execution-plan-part4-protection.md` §4.6)
- [ ] Módulos adjacentes (hematologia, uroanálise, imuno) intactos

## Critérios de Rejeição

- [ ] E2E test falha
- [ ] Rules não passam em emulator
- [ ] Algum módulo adjacente afetado
- [ ] Métricas de simplicidade excedidas
- [ ] Auditoria com falha não-resolvida

## Arquivos Permitidos

- `tests/coag-v2.smoke.spec.ts` (CRIAR)
- `scripts/audit-coag-v2.sh` (CRIAR)
- `firestore.rules` (MODIFICAR — verificar consistência)
- `.github/workflows/coag-v2-audit.yml` (CRIAR — opcional)

## Arquivos Proibidos

- Modificar código de waves A-E (se bug, reverter wave)

## Tasks

1. `audit-coag-v2.sh` script (20 min)
2. Firestore rules consistency check (10 min)
3. `coag-v2.smoke.spec.ts` completo (30 min)
4. Rodar auditoria completa e fixar violações (30 min)
5. Validar módulos adjacentes (15 min)
6. Gerar métricas finais (10 min)

## Métricas Alvo (final)

| Métrica | Alvo |
|---------|------|
| Entidades | 3 |
| Eventos | 3 |
| Campos operacionais | ≤ 6 |
| Arquivos totais (src) | ≤ 15 |
| Linhas totais | ≤ 3000 |
| Maior hook | ≤ 200 |
| Maior componente | ≤ 300 |
