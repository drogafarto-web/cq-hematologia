# QC Control v2 — Coagulação

Versão reescrita do QC Control alinhada ao modelo de domínio real do Controle Interno de Qualidade em produção.

## Modelo de domínio (v2)

- **Controle** = 1 lote com ranges configurados para 3 parâmetros
- **Registro** = 1 entrada do operador com 3 valores simultâneos (Protrombina, RNI, TTPA)
- **Validação**: apenas "dentro/fora do range" (sem Westgard)
- **2 controles ativos**: Normal + Patológico, cada um com seu lote

## Stack

Next.js 14 + TypeScript strict + Prisma + PostgreSQL + Tailwind + Recharts

## Para rodar

```bash
# 1. Certifique-se que o PostgreSQL do v1 está rodando (localhost:5432)
# 2. Instale deps
npm install

# 3. Crie o database v2 (ou use o mesmo do v1 — tabelas são diferentes)
# Exemplo com psql:
# CREATE DATABASE qc_control_v2;

# 4. Push schema + seed
npx prisma db push
npx prisma db seed

# 5. Run
npm run dev
# Acessar: http://localhost:3001
# Login: maria@hospital.test / lab123
```

## Telas

| Rota         | Nome     | Função                                                                               |
| ------------ | -------- | ------------------------------------------------------------------------------------ |
| `/qc`        | Controle | Tela principal: grid 2 controles × 3 parâmetros + formulário de registro + histórico |
| `/controles` | Hub      | CRUD de controles com ranges configuráveis por parâmetro                             |
| `/login`     | Login    | Autenticação com credentials                                                         |

## Schema (Prisma)

```
Usuario (id, email, nome, senhaHash, papel)
Controle (id, nome @unique, lote, ativo, 6 ranges: prot/rni/ttppa min/max)
Registro (id, controleId, valorProtrombina, valorRni, valorTtppa, observacao?, operadorId, registradoEm)
```
