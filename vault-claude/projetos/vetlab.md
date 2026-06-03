# VetLab

## Status: ativo

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Firebase + PWA
**Diretório:** C:\vetlab
**Última sessão:** 2026-05-17

---

## O que é

Sistema web de laudos laboratoriais veterinários. Cria, gerencia e envia laudos (hemograma, bioquímica) com geração de PDF, OCR de resultados, interpretação clínica via LLM, e portal do cliente com acesso por link/QR code.

## Estado atual

- Login e controle de acesso funcionando (admin, profissionais, solicitantes)
- Formulários de hemograma, bioquímica e paciente
- Sistema de PDF com paginação própria (HTML renderer)
- Portal do cliente com link seguro
- Envio por email (EmailJS)
- OCR para captura de resultados
- LLM para interpretação clínica

## Decisões importantes

_(nenhuma registrada ainda)_

## Pendências

_(a definir na próxima sessão de trabalho)_

## Notas

- Hooks principais: useReport, useCreateReport, useOCR, useLLM, useFirebase, useAccessLink, useSecureReport, useSolicitante, useCurrentUserContext, useIsAdmin, useAdminUsers
- Rotas protegidas: AdminRoute, RoleRoute
