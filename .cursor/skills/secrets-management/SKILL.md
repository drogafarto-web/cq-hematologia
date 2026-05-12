---
name: secrets-management
description: Política de segredos para HC Quality — Firebase, .env, Functions defineSecret, sem hardcode. Use ao tocar em auth, functions, env, deploy ou quando o agente sugerir chaves em código.
---

# Secrets Management

## Regras obrigatórias
- NUNCA escrever API keys, tokens ou senhas em código
- .env.example deve existir com chaves mas SEM valores
- .gitignore deve conter: .env, .env.local, serviceAccountKey.json
- Firebase Functions: usar APENAS defineSecret() do SDK v2
- firebase.config.ts: só variáveis públicas (apiKey, projectId, etc.)
- Rotação de secrets a cada 90 dias via Google Secret Manager

## Checklist antes de todo commit
- [ ] nenhum valor sensível em arquivos rastreados
- [ ] .env.example atualizado
- [ ] Functions sem hardcode
