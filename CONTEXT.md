# Context

Resumo rápido para agentes. **Fonte canônica:** `CLAUDE.md`, `AGENTS.md`, `docs/playbooks/`.

- **Stack:** React 19, Vite 6, TypeScript, Tailwind 4, Zustand, Firebase (Firestore + Functions Node 22).
- **Prod:** `hmatologia2` — ver config pública em `src/config/firebase.config.ts` (sem segredos de servidor).
- **Router:** estado global (`useAppStore`), não React Router.
- **Módulos:** feature-based em `src/features/<módulo>/`.

Atualize este arquivo quando mudar convenções que todo agente precisa enxergar numa linha.
