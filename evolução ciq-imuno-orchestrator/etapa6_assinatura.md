# ETAPA 6/8: ASSINATURA RBAC — RASTREABILIDADE E SEGURANÇA (15min)

## Objetivo
Implementar a assinatura lógica das corridas de CIQ e garantir que apenas usuários com a claim `imunologia` ativa no seu JWT possam acessar o módulo.

## 🔑 Ativação do Módulo (Claims)
A permissão é gerida via Firebase Custom Claims. Ao autorizar um usuário, as functions devem rodar:
```ts
// Exemplo administrativo
setModulesClaims({ uid: '...', modules: { imunologia: true } });
```
A validação no Firestore é feita pela regra: `hasModuleAccess('imunologia')`.

## ✍️ Assinatura Lógica (SHA-256)
Utilize a Web Crypto API para gerar a assinatura digital (`logicalSignature`) que vincula o operador aos dados.

Campos incluídos no payload da assinatura:
- `operatorDocument` (ex: CRBM-MG 12345)
- `lotId`
- `resultadoObtido`
- `dataRealizacao`

```ts
async function generateSignature(data: any): Promise<string> {
  const encoder = new TextEncoder();
  const payload = JSON.stringify({
    doc:  data.operatorDocument,
    lot:  data.lotId,
    test: data.testType,       // inclui o tipo de imunoensaio (HCG, HIV, etc.)
    ctrl: data.loteControle,   // rastreia o lote físico do controle usado
    res:  data.resultadoObtido,
    date: data.dataRealizacao
  });
  
  const msgUint8 = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

## Nomenclatura Padrão
| Campo Antigo | Campo Atualizado (Projeto) |
|--------------|---------------------------|
| `crefito`    | `operatorDocument`        |
| `hash`       | `logicalSignature`        |

## Critérios de Aceite
- [ ] Uso de `operatorDocument` para identificação profissional.
- [ ] `logicalSignature` gerado via SHA-256 nativo.
- [ ] Verificação de claim `imunologia` documentada.