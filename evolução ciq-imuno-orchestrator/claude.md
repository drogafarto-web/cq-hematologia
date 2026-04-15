---
title: "Guia de Implementação CIQ-Imuno — Claude sonnet-4-6"
lab: LABOCLIN-RP
operador: "Bruno de Andrade Pires"
conselho: "CRBM-MG 12345"
---

# 🤖 Guia de Implementação — Claude-Sonnet-4-6

Este documento orienta a implementação do módulo CIQ-Imuno seguindo a arquitetura real do Guardachuca LabClin.

## 🏗️ Integração Real no Guardachuca

NÃO crie roteadores independentes. O projeto já possui um sistema de navegação e estado centralizado.

### Passos de Integração:
1. **View Type**: Adicionar `'ciq-imuno'` ao union `View` em `src/types/index.ts:240`.
2. **AppRouter**: Adicionar a rota em `src/features/auth/AuthWrapper.tsx` antes do fallback:
   ```tsx
   if (currentView === 'ciq-imuno') return <CIQImunoDashboard />;
   ```
3. **ModuleHub**: Adicionar o card no array `MODULES` com ícone SVG inline customizado.
4. **Navegação**: Para abrir o módulo, utilize `useAppStore.getState().setCurrentView('ciq-imuno')`.

## 🛠️ Stack Técnica Autorizada
- **Core**: React 19 + TypeScript 5.8 + Vite 6
- **Styling**: Tailwind CSS 4 puro (sem Lucide, sem Framer Motion)
- **Validation**: Zod 3 Standalone (NUNCA use `react-hook-form`)
- **State**: Zustand 5 + `useState` local
- **AI**: Firebase Callable `analyzeImmunoStrip` (Backend processa via Gemini 3.1 Flash)

## 📋 Checklist de Validação RDC 978/2025
- [ ] Campos obrigatórios do FR-036 implementados.
- [ ] Assinatura Digital utiliza `operatorDocument` e `logicalSignature` (SHA-256).
- [ ] Regras de Westgard Categóricas (R/NR) aplicadas via `useCIQWestgard` hook.
- [ ] QR Code de Auditoria aponta para a URL real de auditoria serializada.

## 📦 Dependências
```bash
npm i papaparse qrcode.react
npm i -D @types/papaparse
```
