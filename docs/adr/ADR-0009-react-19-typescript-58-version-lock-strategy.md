# ADR-0009: React 19 + TypeScript 5.8 — Version Lock Strategy for v1.4

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

HC Quality é um sistema SaaS de Controle Interno de Qualidade laboratorial com stack consolidado: React 19, TypeScript 5.8, Vite 6, Zustand 5, Firebase 12, Node 22 (LTS).

v1.3 alcançou 25 módulos em produção com Web Vitals saudáveis (LCP ~1.8s, CLS ~0.03) e bundle principal ~362 KB gzip. O stack foi escolhido deliberadamente por ser world-class em 2026 — não por ser popular.

v1.4 representa consolidação de compliance + expansão de features. Cronograma de 22 semanas (2026-05-07 → 2026-09-30) exige **stabilidade arquitetural**, não inovação tecnológica. Ao mesmo tempo, React 20 é esperado em H2 2026, TypeScript 5.9 / 6.0 em 2026, e Node 26 em out/2026.

**Questão estratégica:** Forçar upgrade de bibliotecas maiores em v1.4 para aproveitar features novas, ou manter versions travadas e foco em product?

## Problema

Sem decisão explícita, há presságio de contexto-switching desnecessário:

1. **Upgrade compulsório** (cenário A): React 20 drops H2 2026 → alguém quer testar → descobre breaking changes no Zustand/Vite → dedica semanas a migração → pull focus do DICQ closure.

2. **Dívida técnica** (cenário B): Travamos v1.3 versions; em dez/2026, React 20 tem 8 meses de produção sem que tenhamos testado → v1.5 herda acúmulo de mudanças.

3. **Minor bloat** (cenário C): Atualizamos typescript 5.8 → 5.9 "sem breaking", mas 5.9 encontra tipos que 5.8 deixava passar; CI fica red por 2 dias.

Falta de estratégia explícita trava progressão em v1.4 ou cria debt incontrolável em v1.5.

## Decisão

**v1.4 adota LOCK POLICY (Version-First):**

1. **React 19.0 — Travado até v1.5 planning.**
   - React 20 beta testado paralelamente em branch `exp/react-20` (não bloqueante).
   - Se React 20 ship sem breaking changes, v1.5 milestone incorpora upgrade de 2-3 semanas.
   - Se breaking changes significativas, React 20 deferred para v1.6.

2. **TypeScript 5.8 — Travado até fim de v1.4.**
   - TS 5.9 / 6.0 monitorado mas não integrado.
   - v1.4 CI: `npm run tsc --noEmit` passa contra TS 5.8 (sem `--lib upgradeRequired`).
   - Rationale: TS mudanças quebram compilação; risco alto em semana 4-20 de v1.4.

3. **Vite 6.0 — Travado até v1.5 planning.**
   - Vite 7.0 esperado H2 2026; não há timeline crítica.
   - Plugin ecosystem é estável em v6; sem justificativa urgente para upgrade.

4. **Zustand 5.0 — Travado até v1.5.**
   - Zustand é estável (sem major planned). Sem razão para movimento.

5. **Firebase SDK v1.4 (v12 compat mode).**
   - v1.3 completou migração v1→v2 SDK. Continuamos v12 (latest v1.x).
   - Firebase 13 não tem timeline anunciada; quando sair, v1.5 planning incorpora.
   - Rules + Functions pinned a Node 22 (LTS 2027-04); sem upgrade forçado.

6. **Node 22 LTS — Travado até 2026-10.**
   - Node 22 EOL 2027-04; seguro para v1.4.
   - Node 26 (LTS oct/2025) será LTS através 2027; upgrade para v1.5 ou v2.0 conforme cronograma.

**Política operacional:**

- `package.json` pinned versions (sem `~` ou `^`, valores exatos).
- Pre-merge gate: `npm ci` (not `npm install`) garante lock file integrity.
- Vulnerability scan (`npm audit`) rodando em CI, mas **apenas high-severity ou known-CVE bloqueam merge** (não todos warnings).
- Dependency updates deferred para v1.5 planning (Weeks 1-2 de v1.5: audit + stage upgrades).

## Alternativas consideradas

### Alternativa A — Upgrade agressivo ("stay latest")

Atualizar React, TS, Node, Vite para versões latest menores a cada sprint.

**Rejeitada porque:**

- Time tem 4-5 engenheiros; contexto-switching em breaking changes rouba 1-2 semanas.
- DICQ compliance é deadline crítica (auditoria 2026-10-15). Não há margem pra surpresas.
- "Latest" não é sinônimo de "best" — v1.3 stack é world-class; mudanças por mudança é antico.

### Alternativa B — v1.4-alpha + v1.4-stable branches

Manter dois builds em paralelo (v1.4 com versions pinned, v1.4-alpha com latest).

**Rejeitada porque:**

- Split de CI/CD overhead para time pequeno.
- Alpha branch raramente encontra bugs cedo o suficiente pra bloquear release.
- Duplica testes + deploy ceremony.

## Consequências

### Positivas

1. **Estabilidade arquitetural.** Time foca 100% em DICQ closure + portals + IA foundation. Zero dist por "React update broke my component".
2. **Reproducible builds.** Cada merge é idêntico em stack; auditor não vê "oh you upgraded TS in week 10, código novo pode ter comportamento diferente".
3. **Rollback safety.** Se v1.4 precisa rollback, voltar para v1.3 é garantido (zero version mismatch).
4. **Planejamento v1.5 claro.** Upgrade path mapeado (React 20 test branch, TS 6.0 research, Node 26 pilot).

### Negativas

1. **Dívida acumulada.** Se React 20 tiver feature killer que ajudava v1.4 (improvável, mas possível), não temos acesso.
2. **Segurança menor.** Vulnerabilidades descobertas em React 19 depois de v1.4 launch exigem backport (trabalho). Mitigado: React 19 é maduro e estável; risco baixo.
3. **Tech debt v1.5.** Quando v1.5 incorpora React 20, é "upgrade week" em bloco. Mitigado: planejado; não surpresa.

## Compromissos derivados

1. **Weekly dependency scan** (via Dependabot ou equivalent): listar security updates, categorize (patch/minor/major), document decision (apply agora vs defer v1.5) em issue.
2. **v1.4 EOW report** (part of deployment checklist): confirm npm audit status, list any deferred vulnerabilities (aceitado com assinatura CTO).
3. **v1.5 kickoff** (first 2 weeks): 1 engineer assigned to stage + test React 20 / TS 6.0 / Node 26 em parallel branch. Reporte feasibility antes de committing ao timeline.

## Referências

- `package.json` (root): pinned versions para todo core stack
- `.npmrc`: engine-strict=true para enforce Node 22
- `vite.config.ts`: React 19 plugin version hardcoded (comentário com "PINNED v1.4")
- CI workflow (`.github/workflows/` ou Firebase deploy script): `npm ci` (not `npm install`)
- v1.3 Web Vitals baseline: `/docs/PERFORMANCE_AUDIT_v1.3.md`
- Obsidian `HC_Quality_Roadmap.md`: v1.5 + v2.0 tech planning (long-term vision)

---

**Aplicabilidade:** Todos os commits de código de v1.4 (web + functions).

---

**ADR Status:** ACCEPTED (2026-05-07)  
**Review Date:** 2026-06-07 (1 month checkpoint: confirm v1.3 + early v1.4 stack stability)
