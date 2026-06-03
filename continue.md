# Handoff — Testes QuickSetupInline (ROTEIRO_TESTE_COAGULACAO.md)

## Summary

### ✅ Concluído

**Teste 1 (Cenário Principal — PASS)**
- Lote TESTE-001 (TP Coagulação, WAMA, lacrado) criado com sucesso
- "Nova corrida" no módulo Coagulação acionou QuickSetupInline
- QuickSetupInline exibiu TESTE-001 com sufixo "(fechado — será aberto)"
- Ao vincular, lote foi aberto automaticamente (abertura registrada 20/05/2026)
- Lote passou a status "qc-pendente" no setup (activeReagenteId = TESTE-001)

**Teste 2 (Setup — PASS)**
- Lote TESTE-002 (Controle Coag, PNCQ, "já em uso") criado com sucesso
- Status: "Em uso", abertura 21/05/2026, worklab 0107885
- Visível em "Todos os lotes" → "Em uso" com 590d restantes

### 🔄 Pendente

**Teste 2 (QuickSetupInline) — Bloqueado**
- QuickSetupInline SÓ aparece quando o slot do reagente está vazio (`activeReagenteId === null`)
- Atualmente TESTE-001 está configurado como reagente do setup (do Teste 1)
- Necessário: limpar `activeReagenteId` em Firestore para re-triggerar

## Como destravar

```bash
# 1. Descobrir o labId e setupDocId
# Path: /labs/{labId}/equipment-setups/{setupDocId}
# setupDocId = 'CLOTDUO_CLOT' (fase D) ou 'coagulacao' (legado)
firebase firestore:get /labs --limit 1

# 2. Listar equipment-setups para confirmar
firebase firestore:get /labs/{labId}/equipment-setups

# 3. Limpar activeReagenteId
firebase firestore:update /labs/{labId}/equipment-setups/{setupDocId} \
  activeReagenteId=null
```

Depois de limpar:
1. Navegar: Coagulação → "Nova corrida" → QuickSetupInline deve aparecer
2. TESTE-002 deve aparecer SEM sufixo "(fechado — será aberto)"
3. Selecionar TESTE-002 → deve vincular sem tentar abrir
4. Form deve ficar populado com dados do TESTE-002

## Testes seguintes após destravamento
- **Teste 3**: Criar outro lote fechado → QuickSetupInline mostra misto (fechado + ativo)
- **Teste 4**: Fechar/descartar todos os lotes → QuickSetupInline deve mostrar estado vazio
- **Teste 5**: Verificar Uroanálise continua funcionando sem QuickSetupInline

## Credenciais
Email: drogafarto@gmail.com / Senha: 12345678
Lab: LabClin Rio Pomba MG
Firebase project: hmatologia2 (southamerica-east1)
