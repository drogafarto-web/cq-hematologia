# Wave G — Deploy

## Objetivo Fechado

Preparar e executar deploy em produção (main) com gates automáticos + monitoring pós-deploy.

## Contrato de Entrada

- Wave F aprovada ✅
- Todas as métricas em alvo
- Arquiteto deu sign-off final

## Definição de Pronto

- [ ] `docs/coag-v2/DEPLOY-REPORT-[DATE].md` preenchido
- [ ] Tag `v2.0.0-coag` criada
- [ ] Deploy em staging (se existir) aprovado
- [ ] Smoke test em produção passando
- [ ] Monitoring de 24h rodando
- [ ] Zero erros críticos em Cloud Logs

## Critérios de Rejeição

- [ ] Smoke test em produção falhando
- [ ] Erro crítico em Cloud Logs (< 1h após deploy)
- [ ] Algum módulo adjacente afetado
- [ ] Metrics fora do budget (bundle size, latency)

## Arquivos Permitidos

- `docs/coag-v2/DEPLOY-REPORT-[DATE].md` (CRIAR)
- `docs/coag-v2/ROLLBACK-PLAN.md` (CRIAR)
- Qualquer arquivo de configuração (firebase.json, package.json) para ajustes de deploy

## Arquivos Proibidos

- Código fonte das waves A-F (se bug em dev, reverter wave e refazer)

## Tasks

### Pré-deploy (manual)

1. Rodar `./scripts/audit-coag-v2.sh` (deve passar)
2. Rodar `npx vitest run` (deve passar)
3. Rodar `npx playwright test coag-v2.smoke.spec.ts` (deve passar)
4. Rodar `npm run build` (deve passar)
5. Criar DEPLOY-REPORT com métricas finais
6. Criar tag `v2.0.0-coag`

### Deploy

1. Merge `main-v2` → `main`
2. `firebase deploy --only firestore:rules`
3. `firebase deploy --only functions`
4. `firebase deploy --only hosting`
5. Rodar smoke test em produção
6. Iniciar `./scripts/monitor-cloud-logs.sh 24 30`

### Pós-deploy (monitoring)

1. Ver Cloud Logs a cada 30min por 24h
2. Verificar error rate < 1%
3. Verificar latency p95 < 2s
4. Notificar CTO de sucesso (ou rollback)
