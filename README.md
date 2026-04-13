# CQ Hematologia Labclin

Sistema web SaaS de Controle de Qualidade Interno para laboratórios clínicos de hematologia. Multi-tenant, com extração de resultados via IA (OCR), gráficos de Levey-Jennings e alertas automáticos das Regras de Westgard.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 |
| Estilos | Tailwind CSS (CDN) |
| Estado global | Zustand 5 |
| Validação | Zod 3 |
| Gráficos | Recharts 3 |
| Backend | Firebase 10 (Auth + Firestore + Storage) |
| IA / OCR | Google Gemini 2.5 Flash (`@google/genai`) |

---

## Pré-requisitos

- Node.js 20+
- Projeto Firebase com Firestore, Authentication (email/password) e Storage habilitados
- Firebase CLI (`npm install -g firebase-tools`)

---

## Configuração

### 1. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com as credenciais do seu projeto Firebase:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# "firebase" (produção) ou "local" (dev offline com localStorage)
VITE_DATABASE_PROVIDER=firebase
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Deploy das regras e índices do Firestore

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
# → http://localhost:3000
```

---

## Build de produção

```bash
npm run build
firebase deploy --only hosting
```

---

## Estrutura de pastas

```
src/
├── config/          # Firebase + provider do banco
├── features/
│   ├── auth/        # Máquina de estados de autenticação + onboarding
│   ├── analyzer/    # View principal do operador
│   ├── lots/        # CRUD de lotes de controle
│   ├── runs/        # Registro de corridas (OCR + revisão + confirmação)
│   ├── chart/       # Gráfico Levey-Jennings + Regras de Westgard
│   ├── bulaparser/  # Importação de metas via PDF de bula
│   └── admin/       # Painel Super Admin (labs, membros, solicitações)
├── shared/          # Componentes UI, serviços Firebase, hooks
├── store/           # Zustand (useAuthStore, useAppStore)
└── types/           # Interfaces TypeScript centralizadas
```

---

## Modelo de dados (Firestore)

```
/users/{userId}
/labs/{labId}
  /members/{userId}
  /data/appState
  /lots/{lotId}
    /runs/{runId}
/accessRequests/{reqId}
/status/init
```

Lotes **nunca** são salvos como array dentro de um documento — cada um é um documento separado com subcoleção `/runs`.

---

## Fluxo de autenticação

```
login
  └─ sem labs + sem pedido pendente  →  FirstLabSetupScreen   (cria ou solicita acesso a um lab)
  └─ pedido pendente                 →  PendingLabAccessScreen
  └─ múltiplos labs, nenhum ativo    →  LabSelectorScreen
  └─ lab ativo                       →  AnalyzerView
  └─ superAdmin sem lab              →  SuperAdminDashboard
```

---

## Fluxo de uma corrida

1. Operador fotografa a tela do Yumizen H550
2. Gemini extrai os valores dos 21 analitos via OCR (saída validada com Zod)
3. Operador revisa e confirma (ou edita manualmente)
4. Run é salva no Firestore; imagem sobe para o Storage em background
5. Gráfico de Levey-Jennings é atualizado; violações de Westgard são marcadas

---

## Regras de Westgard implementadas

| Regra | Tipo | Condição |
|---|---|---|
| 1-2s | Warning | 1 valor além de ±2DP |
| 1-3s | Rejeição | 1 valor além de ±3DP |
| 2-2s | Rejeição | 2 consecutivos além de ±2DP (mesmo lado) |
| R-4s | Rejeição | 2 consecutivos com amplitude >4DP (lados opostos) |
| 4-1s | Rejeição | 4 consecutivos além de ±1DP (mesmo lado) |
| 10x  | Rejeição | 10 consecutivos no mesmo lado da média |

---

## Papéis de usuário

| Role | Permissões |
|---|---|
| `member` | Registrar e revisar corridas |
| `admin` | + Criar/editar lotes, promover membros, excluir corridas |
| `owner` | + Excluir lote, gerenciar admins |
| `superAdmin` | Acesso total a todos os labs via painel dedicado |

---

## Segurança

- Regras Firestore RBAC via subcoleção `/members` — sem email hardcoded
- Credenciais exclusivamente em `.env` (não commitadas)
- Saída do Gemini validada com `zod.safeParse` antes de qualquer persistência
- Storage protegido por path estruturado (`labs/{labId}/lots/{lotId}/runs/{runId}.jpg`)

---

## Changelog

### v1.1.0
- Regras Firestore RBAC completas (substitui `allow read, write: if true`)
- Subcoleção `/runs` coberta pelas regras de segurança
- Índices compostos para queries de `accessRequests`
- Seletor de role diretamente no modal de aprovação de solicitações

### v1.0.0
- MVP completo: auth multi-tenant, lotes, corridas OCR, Levey-Jennings, Westgard
- Painel Super Admin: labs, membros, solicitações de acesso
